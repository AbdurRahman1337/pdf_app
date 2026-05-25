import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../../core/network/apiClient';
import { FilePdf } from 'lucide-react-native';

const AuthScreen = ({ navigation }: any) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async () => {
        if (!email || !password) return;
        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                const formData = new FormData();
                formData.append('username', email);
                formData.append('password', password);

                const response = await apiClient.post('/auth/login', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                await AsyncStorage.setItem('access_token', response.data.access_token);
                navigation.replace('Dashboard');
            } else {
                await apiClient.post('/auth/register', { email, password });
                setIsLogin(true);
                alert('Registration successful! Please login.');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-dark-900 justify-center px-8">
            <View className="items-center mb-10">
                <View className="bg-primary/10 p-6 rounded-full mb-4">
                    <FilePdf size={60} color="#38BDF8" />
                </View>
                <Text className="text-white text-3xl font-bold">PDF AI Assistant</Text>
                <Text className="text-gray-400 text-center mt-2">
                    Enterprise Summarization & RAG Engine
                </Text>
            </View>

            {error ? (
                <View className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg mb-6">
                    <Text className="text-red-500 text-center">{error}</Text>
                </View>
            ) : null}

            <View className="space-y-4">
                <View>
                    <Text className="text-gray-400 mb-2 ml-1">Email Address</Text>
                    <TextInput
                        className="bg-dark-800 border border-dark-700 text-white p-4 rounded-xl"
                        placeholder="name@company.com"
                        placeholderTextColor="#64748b"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                    />
                </View>

                <View>
                    <Text className="text-gray-400 mb-2 ml-1">Password</Text>
                    <TextInput
                        className="bg-dark-800 border border-dark-700 text-white p-4 rounded-xl"
                        placeholder="••••••••"
                        placeholderTextColor="#64748b"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    className="bg-primary p-4 rounded-xl mt-4 items-center"
                    onPress={handleAuth}
                    disabled={loading}
                    style={{ opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? (
                        <ActivityIndicator color="black" />
                    ) : (
                        <Text className="text-black font-bold text-lg">{isLogin ? 'Sign In' : 'Sign Up'}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsLogin(!isLogin)} className="items-center mt-4">
                    <Text className="text-primary font-medium">
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

export default AuthScreen;
