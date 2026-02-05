import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface ContractCardProps {
    goalTitle: string;
    constraint: string;
    onCommit: () => void;
}

export const ContractCard: React.FC<ContractCardProps> = ({ goalTitle, constraint, onCommit }) => {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.headerText}>COMMITMENT CONTRACT</Text>
            </View>
            <View style={styles.body}>
                <Text style={styles.label}>GOAL</Text>
                <Text style={styles.value}>{goalTitle}</Text>

                <Text style={styles.label}>CONSTRAINT</Text>
                <Text style={styles.value}>{constraint}</Text>

                <Text style={styles.disclaimer}>
                    I promise to show up and execute. No excuses.
                </Text>

                <TouchableOpacity style={styles.commitButton} onPress={onCommit}>
                    <Text style={styles.commitText}>I COMMIT</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        alignSelf: 'flex-start',
        maxWidth: '85%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#000',
    },
    header: {
        backgroundColor: '#000',
        padding: 12,
        alignItems: 'center',
    },
    headerText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
        letterSpacing: 1,
    },
    body: {
        padding: 16,
    },
    label: {
        fontSize: 10,
        color: '#666',
        marginBottom: 4,
        fontWeight: '600',
    },
    value: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#000',
    },
    disclaimer: {
        fontSize: 12,
        fontStyle: 'italic',
        color: '#666',
        marginBottom: 16,
        textAlign: 'center',
    },
    commitButton: {
        backgroundColor: '#000',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    commitText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
