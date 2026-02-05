import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path, Text as SvgText, TextPath, Defs } from 'react-native-svg';

export default function HeroCard() {
    return (
        <View style={styles.container}>

            {/* Content Header */}
            <View style={styles.headerRow}>
                <View style={styles.dateBadge}>
                    <MaterialIcons name="calendar-today" size={16} color="#4b5563" />
                    <Text style={styles.dateText}>8 June</Text>
                </View>
                <View style={styles.reportBadge}>
                    <Text style={styles.reportText}>AI-REPORT</Text>
                </View>
            </View>

            {/* Main Text */}
            <View style={styles.textContent}>
                <Text style={styles.subLabel}>TODAY'S AI ANALYSIS</Text>
                <Text style={styles.mainTitle}>
                    You Have 8 Tasks <Text style={styles.highlightText}>Urgent</Text> For Today.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#efe9ff', // Matches HTML bg-[#efe9ff]
        borderRadius: 32, // rounded-[2rem]
        padding: 24, // p-6
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    waveContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 256,
        opacity: 0.6,
    },
    waveGradient: {
        flex: 1,
        // React Native doesn't support radial-gradient directly comfortably without library, 
        // using solid fallback transparency for now or expo-linear-gradient if needed.
        // For simplicity and performance, a subtle background color shift:
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderBottomRightRadius: 100,
        transform: [{ scale: 1.5 }],
    },
    svgContainer: {
        position: 'absolute',
        top: 16,
        right: -20,
        transform: [{ rotate: '12deg' }],
        opacity: 0.1,
    },
    blurCircle: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255,255,255,0.4)',
        // Blur requires Expo BlurView, simulating with opacity overlay
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        zIndex: 10,
    },
    dateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateText: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 14,
        color: '#1f1f1f',
    },
    reportBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999, // full
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderColor: '#2dd4bf', // teal-400
        borderWidth: 1,
    },
    reportText: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 10, // text-xs
        color: '#0f766e', // teal-700
        letterSpacing: 0.5,
    },
    textContent: {
        zIndex: 10,
        marginTop: 16,
        
    },
    subLabel: {
        fontFamily: 'PlusJakartaSans_600SemiBold',
        fontSize: 12, // text-xs
        color: 'rgba(31,31,31,0.6)', // text-cooper-text/60
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    mainTitle: {
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        fontSize: 30, // text-[2rem]
        lineHeight: 34, // leading-[1.1]
        color: '#1f1f1f',
    },
    highlightText: {
        color: '#9333ea', // purple-600
    },
});
