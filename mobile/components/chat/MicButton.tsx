import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    cancelAnimation
} from 'react-native-reanimated';

interface MicButtonProps {
    isRecording: boolean;
    onStartRecording: () => void;
    onStopRecording: () => void;
    isProcessing?: boolean;
}

export default function MicButton({ isRecording, onStartRecording, onStopRecording, isProcessing = false }: MicButtonProps) {
    const [duration, setDuration] = useState(0);
    const pulseScale = useSharedValue(1);

    // Timer effect dependent on isRecording prop
    useEffect(() => {
        let interval: any;
        if (isRecording) {
            setDuration(0);
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            setDuration(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording]);

    // Pulsing animation for recording state
    useEffect(() => {
        if (isRecording) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 500 }),
                    withTiming(1, { duration: 500 })
                ),
                -1, // Infinite repeat
                true
            );
        } else {
            cancelAnimation(pulseScale);
            pulseScale.value = withTiming(1, { duration: 200 });
        }
    }, [isRecording]);

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    const handlePress = () => {
        if (isRecording) {
            onStopRecording();
        } else {
            onStartRecording();
        }
    };

    // Formatting 00:00
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (isProcessing) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" color="#9CA3AF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {isRecording && (
                <View style={styles.timerTag}>
                    <Animated.View style={[styles.redDot, { transform: [{ scale: pulseScale.value }] }]} />
                    <Text style={styles.timerText}>{formatTime(duration)}</Text>
                </View>
            )}

            <Animated.View style={isRecording ? animatedButtonStyle : undefined}>
                <TouchableOpacity
                    style={[styles.button, isRecording && styles.recordingButton]}
                    onPress={handlePress}
                    activeOpacity={0.7}
                >
                    <Feather
                        name={isRecording ? "square" : "mic"}
                        size={20}
                        color={isRecording ? "#EF4444" : "#6B7280"}
                    />
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    button: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6', // Light gray default
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingButton: {
        backgroundColor: '#FEE2E2', // Light red bg
    },
    timerTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1F2937',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
    },
    timerText: {
        color: '#FFF',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginLeft: 4,
    },
    redDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EF4444',
    }
});
