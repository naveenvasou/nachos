import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Platform, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeroCard from '../components/home/HeroCard';
import UtilityGrid from '../components/home/UtilityGrid';
import MixedFeed from '../components/home/MixedFeed';
import * as SplashScreen from 'expo-splash-screen';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Helper function for time-based greeting
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
}

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const [refreshing, setRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Dynamic greeting based on time of day
    const greeting = useMemo(() => getGreeting(), []);

    let [fontsLoaded] = useFonts({
        PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold,
    });

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    // Pull-to-refresh handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // Trigger re-render of child components by updating key
        setRefreshKey(prev => prev + 1);
        // Simulate network delay
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    }, []);

    if (!fontsLoaded) {
        return null;
    }

    return (
        <View style={styles.wallpaperContainer}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <View style={[styles.cardContainer, { marginTop: insets.top }]}>
                <View style={styles.contentContainer}>
                    {/* Main Content Scroll */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor="#000"
                                colors={['#000']}
                            />
                        }
                    >
                        {/* Header - Moved inside ScrollView */}
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.greeting}>{greeting}</Text>
                                <Text style={styles.userName}>Naveen</Text>
                            </View>
                            <TouchableOpacity>
                                <View style={styles.avatarContainer}>
                                    <Text style={styles.avatarText}>N</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Hero Section - AI Brief */}
                        <HeroCard />

                        {/* Utility Grid - Core Actions */}
                        <UtilityGrid />

                        {/* Feed - The Agenda/Tasks */}
                        <MixedFeed key={refreshKey} />

                        <View style={{ height: 100 }} /> {/* Spacer for Floating Bar */}

                    </ScrollView>

                    {/* Floating Action Bar */}
                    <View style={styles.floatingBarWrapper}>
                        <View style={styles.floatingBar}>
                            <Text style={styles.floatingBarText}>Active Session</Text>
                            <View style={styles.floatingActions}>
                                <TouchableOpacity style={styles.floatingBtnSmall}>
                                    <MaterialIcons name="add" size={20} color="#FFF" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.floatingBtnLarge}>
                                    <MaterialIcons name="play-arrow" size={20} color="#000" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wallpaperContainer: {
        flex: 1,
        backgroundColor: '#f7f8f9', // Outer background (Wallpaper)
    },
    safeArea: {
        flex: 1,
    },
    cardContainer: {
        flex: 1,
        backgroundColor: '#fdfbff', // Inner Card Background
        marginTop: 20, // Margin from actual top
        borderTopLeftRadius: 40, // Curved Top
        borderTopRightRadius: 40,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)', // Glass border effect
        // Shadow for the card
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: 32, // More spacing inside the card
        marginBottom: 24,
    },
    greeting: {
        fontSize: 14,
        color: '#6b7280', // text-cooper-muted
        fontFamily: 'PlusJakartaSans_500Medium',
        marginBottom: 2,
    },
    userName: {
        fontSize: 30, // text-3xl
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        color: '#111827', // text-cooper-text
        letterSpacing: -0.5, // tracking-tight
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20, // rounded-full
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans_700Bold',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    floatingBarWrapper: {
        position: 'absolute',
        bottom: 24,
        left: 24,
        right: 24,
        zIndex: 50,
    },
    floatingBar: {
        backgroundColor: '#000',
        height: 64,
        borderRadius: 9999, // rounded-full
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 24,
        paddingRight: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08, // shadow-floating
        shadowRadius: 40,
        elevation: 10,
    },
    floatingBarText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans_500Medium',
    },
    floatingActions: {
        flexDirection: 'row',
        gap: 8,
    },
    floatingBtnSmall: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingBtnLarge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    }
});
