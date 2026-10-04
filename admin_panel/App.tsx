import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

// Initialize Firebase before screens load
import './src/core/firebase/firebaseConfig';

import AuthScreen from './src/features/auth/presentation/AuthScreen';
import DashboardScreen from './src/features/pdf-list/presentation/DashboardScreen';
import SummaryScreen from './src/features/summary/presentation/SummaryScreen';
import VocabularyScreen from './src/features/vocabulary/presentation/VocabularyScreen';
import ChatScreen from './src/features/rag-chat/presentation/ChatScreen';

const Stack = createNativeStackNavigator();

export default function App() {
    // null  = still initializing Firebase
    // User  = signed in
    // false = signed out
    const [user, setUser] = useState<FirebaseAuthTypes.User | null | false>(null);

    useEffect(() => {
        // Subscribe to Firebase auth state changes
        const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser ?? false);
        });
        return unsubscribe; // cleanup on unmount
    }, []);

    // Show a splash/loading screen while Firebase resolves the auth state
    if (user === null) {
        return (
            <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color="#38BDF8" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator
                // Route directly based on Firebase auth state
                initialRouteName={user ? 'Dashboard' : 'Auth'}
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#020617' },
                }}
            >
                <Stack.Screen name="Auth" component={AuthScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="Summary" component={SummaryScreen} />
                <Stack.Screen name="Vocabulary" component={VocabularyScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
