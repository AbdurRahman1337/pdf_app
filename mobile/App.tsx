import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Initialize safe Firebase wrapper
import './src/core/firebase/firebaseConfig';
import authService, { AuthUser } from './src/core/auth/authService';
import { ThemeProvider, useTheme } from './src/core/theme/ThemeContext';
import FloatingSettings from './src/core/components/FloatingSettings';
import BottomTabBar, { TabKey } from './src/core/navigation/BottomTabBar';

import AuthScreen from './src/features/auth/presentation/AuthScreen';
import DashboardScreen from './src/features/pdf-list/presentation/DashboardScreen';
import SummaryScreen from './src/features/summary/presentation/SummaryScreen';
import VocabularyScreen from './src/features/vocabulary/presentation/VocabularyScreen';
import QuizScreen from './src/features/quizzes/presentation/QuizScreen';
import ChatScreen from './src/features/rag-chat/presentation/ChatScreen';

function MainApp() {
    const { colors, isDark } = useTheme();

    // Auth State: null = initializing, user = signed in, false = signed out
    const [user, setUser] = useState<AuthUser | null | false>(null);

    // Active Bottom Tab State
    const [activeTab, setActiveTab] = useState<TabKey>('library');

    // Route params passed dynamically between screens
    const [screenParams, setScreenParams] = useState<Record<string, any>>({});

    // Navigation history stack for back button support
    const [navHistory, setNavHistory] = useState<TabKey[]>(['library']);

    useEffect(() => {
        const unsubscribe = authService.onAuthStateChanged((activeUser) => {
            setUser(activeUser ?? false);
        });
        return unsubscribe;
    }, []);

    // Custom navigation prop passed to all screens
    const customNavigation = {
        navigate: (screenName: string, params?: any) => {
            if (params) {
                setScreenParams((prev) => ({ ...prev, [screenName.toLowerCase()]: params }));
            }

            let targetTab: TabKey = 'library';
            switch (screenName.toLowerCase()) {
                case 'dashboard':
                case 'library':
                    targetTab = 'library';
                    break;
                case 'summary':
                case 'audio':
                    targetTab = 'audio';
                    break;
                case 'vocabulary':
                case 'vocab':
                case 'flashcards':
                    targetTab = 'flashcards';
                    break;
                case 'quizzes':
                case 'quiz':
                    targetTab = 'quizzes';
                    break;
                case 'chat':
                case 'tutor':
                    targetTab = 'tutor';
                    break;
            }

            setNavHistory((prev) => [...prev, targetTab]);
            setActiveTab(targetTab);
        },
        goBack: () => {
            if (navHistory.length > 1) {
                const updated = [...navHistory];
                updated.pop(); // remove current
                const previous = updated[updated.length - 1];
                setNavHistory(updated);
                setActiveTab(previous);
            } else {
                setActiveTab('library');
            }
        },
        canGoBack: () => navHistory.length > 1,
        replace: (screenName: string) => {
            if (screenName === 'Auth') {
                setUser(false);
            }
        },
    };

    if (user === null) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (!user) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.bg }}>
                <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
                <AuthScreen navigation={customNavigation} />
                <FloatingSettings />
            </View>
        );
    }

    // Render active screen based on bottom tab
    const renderActiveScreen = () => {
        switch (activeTab) {
            case 'library':
                return (
                    <DashboardScreen
                        navigation={customNavigation}
                        route={{ params: screenParams['library'] || {} }}
                    />
                );
            case 'flashcards':
                return (
                    <VocabularyScreen
                        navigation={customNavigation}
                        route={{
                            params:
                                screenParams['vocabulary'] ||
                                screenParams['flashcards'] ||
                                screenParams['vocab'] ||
                                {},
                        }}
                    />
                );
            case 'audio':
                return (
                    <SummaryScreen
                        navigation={customNavigation}
                        route={{
                            params:
                                screenParams['summary'] ||
                                screenParams['audio'] ||
                                {},
                        }}
                    />
                );
            case 'quizzes':
                return (
                    <QuizScreen
                        navigation={customNavigation}
                        route={{
                            params:
                                screenParams['quizzes'] ||
                                screenParams['quiz'] ||
                                {},
                        }}
                    />
                );
            case 'tutor':
                return (
                    <ChatScreen
                        navigation={customNavigation}
                        route={{
                            params:
                                screenParams['chat'] ||
                                screenParams['tutor'] ||
                                {},
                        }}
                    />
                );
            default:
                return <DashboardScreen navigation={customNavigation} route={{ params: {} }} />;
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />

            {/* Main Active Tab Screen Content */}
            <View style={{ flex: 1 }}>
                {renderActiveScreen()}
            </View>

            {/* Sleek Bottom Navigation Tab Bar */}
            <BottomTabBar
                activeTab={activeTab}
                onSelectTab={(tab) => {
                    setNavHistory((prev) => [...prev, tab]);
                    setActiveTab(tab);
                }}
            />

            {/* Moveable Floating Settings */}
            <FloatingSettings />
        </View>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <MainApp />
        </ThemeProvider>
    );
}
