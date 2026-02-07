import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const gap = 16; // gap-4 (16px)
const padding = 24; // px-6 (24px)
const availableWidth = width - (padding * 2) - gap;
const smallCardWidth = availableWidth / 2;

export default function UtilityGrid() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            {/* ROW 1: Talk with Cooper (Blue) */}
            <TouchableOpacity
                style={styles.bigCard}
                onPress={() => router.push('/chat')}
            >
                <View style={[styles.iconCircle, styles.iconBlue]}>
                    <MaterialIcons name="mic" size={24} color="#3b82f6" />
                </View>
                <View>
                    <Text style={styles.cardTitleBlue}>Talk with Cooper</Text>
                    <Text style={styles.cardSubtitleBlue}>Let's prioritize.</Text>
                </View>
            </TouchableOpacity>

            {/* ROW 2: Two Small Cards */}
            <View style={styles.row}>
                {/* Focus Mode (Purple) */}
                <TouchableOpacity
                    style={[styles.smallCard, styles.cardFocus]}
                    onPress={() => router.push('/focus' as any)}
                >
                    <View style={[styles.iconCircle, styles.iconFocus]}>
                        <MaterialIcons name="center-focus-strong" size={24} color="#362e29" />
                    </View>
                    <Text style={styles.cardTitleFocus}>Focus Mode</Text>
                </TouchableOpacity>

                {/* Strategize (Yellow/Orange) */}
                <TouchableOpacity
                    style={[styles.smallCard, styles.cardStrategize]}
                    onPress={() => router.push('/strategy' as any)}
                >
                    <View style={[styles.iconCircle, styles.iconStrategize]}>
                        <MaterialIcons name="map" size={24} color="#fff" />
                    </View>
                    <Text style={styles.cardTitleStrategize}>Strategize</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 32,
        gap: 16,
    },
    row: {
        flexDirection: 'row',
        gap: 16,
    },
    bigCard: {
        width: '100%',
        backgroundColor: '#e1f0fe',
        borderRadius: 32,
        padding: 20,
        justifyContent: 'center',
    },
    smallCard: {
        flex: 1,
        height: 140,
        borderRadius: 32,
        padding: 20,
        justifyContent: 'center',
    },
    cardFocus: {
        backgroundColor: '#ffecba',
    },
    cardStrategize: {
        backgroundColor: '#25262a',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconBlue: {
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    iconFocus: {
        backgroundColor: '#fdf2d4',
    },
    iconStrategize: {
        backgroundColor: '#3a3b3f',
    },
    cardTitleBlue: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans_700Bold',
        color: '#1e3a8a',
        marginBottom: 4,
    },
    cardSubtitleBlue: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans_500Medium',
        color: 'rgba(30,58,138,0.6)',
    },
    cardTitleFocus: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans_700Bold',
        color: '#362e29',
    },
    cardTitleStrategize: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans_700Bold',
        color: '#fff',
    },
});
