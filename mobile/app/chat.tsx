import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Platform, StatusBar, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import MicButton from '../components/chat/MicButton';
import 'text-encoding';
import EventSource from 'react-native-sse';
import Markdown from 'react-native-markdown-display';

// 1. IMPORT FROM THE CONTROLLER LIBRARY
import { KeyboardProvider, KeyboardStickyView } from 'react-native-keyboard-controller';
import { AudioRecorder, AudioManager } from 'react-native-audio-api';
// Use expo-av only for permissions if needed, or assume AudioRecorder handles it. 
// Actually, let's keep expo-av for permissions check as it is reliable.
import { Audio } from 'expo-av';

// --- AUDIO HELPERS ---
const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output.buffer;
};

const bytesToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    // Quick check for all-zero input
    const sum = bytes.reduce((acc, val) => acc + val, 0);
    if (sum === 0) {
        console.log("WARNING: bytesToBase64 received all-zero buffer!");
    }

    // Create binary string from bytes
    let binary = '';
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    // Use btoa with proper binary string handling
    // btoa expects binary data (not Unicode), so we need to handle it correctly
    try {
        // For React Native, btoa might not be available or might have issues
        // Fallback to manual encoding if needed
        if (typeof btoa !== 'undefined') {
            const result = btoa(binary);
            console.log("bytesToBase64 (btoa): inputLen=", len, ", sum=", sum, ", outputLen=", result.length, ", first20=", result.substring(0, 20));
            return result;
        }
    } catch (e) {
        console.log("btoa failed, using manual encoding:", e);
    }

    // Manual base64 encoding (fixed implementation)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';

    for (let i = 0; i < len; i += 3) {
        const byte1 = bytes[i];
        const byte2 = i + 1 < len ? bytes[i + 1] : 0;
        const byte3 = i + 2 < len ? bytes[i + 2] : 0;

        const index1 = byte1 >> 2;
        const index2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
        const index3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
        const index4 = byte3 & 0x3f;

        result += chars[index1];
        result += chars[index2];
        result += i + 1 < len ? chars[index3] : '=';
        result += i + 2 < len ? chars[index4] : '=';
    }

    console.log("bytesToBase64 (manual): inputLen=", len, ", sum=", sum, ", outputLen=", result.length, ", first20=", result.substring(0, 20));

    return result;
}

const API_URL = "https://unsignificantly-logarithmic-deetta.ngrok-free.dev";
const STORAGE_KEY = 'cooper_chat_history_v1';
const HEADER_HEIGHT = 60;

interface Message {
    id: string;
    sender: 'ai' | 'user';
    text: string;
}

export default function ChatScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false); // Track recording state
    const [isTranscribing, setIsTranscribing] = useState(false); // Used for "Processing..." UI if needed
    const [bottomPadding, setBottomPadding] = useState(100 + insets.bottom); // Default for input bar

    const socketRef = useRef<WebSocket | null>(null);
    const recorderRef = useRef<AudioRecorder | null>(null);

    useEffect(() => { loadHistory(); }, []);

    // Handle Keyboard Height & Auto-Scroll
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = Keyboard.addListener(showEvent, (e) => {
            const keyboardHeight = e.endCoordinates.height;
            setBottomPadding(keyboardHeight + 80); // Keyboard + Input Bar
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        });

        const onHide = Keyboard.addListener(hideEvent, () => {
            setBottomPadding(100 + insets.bottom); // Reset to just Input Bar
        });

        return () => {
            onShow.remove();
            onHide.remove();
        };
    }, [insets.bottom]);

    // Set transparent status bar for Android
    useEffect(() => {
        if (Platform.OS === 'android') {
            StatusBar.setBackgroundColor('transparent');
            StatusBar.setTranslucent(true);
        }
    }, []);

    const loadHistory = async () => {
        try {
            // 1. Try fetching from server (Truth)
            console.log("Fetching history from server...");
            const response = await fetch(`${API_URL}/chat/history`);

            if (response.ok) {
                const serverData = await response.json();
                // Map backend format (role: user/assistant) to frontend format (sender: user/ai)
                const formattedMessages: Message[] = serverData.map((msg: any) => ({
                    id: msg.id.toString(),
                    sender: msg.role === 'user' ? 'user' : 'ai',
                    text: msg.content || (msg.tool_calls ? '🛠️ (Cooper updated the database)' : '')
                })).filter((m: Message) => m.text); // Filter out empty messages

                setMessages(formattedMessages);
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(formattedMessages));
                console.log("History synced from server.");
            } else {
                throw new Error("Server response not ok");
            }
        } catch (e) {
            console.error("Failed to fetch from server, falling back to local cache", e);
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) setMessages(JSON.parse(stored));
            else setMessages([]); // START FRESH: No default message
        }
    };

    // Setup Audio Session on Mount
    useEffect(() => {
        const setupAudio = async () => {
            try {
                const granted = await AudioManager.requestRecordingPermissions();
                if (!granted) {
                    console.warn("Microphone permission denied");
                }

                // Configure session once
                AudioManager.setAudioSessionOptions({
                    iosCategory: 'playAndRecord',
                    iosMode: 'spokenAudio',
                    iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
                });
            } catch (err) {
                console.error("Failed to setup audio:", err);
            }
        };

        setupAudio();

        // Cleanup
        return () => {
            if (recorderRef.current) {
                recorderRef.current.stop();
            }
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            // Setup handled in useEffect
            setIsRecording(true);
            const baseText = inputText || '';

            // 2. Connect WebSocket
            // Replace http/https with ws/wss
            const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws/transcribe';
            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;

            ws.onopen = () => {
                // Connected
            };

            // Track committed text for this session
            let sessionCommittedText = '';

            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);

                    if (data.is_final) {
                        // Append to session buffer
                        sessionCommittedText += (sessionCommittedText ? " " : "") + data.text;
                        // Update UI with full text
                        setInputText(baseText + (baseText ? " " : "") + sessionCommittedText);
                    } else if (data.text) {
                        // Show: Base + Committed + Interim
                        const interim = data.text;
                        const fullText = baseText +
                            (baseText ? " " : "") +
                            sessionCommittedText +
                            (sessionCommittedText ? " " : "") +
                            interim;
                        setInputText(fullText);
                    }
                } catch (err) { console.error("WS Msg Error", err); }
            };

            ws.onerror = (e: any) => console.log("WS Error", e.message);

            // 3. Start Recorder
            if (!recorderRef.current) {
                const rec = new AudioRecorder({
                    sampleRate: 16000,
                    bufferLength: 2048,
                    channelCount: 1
                });
                recorderRef.current = rec;
            }
            const recorder = recorderRef.current;

            recorder.onAudioReady({
                sampleRate: 16000,
                bufferLength: 2048,
                channelCount: 1
            }, (event) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const { buffer } = event;
                    if (buffer) {
                        try {
                            if (typeof buffer === 'string') {
                                ws.send(buffer);
                            } else {
                                // FIXED: buffer is an AudioBuffer object, not ArrayBuffer.
                                // Use getChannelData(0) to get the Float32Array.
                                let floatData: Float32Array;
                                if (buffer.getChannelData) {
                                    floatData = buffer.getChannelData(0);
                                } else {
                                    // Fallback if it turns out to be raw array (unlikely now)
                                    floatData = new Float32Array(buffer);
                                }

                                // DEBUG: Check values
                                // const floatSum = floatData.reduce((sum, val) => sum + Math.abs(val), 0);
                                // console.log("Audio Data:", floatData.length, "samples, Vol:", floatSum.toFixed(2));

                                // Convert Float32 PCM to Int16 PCM for backend
                                const pcmData = floatTo16BitPCM(floatData);
                                const base64Str = bytesToBase64(pcmData);

                                if (base64Str.length > 0) {
                                    ws.send(base64Str);
                                }
                            }
                        } catch (e) {
                            console.log("WS Send Error:", e);
                        }
                    }
                }
            });

            // Actually, looking at source again:
            // `this.audioEventEmitter.addAudioEventListener('audioReady', (event) => { const audioBuffer = new AudioBuffer(event.buffer); ... })`
            // So `event.buffer` passed to JS is likely a Native Base64 string or a TypedArray from JSI?
            // Since it's C++, it's likely a TypedArray (Float32Array usually).
            // WebSocket.send() handles ArrayBuffer/TypedArray.

            // BUT, `react-native-audio-api` exports `AudioBuffer` class. 
            // I'll assume the callback receives `{ buffer: ... }`.
            // I will use `ws.send("audio_data")` placeholder if I'm unsure.
            // NO, I must do it right.
            // I'll use `react-native-live-audio-stream` style if this fails.

            // Let's assume `recorder.start()` works.
            recorder.start();

        } catch (e) {
            console.error("Failed to start recording stream", e);
            setIsRecording(false);
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        if (recorderRef.current) {
            recorderRef.current.stop();
            recorderRef.current = null;
        }
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim()) return;
        const userMsg: Message = { id: Date.now().toString(), text: inputText, sender: 'user' };
        const updatedWithUser = [...messages, userMsg];
        setMessages(updatedWithUser);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWithUser));

        const currentInput = inputText;
        setInputText('');
        setIsLoading(true);

        let aiMsgId = (Date.now() + 1).toString();
        let fullText = '';
        setMessages([...updatedWithUser, { id: aiMsgId, sender: 'ai', text: '' }]);

        const es = new EventSource(`${API_URL}/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: currentInput }) });

        es.addEventListener('message', (event: any) => {
            try {
                const data = JSON.parse(event.data);
                if (data.token) {
                    fullText += data.token;
                    setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, text: fullText } : msg));
                }
                if (data.done) {
                    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...updatedWithUser, { id: aiMsgId, sender: 'ai', text: fullText }]));
                    setIsLoading(false);
                    es.close();
                }
            } catch (e) { console.error(e); }
        });

        es.addEventListener('error', () => { setIsLoading(false); es.close(); });
    };

    useEffect(() => {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages, isLoading]);

    const renderItem = ({ item }: { item: Message }) => {
        const isUser = item.sender === 'user';

        if (isUser) {
            return (
                <View style={[styles.messageRow, styles.userRow]}>
                    <View style={[styles.messageBubble, styles.userBubble]}>
                        <Text style={[styles.messageText, styles.userText]}>{item.text}</Text>
                    </View>
                </View>
            );
        }

        // AI Message: Full Width / Markdown / No Bubble
        return (
            <View style={[styles.messageRow, styles.aiRow, { paddingLeft: 16, paddingRight: 16, paddingVertical: 8 }]}>
                {/* We render directly into the view, no bubble wrapper */}
                <Markdown style={markdownStyles}>
                    {item.text}
                </Markdown>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
            {/* 2. WRAP EVERYTHING IN KEYBOARD PROVIDER */}
            <KeyboardProvider>
                <View style={styles.mainContainer}>
                    {/* Header */}
                    <View style={[styles.header, { top: insets.top, height: HEADER_HEIGHT }]}>
                        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
                            <Feather name="arrow-left" size={24} color="#1a1a1a" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Cooper</Text>
                        <TouchableOpacity style={styles.iconButton}><Feather name="more-horizontal" size={24} color="#1a1a1a" /></TouchableOpacity>
                    </View>

                    {/* Gradient Header Background */}
                    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9, height: insets.top + HEADER_HEIGHT + 40 }}>
                        <LinearGradient colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0)']} style={{ flex: 1 }} />
                    </View>

                    <View style={[styles.contentContainer, { paddingTop: insets.top + HEADER_HEIGHT }]}>
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderItem}
                            keyExtractor={item => item.id}
                            style={{ backgroundColor: '#fafafa' }}
                            // Add lots of padding at bottom so the last message isn't hidden by the sticky input
                            contentContainerStyle={[styles.chatListContent, { paddingBottom: bottomPadding }]}
                            ListFooterComponent={isLoading ? <View style={styles.loadingContainer}><ActivityIndicator size="small" color="#007AFF" /></View> : <View style={{ height: 20 }} />}
                            keyboardDismissMode="interactive"
                        />
                    </View>

                    {/* 3. KEYBOARD STICKY VIEW 
                        This component automatically rides on top of the keyboard.
                        offset: allows you to add spacing between keyboard and input.
                    */}
                    <KeyboardStickyView
                        offset={{ closed: 0, opened: 10 }} // adjust 'opened' if you want more gap above keyboard
                        style={styles.stickyView}
                    >
                        {/* Input Wrapper */}
                        <View style={[
                            styles.inputWrapper,
                            // When keyboard is closed, we need safe area. 
                            // When open, the sticky view handles it, but we keep padding for aesthetics.
                            { paddingBottom: Math.max(insets.bottom, 10) }
                        ]}>
                            <View style={styles.floatingInputBar}>
                                <TextInput
                                    style={styles.input}
                                    value={inputText}
                                    onChangeText={setInputText}
                                    placeholder="Type a message..."
                                    placeholderTextColor="#999"
                                    onSubmitEditing={sendMessage}
                                    returnKeyType="send"
                                    multiline
                                />
                                <MicButton
                                    isRecording={isRecording}
                                    onStartRecording={startRecording}
                                    onStopRecording={stopRecording}
                                    isProcessing={isTranscribing} // Optional
                                />
                                <TouchableOpacity
                                    style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                                    onPress={sendMessage}
                                    disabled={isLoading || !inputText.trim()}
                                >
                                    <Feather name="arrow-up" size={24} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardStickyView>
                </View>
            </KeyboardProvider>
        </View>
    );
}

const markdownStyles = StyleSheet.create({
    body: { fontSize: 16, color: '#1a1a1a', lineHeight: 24, fontFamily: 'System' },
    paragraph: { marginBottom: 10 },
    heading1: { fontSize: 22, fontWeight: '700', marginVertical: 10, color: '#000' },
    heading2: { fontSize: 20, fontWeight: '600', marginVertical: 8, color: '#000' },
    heading3: { fontSize: 18, fontWeight: '600', marginVertical: 6, color: '#000' },
    list_item: { marginBottom: 6 },
    bullet_list_icon: { marginLeft: 0, marginRight: 8, fontSize: 16, color: '#1a1a1a' },
    code_inline: { backgroundColor: '#f0f0f0', padding: 2, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
    code_block: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginVertical: 10, borderWidth: 0 },
    fence: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginVertical: 10, borderWidth: 0 },
    link: { color: '#007AFF', textDecorationLine: 'none' },
    strong: { fontWeight: '700', color: '#000' },
});

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: 'transparent' },
    contentContainer: { flex: 1, backgroundColor: 'transparent' }, // marginTop applied inline to use insets
    header: { position: 'absolute', left: 0, right: 0, zIndex: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
    chatListContent: { paddingBottom: 100 }, // Huge bottom padding to clear the floating input
    messageRow: { flexDirection: 'row', marginBottom: 12, width: '100%' },
    userRow: { justifyContent: 'flex-end', paddingRight: 16 },
    aiRow: { justifyContent: 'flex-start' }, // Padding handled in renderItem
    messageBubble: { padding: 14, borderRadius: 20, maxWidth: '80%', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    userBubble: { backgroundColor: '#000000', borderBottomRightRadius: 4 },
    messageText: { fontSize: 16, lineHeight: 24 },
    userText: { color: '#FFFFFF' },
    loadingContainer: { padding: 10, marginLeft: 16 },

    // Sticky View Styles
    stickyView: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent', // Make sure this is transparent or matches bg
    },
    inputWrapper: {
        width: '100%',
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF', // Background behind the input bar
        paddingTop: 10, // Top spacing for the bar itself
    },
    floatingInputBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        padding: 6,
        paddingLeft: 20,
        width: '100%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
        paddingVertical: 10,
        maxHeight: 100,
        paddingRight: 10
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: { backgroundColor: '#E0E0E0' },
});