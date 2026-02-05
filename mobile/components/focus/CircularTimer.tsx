import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing, withRepeat } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const SIZE = width * 0.7;
const STROKE_WIDTH = 20;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularTimerProps {
    duration: number; // in seconds
    timeLeft: number; // in seconds
    isActive: boolean;
}

export default function CircularTimer({ duration, timeLeft, isActive }: CircularTimerProps) {
    const progress = useSharedValue(0);

    useEffect(() => {
        // Calculate progress (0 to 1) based on time left
        // 1 means full circle (start), 0 means empty (end)
        const targetProgress = timeLeft / duration;
        progress.value = withTiming(targetProgress, {
            duration: 1000,
            easing: Easing.linear
        });
    }, [timeLeft, duration]);

    const animatedProps = useAnimatedProps(() => {
        const strokeDashoffset = CIRCUMFERENCE * (1 - progress.value);
        return {
            strokeDashoffset,
        };
    });

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View style={styles.container}>
            {/* Rotated Container for -90deg start position */}
            <View style={styles.svgContainer}>
                <Svg width={SIZE} height={SIZE}>
                    {/* Background Track */}
                    <Circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke="#F3F4F6" // Light gray track
                        strokeWidth={STROKE_WIDTH}
                        fill="transparent"
                    />
                    {/* Animated Progress */}
                    <AnimatedCircle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke="#8B5CF6" // Purple Progress
                        strokeWidth={STROKE_WIDTH}
                        fill="transparent"
                        strokeDasharray={CIRCUMFERENCE}
                        animatedProps={animatedProps}
                        strokeLinecap="round"
                    />
                </Svg>
            </View>

            {/* Time Text Overlay (Not Rotated) */}
            <View style={styles.textContainer}>
                <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
                <Text style={styles.statusText}>{isActive ? 'FOCUSING' : 'PAUSED'}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        width: SIZE,
        height: SIZE,
    },
    svgContainer: {
        transform: [{ rotate: '-90deg' }], // Rotate entire SVG container
        width: SIZE,
        height: SIZE,
    },
    textContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#1a1a1a',
        fontFamily: 'PlusJakartaSans_800ExtraBold',
    },
    statusText: {
        fontSize: 14,
        marginTop: 8,
        letterSpacing: 2,
        color: '#666',
        fontFamily: 'PlusJakartaSans_600SemiBold',
    },
});
