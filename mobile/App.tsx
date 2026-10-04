import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Initialize safe Firebase wrapper
import './src/core/firebase/firebaseConfig';
import authService, { AuthUser } from './src/core/auth/authService';
import { ThemeProvider, useTheme } from './src/core/theme/ThemeContext';
import FloatingSettings from './src/core/components/FloatingSettings';
import BottomTabBar, { TabKey } from './src/core/navigation/BottomTabBar';

import AuthScreen from './src/features/auth/presentation/AuthScreen';
import DashboardScreen from './src/features/pdf-list/presentation/DashboardScreen';
import CourseHubScreen from './src/features/courses/presentation/CourseHubScreen';
import ExamPrepScreen from './src/features/exam-prep/presentation/ExamPrepScreen';
import SummaryScreen from './src/features/summary/presentation/SummaryScreen';
import VocabularyScreen from './src/features/vocabulary/presentation/VocabularyScreen';
import QuizScreen from './src/features/quizzes/presentation/QuizScreen';
import ChatScreen from './src/features/rag-chat/presentation/ChatScreen';

export type ScreenRoute = {
    name: 'library' | 'courses' | 'test' | 'tutor' | 'summary' | 'vocabulary' | 'quizzes';
    params?: any;
};

function MainApp() {
    const { colors, isDark } = useTheme();

    // Auth State: null = initializing, user = signed in, false = signed out
    const [user, setUser] = useState<AuthUser | null | false>(null);

    // Active Bottom Tab (for tab bar highlight)
    const [activeTab, setActiveTab] = useState<TabKey>('library');

    // Navigation Stack (supports deep push & pop back to library/courses)
    const [navStack, setNavStack] = useState<ScreenRoute[]>([{ name: 'library', params: {} }]);

    useEffect(() => {
        const unsubscribe = authService.onAuthStateChanged((activeUser) => {
            setUser(activeUser ?? false);
        });
        return unsubscribe;
    }, []);

    const currentScreen = navStack[navStack.length - 1] || { name: 'library', params: {} };

    // Custom navigation controller passed to all screens
    const customNavigation = {
        navigate: (screenName: string, params?: any) => {
            const normalized = screenName.toLowerCase();
            let targetRoute: ScreenRoute;

            switch (normalized) {
                case 'dashboard':
                case 'library':
                    targetRoute = { name: 'library', params: params || {} };
                    setActiveTab('library');
                    break;
                case 'coursehub':
                case 'courses':
                case 'course':
                    targetRoute = { name: 'courses', params: params || {} };
                    setActiveTab('courses');
                    break;
                case 'examprep':
                case 'test':
                case 'tests':
                case 'exam':
                    targetRoute = { name: 'test', params: params || {} };
                    setActiveTab('test');
                    break;
                case 'chat':
                case 'tutor':
                    targetRoute = { name: 'tutor', params: params || {} };
                    setActiveTab('tutor');
                    break;
                case 'summary':
                case 'audio':
                    targetRoute = { name: 'summary', params: params || {} };
                    break;
                case 'vocabulary':
                case 'vocab':
                case 'flashcards':
                    targetRoute = { name: 'vocabulary', params: params || {} };
                    break;
                case 'quizzes':
                case 'quiz':
                    targetRoute = { name: 'quizzes', params: params || {} };
                    break;
                default:
                    targetRoute = { name: 'library', params: params || {} };
                    setActiveTab('library');
                    break;
            }

            setNavStack((prev) => [...prev, targetRoute]);
        },
        goBack: () => {
            if (navStack.length > 1) {
                setNavStack((prev) => {
                    const next = [...prev];
                    next.pop();
                    const newTop = next[next.length - 1];
                    if (['library', 'courses', 'test', 'tutor'].includes(newTop.name)) {
                        setActiveTab(newTop.name as TabKey);
                    }
                    return next;
                });
            } else {
                setNavStack([{ name: 'library', params: {} }]);
                setActiveTab('library');
            }
        },
        canGoBack: () => {
            return navStack.length > 1 || ['summary', 'vocabulary', 'quizzes'].includes(currentScreen.name);
        },
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

    // Determine whether to show bottom tab bar (hide on dedicated full-screen study modes for maximum focus)
    const isStackStudyScreen = ['summary', 'vocabulary', 'quizzes'].includes(currentScreen.name);

    // Render active screen
    const renderActiveScreen = () => {
        switch (currentScreen.name) {
            case 'library':
                return <DashboardScreen navigation={customNavigation} route={{ params: currentScreen.params || {} }} />;
            case 'courses':
                return <CourseHubScreen navigation={customNavigation} route={{ params: currentScreen.params || {} }} />;
            case 'test':
                return <ExamPrepScreen navigation={customNavigation} route={{ params: currentScreen.params || {} }} />;
            case 'tutor':
                return <ChatScreen navigation={customNavigation} route={{ params: currentScreen.params || {} }} />;
            case 'summary':
                return <SummaryScreen navigation={customNavigation} route={{ params: currentScreen.params || {} }} />;
            case 'vocabulary':
                return <VocabularyScreen navigation={customNavigation} route={{ params: currentScreen.params || {} }} />;
            case 'quizzes':
                return <QuizScreen navigation={customNavigation} route={{ params: currentScreen.params || {} }} />;
            default:
                return <DashboardScreen navigation={customNavigation} route={{ params: {} }} />;
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />

            {/* Main Active Screen Content */}
            <View style={{ flex: 1 }}>
                {renderActiveScreen()}
            </View>

            {/* Sleek Bottom Navigation Tab Bar (Shown on main tabs) */}
            {!isStackStudyScreen && (
                <BottomTabBar
                    activeTab={activeTab}
                    onSelectTab={(tab) => {
                        setActiveTab(tab);
                        setNavStack([{ name: tab, params: {} }]);
                    }}
                />
            )}

            {/* Moveable Floating Settings */}
            <FloatingSettings />
        </View>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <MainApp />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
