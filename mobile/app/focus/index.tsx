import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CircularTimer from '../../components/focus/CircularTimer';
import FocusControls from '../../components/focus/FocusControls';

export default function FocusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Timer State
    const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
    const [isActive, setIsActive] = useState(false);
    const DURATION = 25 * 60;

    // Timer Logic
    useEffect(() => {
        let interval: any;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    const handleToggle = () => setIsActive(!isActive);
    const handleReset = () => {
        setIsActive(false);
        setTimeLeft(DURATION);
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={[styles.header, { marginTop: Platform.OS === 'android' ? 40 : 10 }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Feather name="arrow-left" size={24} color="#1a1a1a" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Deep Focus</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Main Content */}
                <View style={styles.content}>

                    {/* Task Label */}
                    <View style={styles.taskContainer}>
                        <Text style={styles.taskLabel}>CURRENT OBJECTIVE</Text>
                        <Text style={styles.taskTitle}>Refactor Navigation</Text>
                    </View>

                    {/* Timer */}
                    <View style={styles.timerWrapper}>
                        <CircularTimer
                            duration={DURATION}
                            timeLeft={timeLeft}
                            isActive={isActive}
                        />
                    </View>

                    {/* Controls */}
                    <FocusControls
                        isActive={isActive}
                        onToggle={handleToggle}
                        onReset={handleReset}
                    />

                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        fontFamily: 'PlusJakartaSans_700Bold',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center', // Centered vertically
        paddingBottom: 80, // Offset for visual balance
    },
    taskContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    taskLabel: {
        fontSize: 12,
        letterSpacing: 1.5,
        color: '#888',
        fontWeight: '600',
        marginBottom: 8,
        fontFamily: 'PlusJakartaSans_600SemiBold',
    },
    taskTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        fontFamily: 'PlusJakartaSans_800ExtraBold',
    },
    timerWrapper: {
        marginBottom: 20,
    }
});
