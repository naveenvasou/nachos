import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';

interface GoalNodeProps {
    title: string;
    subtitle?: string;
    status?: 'active' | 'completed' | 'blocked';
    level?: 'objective' | 'key-result' | 'task';
    x?: number;
    y?: number;
    onPress?: () => void;
}

export default function GoalNode({ title, subtitle, status = 'active', level = 'objective', x = 0, y = 0, onPress }: GoalNodeProps) {
    const isObjective = level === 'objective';

    // Position styles if x/y provided
    const positionStyle = {
        left: x,
        top: y,
        position: 'absolute' as 'absolute',
    };

    return (
        <TouchableOpacity
            style={[styles.container, isObjective ? styles.objective : styles.keyResult, positionStyle]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.header}>
                <View style={[styles.statusDot,
                status === 'active' ? styles.active :
                    status === 'completed' ? styles.completed : styles.blocked
                ]} />
                <Text style={styles.levelLabel}>{level.toUpperCase()}</Text>
            </View>

            <Text style={[styles.title, isObjective ? styles.titleLarge : styles.titleSmall]} numberOfLines={2}>
                {title}
            </Text>

            {subtitle && (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            )}

            {/* Connection Point (Visual only) */}
            <View style={styles.connectionPoint} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 16,
        width: 180,
        backgroundColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        zIndex: 10,
    },
    objective: {
        backgroundColor: '#FFFBEB', // Warm yellow/orange tint for top level
        borderColor: '#FCD34D',
    },
    keyResult: {
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    active: { backgroundColor: '#22C55E' },
    completed: { backgroundColor: '#3B82F6' },
    blocked: { backgroundColor: '#EF4444' },
    levelLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    title: {
        color: '#1F2937',
        fontFamily: 'PlusJakartaSans_700Bold',
        marginBottom: 4,
    },
    titleLarge: {
        fontSize: 16,
    },
    titleSmall: {
        fontSize: 14,
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'PlusJakartaSans_500Medium',
    },
    connectionPoint: {
        position: 'absolute',
        bottom: -6,
        left: '50%',
        marginLeft: -6,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#D1D5DB',
        borderWidth: 2,
        borderColor: '#FFF',
    }
});
