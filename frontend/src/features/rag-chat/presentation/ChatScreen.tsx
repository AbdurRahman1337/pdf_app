import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { ChevronLeft, Send, Bot, User, BookOpen } from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const ChatScreen = ({ route, navigation }: any) => {
    const { pdfId } = route.params;
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMsg = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await apiClient.post('/ai/query', {
                pdf_id: pdfId,
                question: input,
            });

            const aiMsg = {
                sender: 'ai',
                text: response.data.answer,
                sources: response.data.sources
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            setMessages(prev => [...prev, { sender: 'ai', text: 'Error connecting to RAG engine.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-dark-900 pt-12"
        >
            <View className="flex-row items-center px-6 mb-4">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-dark-800 rounded-full">
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-bold ml-4">RAG Assistant</Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                className="flex-1 px-6"
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                {messages.length === 0 ? (
                    <View className="items-center mt-20 opacity-30">
                        <Bot size={80} color="white" />
                        <Text className="text-white text-center mt-4 text-lg">Ask anything about the document</Text>
                    </View>
                ) : (
                    messages.map((msg, i) => (
                        <View key={i} className={`mb-6 flex-row ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <View className={`max-w-[85%] p-4 rounded-3xl ${msg.sender === 'user' ? 'bg-primary rounded-tr-none' : 'bg-dark-800 rounded-tl-none border border-dark-700'}`}>
                                <Text className={`${msg.sender === 'user' ? 'text-black' : 'text-white'} leading-6`}>
                                    {msg.text}
                                </Text>
                                {msg.sources?.length > 0 && (
                                    <View className="mt-4 pt-4 border-t border-white/10">
                                        <View className="flex-row items-center mb-2">
                                            <BookOpen size={12} color="#94a3b8" />
                                            <Text className="text-gray-400 text-[10px] ml-1 font-bold">CITATIONS</Text>
                                        </View>
                                        {msg.sources.map((s: string, j: number) => (
                                            <Text key={j} className="text-gray-500 text-[10px] mb-1 italic">
                                                • {s.substring(0, 80)}...
                                            </Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    ))
                )}
                {loading && (
                    <View className="flex-row items-center mb-6">
                        <View className="bg-dark-800 p-4 rounded-3xl rounded-tl-none border border-dark-700">
                            <ActivityIndicator size="small" color="#38BDF8" />
                        </View>
                    </View>
                )}
            </ScrollView>

            <View className="p-6 bg-dark-800/50">
                <View className="flex-row items-center bg-dark-800 border border-dark-700 rounded-2xl px-4 py-2">
                    <TextInput
                        className="flex-1 text-white p-2"
                        placeholder="Ask a question..."
                        placeholderTextColor="#64748b"
                        value={input}
                        onChangeText={setInput}
                        multiline
                    />
                    <TouchableOpacity
                        className="bg-primary p-2 rounded-full ml-2"
                        onPress={sendMessage}
                        disabled={loading}
                    >
                        <Send size={20} color="black" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default ChatScreen;
