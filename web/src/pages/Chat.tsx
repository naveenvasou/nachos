import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, ArrowUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_URL, fetchChatHistory } from '../api';
import MicButton from '../components/chat/MicButton';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

const STORAGE_KEY = 'cooper_chat_history_v1';

export default function Chat() {
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load chat history (server first, fallback to local cache)
  useEffect(() => {
    (async () => {
      try {
        const serverData = await fetchChatHistory();
        const formatted: Message[] = serverData
          .map((m) => ({
            id: String(m.id),
            sender: m.role === 'user' ? ('user' as const) : ('ai' as const),
            text:
              m.content || (m.tool_calls ? '🛠️ (Cooper updated the database)' : ''),
          }))
          .filter((m) => m.text);
        setMessages(formatted);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));
      } catch {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) setMessages(JSON.parse(cached));
      }
    })();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      text: trimmed,
      sender: 'user',
    };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withUser));
    setInput('');
    setIsLoading(true);

    const aiId = String(Date.now() + 1);
    setMessages([...withUser, { id: aiId, sender: 'ai', text: '' }]);

    let fullText = '';

    try {
      const res = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events split on \n\n; each line in an event begins with "data: "
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of rawEvent.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const data = JSON.parse(payload);
              if (data.token) {
                fullText += data.token;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aiId ? { ...m, text: fullText } : m))
                );
              }
              if (data.done) {
                localStorage.setItem(
                  STORAGE_KEY,
                  JSON.stringify([
                    ...withUser,
                    { id: aiId, sender: 'ai', text: fullText },
                  ])
                );
              }
            } catch (err) {
              console.error('SSE parse error', err, payload);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId
            ? { ...m, text: '⚠️ Failed to reach Cooper. Check your connection.' }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      const baseText = input;
      let sessionCommitted = '';

      const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws/transcribe';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.is_final) {
            sessionCommitted += (sessionCommitted ? ' ' : '') + data.text;
            setInput(
              baseText + (baseText ? ' ' : '') + sessionCommitted
            );
          } else if (data.text) {
            setInput(
              baseText +
                (baseText ? ' ' : '') +
                sessionCommitted +
                (sessionCommitted ? ' ' : '') +
                data.text
            );
          }
        } catch (err) {
          console.error('WS parse error', err);
        }
      };

      ws.onerror = (e) => console.warn('WS error', e);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const f32 = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          const s = Math.max(-1, Math.min(1, f32[i]));
          i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(i16.buffer);
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => undefined);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    processorRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
  };

  useEffect(() => () => stopRecording(), []);

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <button
          style={styles.iconButton}
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft size={22} color="#1a1a1a" />
        </button>
        <h1 style={styles.title}>Cooper</h1>
        <button style={styles.iconButton} aria-label="More">
          <MoreHorizontal size={22} color="#1a1a1a" />
        </button>
      </header>

      <div ref={listRef} style={styles.list}>
        {messages.map((m) =>
          m.sender === 'user' ? (
            <div key={m.id} style={styles.userRow}>
              <div style={styles.userBubble}>{m.text}</div>
            </div>
          ) : (
            <div key={m.id} style={styles.aiRow}>
              <div className="markdown" style={styles.aiText}>
                <ReactMarkdown>{m.text || ' '}</ReactMarkdown>
              </div>
            </div>
          )
        )}
        {isLoading && (
          <div style={styles.aiRow}>
            <div style={styles.typing}>
              <span style={{ ...styles.dot, animationDelay: '0s' }} />
              <span style={{ ...styles.dot, animationDelay: '0.15s' }} />
              <span style={{ ...styles.dot, animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
      </div>

      <div style={styles.inputBarWrap}>
        <div style={styles.inputBar}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            style={styles.textarea}
          />
          <MicButton
            isRecording={isRecording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />
          <button
            style={{
              ...styles.sendButton,
              background: input.trim() ? '#000' : '#e0e0e0',
            }}
            disabled={!input.trim() || isLoading}
            onClick={sendMessage}
            aria-label="Send"
          >
            <ArrowUp size={20} color="#fff" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#fafafa',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid #f3f4f6',
    flexShrink: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1a1a1a',
    margin: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 4px',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '6px 16px',
  },
  userBubble: {
    background: '#000',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    maxWidth: '80%',
    fontSize: 15,
    lineHeight: 1.5,
    wordWrap: 'break-word',
  },
  aiRow: {
    padding: '8px 16px',
  },
  aiText: {
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 1.5,
  },
  typing: {
    display: 'inline-flex',
    gap: 6,
    padding: '8px 14px',
    background: '#f0f0f0',
    borderRadius: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    background: '#999',
    animation: 'blink 1.2s infinite',
    display: 'inline-block',
  },
  inputBarWrap: {
    padding: '10px 20px max(env(safe-area-inset-bottom), 12px)',
    background: '#fff',
    borderTop: '1px solid #f3f4f6',
  },
  inputBar: {
    display: 'flex',
    alignItems: 'flex-end',
    background: '#fff',
    borderRadius: 30,
    padding: '6px 6px 6px 20px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
    border: '1px solid #f3f4f6',
  },
  textarea: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    padding: '10px 10px 10px 0',
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: 'transparent',
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
