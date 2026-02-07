import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { ChoiceCard } from '@/components/ChoiceCard';
import { ContractCard } from '@/components/ContractCard';

const API_URL = "https://nachos-backend-728473520070.us-central1.run.app";

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text?: string;
  uiType?: 'choice' | 'contract';
  uiData?: any;
}

export default function HomeScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: "Hi. I'm Nachos. What is the single most important project you want to complete right now?", sender: 'ai' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const callBackend = async (endpoint: string, payload: any) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Backend Error:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    // 1. Add User Message
    const userMsg: Message = { id: Date.now().toString(), text: inputText, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    // Store original input for potential use
    const userInput = inputText;
    setInputText('');

    // 2. Call Backend (Simulating State Machine for MVP)
    // In a real app, the backend would manage the state and return the UI directive directly.
    // For Phase 1, we still mock the "Decision Logic" on client, but we could ask LLM to format it.

    // Flow: Goal -> Choice Card (Constraint)
    if (messages.length === 1) {
      // This is the first response (Goal Set)
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          text: "Got it. When do you want this done by?",
          uiType: 'choice',
          uiData: {
            question: "Select a realistic deadline:",
            options: ["Next Month", "3 Months", "End of Year"]
          }
        }]);
      }, 600);
    }
  };

  const handleChoiceSelect = (option: string) => {
    const userMsg: Message = { id: Date.now().toString(), text: option, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);

    // Flow: Choice -> Contract
    // We capture the "Goal" from the very first user message for the contract
    const goalTitle = messages.find(m => m.sender === 'user')?.text || "Project";

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'ai',
        uiType: 'contract',
        uiData: {
          goalTitle: goalTitle,
          constraint: option
        }
      }]);
    }, 800);
  };

  const handleCommit = async () => {
    // Commit -> Send to Backend to "Plan"
    const goalTitle = messages.find(m => m.sender === 'user')?.text;
    const constraint = messages.slice().reverse().find(m => m.sender === 'user')?.text; // Last user message was constraint

    setMessages(prev => [...prev, {
      id: Date.now().toString() + "_thinking",
      sender: 'ai',
      text: "Designing your strategy..."
    }]);

    // Real Backend Call to Generate Plan
    const result = await callBackend('/plan', {
      user_context: `Constraint: ${constraint}`,
      goals: [{ title: goalTitle, category: "Primary", deadline: constraint }]
    });

    if (result && result.plan) {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.id.includes("_thinking"));
        return [...filtered, {
          id: Date.now().toString(),
          sender: 'ai',
          text: result.plan // Display the AI Plan
        }];
      });
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    if (item.sender === 'user') {
      return (
        <View style={[styles.messageBubble, styles.userBubble]}>
          <Text style={styles.userMessageText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <View style={styles.aiContainer}>
        {item.text && (
          <View style={[styles.messageBubble, styles.aiBubble]}>
            <Text style={styles.aiMessageText}>{item.text}</Text>
          </View>
        )}
        {item.uiType === 'choice' && (
          <ChoiceCard
            question={item.uiData.question}
            options={item.uiData.options}
            onSelect={handleChoiceSelect}
          />
        )}
        {item.uiType === 'contract' && (
          <ContractCard
            goalTitle={item.uiData.goalTitle}
            constraint={item.uiData.constraint}
            onCommit={handleCommit}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NACHOS</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatContainer}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="What's the mission?"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS Light Gray
  },
  header: {
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // Glassmorphism Header
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    backdropFilter: 'blur(10px)', // Web only support, useful for mental model 
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#000',
  },
  chatContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  aiContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 20,
    marginBottom: 8,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#000',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    marginBottom: 16,
  },
  aiMessageText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  userMessageText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 16,
    color: '#000',
  },
  sendButton: {
    backgroundColor: '#000',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
});
