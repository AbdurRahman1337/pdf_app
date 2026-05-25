import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import auth from '@react-native-firebase/auth';
import analytics from '@react-native-firebase/analytics';
import AuthScreen from './src/features/auth/presentation/AuthScreen';
import DashboardScreen from './src/features/pdf-list/presentation/DashboardScreen';
import SummaryScreen from './src/features/summary/presentation/SummaryScreen';
import VocabularyScreen from './src/features/vocabulary/presentation/VocabularyScreen';
import ChatScreen from './src/features/rag-chat/presentation/ChatScreen';

const Stack = createStackNavigator();

export default function App() {
    return (
        <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator
                initialRouteName="Auth"
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: '#020617' }
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
