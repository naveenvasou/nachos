import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

// Basic configuration for Dev environment
// Using Ngrok for physical device testing
const API_URL = 'https://unsignificantly-logarithmic-deetta.ngrok-free.dev';

export default function MixedFeed() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchTasks();
        }, [])
    );

    const fetchTasks = async () => {
        try {
            const response = await fetch(`${API_URL}/tasks`);
            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();

            // Filter for Today's Tasks
            // Logic: scheduled_date matches "YYYY-MM-DD" or "TODAY"
            const todayStr = new Date().toISOString().split('T')[0];
            const todaysTasks = data.filter((t: any) =>
                t.scheduled_date === todayStr ||
                t.scheduled_date === 'TODAY'
            );

            setTasks(todaysTasks);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTask = async (task: any) => {
        const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';

        // Optimistic Update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

        try {
            const response = await fetch(`${API_URL}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                // Revert if failed
                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
                Alert.alert("Error", "Could not update task status");
            }
        } catch (error) {
            console.error(error);
            // Revert
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
        }
    };

    return (
        <View style={styles.container}>

            {/* 1. The Agenda (Timeline) */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>The Agenda</Text>
                    <TouchableOpacity>
                        <Text style={styles.sectionAction}>See All</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={{ gap: 12 }}>
                    <View style={styles.timelineCard}>
                        <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
                        <Text style={styles.timeText}>09:00 AM</Text>
                        <Text style={styles.eventTitle}>Deep Work</Text>
                    </View>
                    <View style={styles.timelineCard}>
                        <View style={[styles.statusDot, { backgroundColor: '#facc15' }]} />
                        <Text style={styles.timeText}>02:00 PM</Text>
                        <Text style={styles.eventTitle}>Team Sync</Text>
                    </View>
                    <View style={styles.addCard}>
                        <MaterialIcons name="add" size={24} color="#9ca3af" />
                    </View>
                </ScrollView>
            </View>

            {/* 2. Must-Dos (Top 3) */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Today's Tasks</Text>

                {isLoading ? (
                    <Text style={{ color: '#9ca3af', fontFamily: 'PlusJakartaSans_500Medium' }}>Loading tasks...</Text>
                ) : tasks.length === 0 ? (
                    <Text style={{ color: '#9ca3af', fontFamily: 'PlusJakartaSans_500Medium' }}>No tasks scheduled for today. Explore the backlog?</Text>
                ) : (
                    <View style={styles.taskContainer}>
                        {tasks.map((task) => {
                            const isCompleted = task.status === 'DONE';
                            return (
                                <TouchableOpacity
                                    key={task.id}
                                    style={styles.taskRow}
                                    onPress={() => toggleTask(task)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.checkbox, isCompleted && styles.checkboxChecked]}>
                                        {isCompleted && <Feather name="check" size={14} color="#22c55e" />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.taskText, isCompleted && styles.taskTextCompleted]}>
                                            {task.title}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'PlusJakartaSans_500Medium' }}>
                                            {task.priority} Priority
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 24,
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20, // text-xl
        fontFamily: 'PlusJakartaSans_700Bold',
        color: '#111827', // text-cooper-text
    },
    sectionAction: {
        fontSize: 14, // text-sm
        fontFamily: 'PlusJakartaSans_600SemiBold',
        color: '#3b82f6', // text-blue-500
    },
    horizontalScroll: {
        marginLeft: -4, // offset padding
        paddingLeft: 4,
    },
    timelineCard: {
        minWidth: 140,
        backgroundColor: '#FFF',
        borderRadius: 24, // rounded-[1.5rem]
        padding: 16,
        paddingTop: 24,
        borderWidth: 1,
        borderColor: '#f3f4f6', // border-gray-100
        position: 'relative',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03, // shadow-soft
        shadowRadius: 20,
        elevation: 1,
        gap: 4,
    },
    addCard: {
        minWidth: 100,
        backgroundColor: '#f9fafb', // bg-gray-50
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        position: 'absolute',
        top: 16,
        right: 16,
    },
    timeText: {
        fontSize: 12, // text-xs
        fontFamily: 'PlusJakartaSans_500Medium',
        color: '#6b7280', // text-gray-500
        marginTop: 4,
    },
    eventTitle: {
        fontSize: 16, // text-base
        fontFamily: 'PlusJakartaSans_700Bold',
        color: '#111827', // text-cooper-text
    },
    taskContainer: {
        backgroundColor: '#FFF',
        borderRadius: 32, // rounded-[2rem]
        padding: 24, // p-6
        borderWidth: 1,
        borderColor: '#f9fafb', // border-gray-50
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 20,
        elevation: 1,
        gap: 16,
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#d1d5db', // border-gray-300
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        borderColor: 'transparent',
    },
    taskText: {
        fontSize: 15, // text-[15px]
        fontFamily: 'PlusJakartaSans_500Medium',
        color: '#111827', // text-cooper-text
    },
    taskTextCompleted: {
        color: '#9ca3af', // text-gray-400
        textDecorationLine: 'line-through',
    },
});
