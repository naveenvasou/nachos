import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
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

// AUDIO STREAMING
import { KeyboardProvider, KeyboardStickyView } from 'react-native-keyboard-controller';
import LiveAudioStream from 'react-native-live-audio-stream';
import { Audio } from 'expo-av';

// Centralized API config
import { API_URL, getWsUrl } from '../constants/api';

const STORAGE_KEY = 'cooper_chat_history_v1';
const HEADER_HEIGHT = 60;

interface Message {
    id: string;
    sender: 'ai' | 'user';
    text: string;
}

// Styles moved above components so they can be referenced by memoized components
const markdownStyles = StyleSheet.create({
    body: { fontSize: 16, color: '#1a1a1a', lineHeight: 24, fontFamily: 'System' },
    paragraph: { marginBottom: 10 },
    heading1: { fontSize: 22, fontWeight: '700', marginVertical: 10, color: '#000' },
    heading2: { fontSize: 20, fontWeight: '600', marginVertical: 8, color: '#000' },
    heading3: { fontSize: 18, fontWeight: '600', marginVertical: 6, color: '#000' },
    list_item: { marginBottom: 6 },
    bullet_list_icon: { marginLeft: 0, marginRight: 8, fontSize: 16, color: '#1a1a1a' },
    code_inline: {
        backgroundColor: '#f0f0f0',
        padding: 2,
        borderRadius: 4,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 14
    },
    code_block: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginVertical: 10, borderWidth: 0 },
    fence: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginVertical: 10, borderWidth: 0 },
    link: { color: '#007AFF', textDecorationLine: 'none' },
    strong: { fontWeight: '700', color: '#000' },
});

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: 'transparent' },
    contentContainer: { flex: 1, backgroundColor: 'transparent' },
    header: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
    chatListContent: { paddingBottom: 100 },
    messageRow: { flexDirection: 'row', marginBottom: 12, width: '100%' },
    userRow: { justifyContent: 'flex-end', paddingRight: 16 },
    aiRow: { justifyContent: 'flex-start' },
    messageBubble: {
        padding: 14,
        borderRadius: 20,
        maxWidth: '80%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
    },
    userBubble: { backgroundColor: '#000000', borderBottomRightRadius: 4 },
    messageText: { fontSize: 16, lineHeight: 24 },
    userText: { color: '#FFFFFF' },
    loadingContainer: { padding: 10, marginLeft: 16 },
    stickyView: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
    },
    inputWrapper: {
        width: '100%',
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF',
        paddingTop: 10,
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

// Memoized message component to prevent re-renders
const MessageItem = memo(({ item }: { item: Message }) => {
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

    return (
        <View style={[styles.messageRow, styles.aiRow, { paddingLeft: 16, paddingRight: 16, paddingVertical: 8 }]}>
            <Markdown style={markdownStyles}>
                {item.text}
            </Markdown>
        </View>
    );
});

export default function ChatScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [bottomPadding, setBottomPadding] = useState(100 + insets.bottom);

    const socketRef = useRef<WebSocket | null>(null);
    const audioListenerRef = useRef<any>(null);

    useEffect(() => { loadHistory(); }, []);

    // Handle Keyboard Height & Auto-Scroll
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = Keyboard.addListener(showEvent, (e) => {
            const keyboardHeight = e.endCoordinates.height;
            setBottomPadding(keyboardHeight + 80);
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        });

        const onHide = Keyboard.addListener(hideEvent, () => {
            setBottomPadding(100 + insets.bottom);
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
            console.log("Fetching history from server...");
            const response = await fetch(`${API_URL}/chat/history`);

            if (response.ok) {
                const serverData = await response.json();
                const formattedMessages: Message[] = serverData.map((msg: any) => ({
                    id: msg.id.toString(),
                    sender: msg.role === 'user' ? 'user' : 'ai',
                    text: msg.content || (msg.tool_calls ? '🛠️ (Cooper updated the database)' : '')
                })).filter((m: Message) => m.text);

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
            else setMessages([]);
        }
    };

    // Setup Audio on Mount
    useEffect(() => {
        const setupAudio = async () => {
            try {
                // Request microphone permissions using expo-av
                const { status } = await Audio.requestPermissionsAsync();
                if (status !== 'granted') {
                    console.warn("Microphone permission denied");
                    return;
                }

                // Configure LiveAudioStream
                LiveAudioStream.init({
                    sampleRate: 16000,
                    channels: 1,
                    bitsPerSample: 16,
                    audioSource: 6, // VOICE_RECOGNITION
                    bufferSize: 4096
                });

                console.log("Audio setup complete");
            } catch (err) {
                console.error("Failed to setup audio:", err);
            }
        };

        setupAudio();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
            if (audioListenerRef.current) {
                LiveAudioStream.stop();
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            setIsRecording(true);
            const baseText = inputText || '';

            // Connect WebSocket
            const wsUrl = getWsUrl() + '/ws/transcribe';
            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;

            ws.onopen = () => {
                console.log("WebSocket connected for transcription");
            };

            // Track committed text for this session
            let sessionCommittedText = '';

            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);

                    if (data.is_final) {
                        sessionCommittedText += (sessionCommittedText ? " " : "") + data.text;
                        setInputText(baseText + (baseText ? " " : "") + sessionCommittedText);
                    } else if (data.text) {
                        const interim = data.text;
                        const fullText = baseText +
                            (baseText ? " " : "") +
                            sessionCommittedText +
                            (sessionCommittedText ? " " : "") +
                            interim;
                        setInputText(fullText);
                    }
                } catch (err) {
                    console.error("WS Msg Error", err);
                }
            };

            ws.onerror = (e: any) => console.log("WS Error", e.message);

            // Listen for audio data from LiveAudioStream
            audioListenerRef.current = LiveAudioStream.on('data', (data: string) => {
                if (ws.readyState === WebSocket.OPEN) {
                    // data is already base64 encoded PCM from LiveAudioStream
                    ws.send(data);
                }
            });

            // Start streaming
            LiveAudioStream.start();
            console.log("Recording started");

        } catch (e) {
            console.error("Failed to start recording stream", e);
            setIsRecording(false);
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        LiveAudioStream.stop();

        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        if (audioListenerRef.current) {
            audioListenerRef.current = null;
        }

        console.log("Recording stopped");
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

        const es = new EventSource(`${API_URL}/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: currentInput })
        });

        es.addEventListener('message', (event: any) => {
            try {
                const data = JSON.parse(event.data);
                if (data.token) {
                    fullText += data.token;
                    setMessages(prev => prev.map(msg =>
                        msg.id === aiMsgId ? { ...msg, text: fullText } : msg
                    ));
                }
                if (data.done) {
                    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([
                        ...updatedWithUser,
                        { id: aiMsgId, sender: 'ai', text: fullText }
                    ]));
                    setIsLoading(false);
                    es.close();
                }
            } catch (e) {
                console.error(e);
            }
        });

        es.addEventListener('error', () => {
            setIsLoading(false);
            es.close();
        });
    };

    useEffect(() => {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages, isLoading]);

    // Memoized render function to prevent re-renders
    const renderItem = useCallback(({ item }: { item: Message }) => (
        <MessageItem item={item} />
    ), []);

    return (
        <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
            <KeyboardProvider>
                <View style={styles.mainContainer}>
                    {/* Header */}
                    <View style={[styles.header, { top: insets.top, height: HEADER_HEIGHT }]}>
                        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
                            <Feather name="arrow-left" size={24} color="#1a1a1a" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Cooper</Text>
                        <TouchableOpacity style={styles.iconButton}>
                            <Feather name="more-horizontal" size={24} color="#1a1a1a" />
                        </TouchableOpacity>
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
                            contentContainerStyle={[styles.chatListContent, { paddingBottom: bottomPadding }]}
                            ListFooterComponent={
                                isLoading ?
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color="#007AFF" />
                                    </View> :
                                    <View style={{ height: 20 }} />
                            }
                            keyboardDismissMode="interactive"
                        />
                    </View>

                    <KeyboardStickyView
                        offset={{ closed: 0, opened: 10 }}
                        style={styles.stickyView}
                    >
                        <View style={[
                            styles.inputWrapper,
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
                                    isProcessing={isTranscribing}
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
