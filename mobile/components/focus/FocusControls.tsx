import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';

interface FocusControlsProps {
    isActive: boolean;
    onToggle: () => void;
    onReset: () => void;
}

export default function FocusControls({ isActive, onToggle, onReset }: FocusControlsProps) {
    return (
        <View style={styles.container}>
            {/* Reset / Stop Button */}
            <TouchableOpacity style={styles.secondaryButton} onPress={onReset}>
                <Feather name="square" size={24} color="#666" />
            </TouchableOpacity>

            {/* Play / Pause Main Button */}
            <TouchableOpacity style={styles.primaryButton} onPress={onToggle}>
                <MaterialIcons
                    name={isActive ? "pause" : "play-arrow"}
                    size={40}
                    color="#FFF"
                />
            </TouchableOpacity>

            {/* Settings (Placeholder) */}
            <TouchableOpacity style={styles.secondaryButton}>
                <Feather name="settings" size={24} color="#666" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        marginTop: 40,
    },
    primaryButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#8B5CF6', // Purple
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#8B5CF6",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    secondaryButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
