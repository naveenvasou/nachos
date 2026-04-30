import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, ArrowUp, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_URL, fetchChatHistory, streamChat } from '../api';
import MicButton from '../components/chat/MicButton';
import { loadProfile } from '../profile';
import { seedFor, modeTitle, type ChatMode } from '../seeds';
import { track } from '../analytics';
import { recordBrief, recordReview } from '../streak';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

const STORAGE_KEY = 'cooper_chat_history_v1';

export default function Chat() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = (params.get('mode') as ChatMode | null) ?? 'free';
  const isFirstRun = params.get('firstRun') === '1';

  const profile = loadProfile();
  const customSeed = params.get('seed');
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [seed, setSeed] = useState<string>(
    () => customSeed || seedFor(mode, { profile })
  );
  const [seedDismissed, setSeedDismissed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load history (server first, fall back to local cache)
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

  // Reseed when mode/seed changes. Custom seeds (from URL) prefill the input
  // directly — they're partial sentences the user is meant to finish.
  useEffect(() => {
    if (customSeed) {
      setInput((prev) => prev || customSeed);
      setSeed('');
      setSeedDismissed(true);
      return;
    }
    setSeed(seedFor(mode, { profile }));
    setSeedDismissed(false);
  }, [mode, customSeed, profile?.name]);

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const useSeed = () => {
    setInput(seed);
    setSeedDismissed(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = async (override?: string) => {
    const trimmed = (override ?? input).trim();
    if (!trimmed || isLoading) return;

    // Loop instrumentation: the *first* message in a mode counts as starting
    // the brief/review for the day. PostHog gets a granular event per send.
    const isSeedSend = override !== undefined;
    track('chat_message_sent', {
      mode,
      is_seed: isSeedSend,
      char_count: trimmed.length,
      is_first_in_thread: messages.length === 0,
    });
    if (isSeedSend) track('chat_seed_sent', { mode });
    if (mode === 'brief' && messages.length === 0) {
      track('brief_started');
      recordBrief();
    }
    if (mode === 'review' && messages.length === 0) {
      track('review_started');
      recordReview();
    }

    const userMsg: Message = { id: String(Date.now()), text: trimmed, sender: 'user' };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withUser));
    setInput('');
    setSeedDismissed(true);
    setIsLoading(true);

    const aiId = String(Date.now() + 1);
    setMessages([...withUser, { id: aiId, sender: 'ai', text: '' }]);

    try {
      let lastFull = '';
      await streamChat(trimmed, {
        onToken: (_t, full) => {
          lastFull = full;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, text: full } : m))
          );
        },
        onDone: (full) => {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([...withUser, { id: aiId, sender: 'ai', text: full }])
          );
          lastFull = full;
        },
      });
      void lastFull;
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId
            ? { ...m, text: '⚠️ Cooper is unreachable. Check your connection.' }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      track('chat_voice_started', { mode });
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
            setInput(baseText + (baseText ? ' ' : '') + sessionCommitted);
          } else if (data.text) {
            setInput(
              baseText
                + (baseText ? ' ' : '')
                + sessionCommitted
                + (sessionCommitted ? ' ' : '')
                + data.text
            );
          }
        } catch (err) {
          console.error('WS parse error', err);
        }
      };
      ws.onerror = (e) => console.warn('WS error', e);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext
        || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    track('chat_voice_stopped', { mode });
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

  const title = modeTitle(mode);
  const showSeedCard = !!seed && !seedDismissed && messages.length === 0;

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <button
          style={styles.iconButton}
          onClick={() => (isFirstRun ? navigate('/') : navigate(-1))}
          aria-label="Back"
        >
          <ArrowLeft size={22} color="#1a1a1a" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={styles.title}>{title}</div>
          {mode !== 'free' && <div style={styles.subTitle}>Cooper · {mode}</div>}
        </div>
        <button style={styles.iconButton} aria-label="More">
          <MoreHorizontal size={22} color="#1a1a1a" />
        </button>
      </header>

      <div ref={listRef} style={styles.list}>
        {showSeedCard && (
          <SeedCard
            mode={mode}
            seed={seed}
            firstRun={isFirstRun}
            onUseSeed={useSeed}
            onSendNow={() => sendMessage(seed)}
            onDismiss={() => setSeedDismissed(true)}
          />
        )}

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
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={mode === 'free' ? 'Type a message…' : 'Add anything else, then send…'}
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
            onClick={() => sendMessage()}
            aria-label="Send"
          >
            <ArrowUp size={20} color="#fff" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,80%,100%{opacity:.3} 40%{opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function SeedCard({
  mode, seed, firstRun, onUseSeed, onSendNow, onDismiss,
}: {
  mode: ChatMode;
  seed: string;
  firstRun: boolean;
  onUseSeed: () => void;
  onSendNow: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={seedStyles.card}>
      <button onClick={onDismiss} style={seedStyles.dismiss} aria-label="Dismiss">
        <X size={14} color="#9ca3af" />
      </button>
      <div style={seedStyles.kicker}>
        {firstRun ? "LET'S BEGIN" : 'SUGGESTED OPENER'}
      </div>
      <div style={seedStyles.title}>{modeTitle(mode)}</div>
      <div style={seedStyles.body}>"{seed}"</div>
      <div style={seedStyles.actions}>
        <button onClick={onSendNow} style={seedStyles.primary}>Send this</button>
        <button onClick={onUseSeed} style={seedStyles.secondary}>Edit first</button>
      </div>
    </div>
  );
}

const seedStyles: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative',
    margin: '12px 16px 8px',
    padding: '18px 18px 14px',
    background: '#f5f3ff',
    border: '1px solid #e9d5ff',
    borderRadius: 20,
  },
  dismiss: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  kicker: {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
    color: '#7c3aed', textTransform: 'uppercase' as const, marginBottom: 4,
  },
  title: { fontSize: 15, fontWeight: 700, color: '#1f1f1f', marginBottom: 10 },
  body: { fontSize: 14, color: '#4b5563', lineHeight: 1.45, marginBottom: 14 },
  actions: { display: 'flex', gap: 8 },
  primary: {
    flex: 1, padding: '10px 14px', borderRadius: 12,
    background: '#000', color: '#fff', fontWeight: 600, fontSize: 13,
  },
  secondary: {
    flex: 1, padding: '10px 14px', borderRadius: 12,
    background: '#fff', color: '#1a1a1a', fontWeight: 600, fontSize: 13,
    border: '1px solid #e5e7eb',
  },
};

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#fafafa' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 20px', background: '#fff',
    borderBottom: '1px solid #f3f4f6', flexShrink: 0,
  },
  title: { fontSize: 17, fontWeight: 700, color: '#1a1a1a' },
  subTitle: { fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: 0.4, textTransform: 'uppercase' as const },
  iconButton: {
    width: 40, height: 40, borderRadius: 20, background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
  },
  list: { flex: 1, overflowY: 'auto', padding: '8px 0 16px' },
  userRow: { display: 'flex', justifyContent: 'flex-end', padding: '6px 16px' },
  userBubble: {
    background: '#000', color: '#fff', padding: '12px 16px',
    borderRadius: 20, borderBottomRightRadius: 4, maxWidth: '80%',
    fontSize: 15, lineHeight: 1.5, wordWrap: 'break-word',
  },
  aiRow: { padding: '8px 16px' },
  aiText: { fontSize: 16, color: '#1a1a1a', lineHeight: 1.5 },
  typing: {
    display: 'inline-flex', gap: 6, padding: '8px 14px',
    background: '#f0f0f0', borderRadius: 16,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, background: '#999',
    animation: 'blink 1.2s infinite', display: 'inline-block',
  },
  inputBarWrap: {
    padding: '10px 20px max(env(safe-area-inset-bottom), 12px)',
    background: '#fff', borderTop: '1px solid #f3f4f6',
  },
  inputBar: {
    display: 'flex', alignItems: 'flex-end', background: '#fff',
    borderRadius: 30, padding: '6px 6px 6px 20px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.08)', border: '1px solid #f3f4f6',
  },
  textarea: {
    flex: 1, fontSize: 16, color: '#000', padding: '10px 10px 10px 0',
    border: 'none', outline: 'none', resize: 'none',
    background: 'transparent', maxHeight: 120,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
