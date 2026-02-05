import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StrategyMap from '../../components/strategy/StrategyMap';

export default function StrategyScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={[styles.header, { marginTop: Platform.OS === 'android' ? 40 : 10 }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Feather name="arrow-left" size={24} color="#1a1a1a" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Strategy Map</Text>
                        <Text style={styles.headerSubtitle}>Q1 2026 Goals</Text>
                    </View>
                    <TouchableOpacity style={styles.addButton}>
                        <Feather name="plus" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Map Visualization */}
                <View style={styles.mapContainer}>
                    <StrategyMap />
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
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans_700Bold',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans_500Medium',
    },
    mapContainer: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    }
});
