import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { ChevronLeft, Send, Bot, BookOpen } from 'lucide-react-native';
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
            style={styles.container}
        >
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>RAG Assistant</Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                style={styles.messageList}
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Bot size={80} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.emptyText}>Ask anything about the document</Text>
                    </View>
                ) : (
                    messages.map((msg, i) => (
                        <View key={i} style={[styles.messageRow, { justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }]}>
                            <View style={[styles.bubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                                <Text style={[styles.bubbleText, { color: msg.sender === 'user' ? '#000000' : '#ffffff' }]}>
                                    {msg.text}
                                </Text>
                                {msg.sources?.length > 0 && (
                                    <View style={styles.sources}>
                                        <View style={styles.sourcesHeader}>
                                            <BookOpen size={12} color="#94a3b8" />
                                            <Text style={styles.sourcesLabel}>CITATIONS</Text>
                                        </View>
                                        {msg.sources.map((s: string, j: number) => (
                                            <Text key={j} style={styles.sourceItem}>
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
                    <View style={styles.messageRow}>
                        <View style={styles.aiBubble}>
                            <ActivityIndicator size="small" color="#38BDF8" />
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Ask a question..."
                        placeholderTextColor="#64748b"
                        value={input}
                        onChangeText={setInput}
                        multiline
                    />
                    <TouchableOpacity
                        style={styles.sendBtn}
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', paddingTop: 48 },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
    backBtn: { padding: 8, backgroundColor: '#0F172A', borderRadius: 999 },
    headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginLeft: 16 },
    messageList: { flex: 1, paddingHorizontal: 24 },
    emptyContainer: { alignItems: 'center', marginTop: 80, opacity: 0.3 },
    emptyText: { color: '#ffffff', textAlign: 'center', marginTop: 16, fontSize: 16 },
    messageRow: { flexDirection: 'row', marginBottom: 24 },
    bubble: { maxWidth: '85%', padding: 16, borderRadius: 24 },
    userBubble: { backgroundColor: '#38BDF8', borderTopRightRadius: 4 },
    aiBubble: { backgroundColor: '#0F172A', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#1E293B' },
    bubbleText: { lineHeight: 24 },
    sources: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    sourcesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    sourcesLabel: { color: '#94a3b8', fontSize: 10, marginLeft: 4, fontWeight: 'bold' },
    sourceItem: { color: '#64748b', fontSize: 10, marginBottom: 4, fontStyle: 'italic' },
    inputContainer: { padding: 24, backgroundColor: 'rgba(15,23,42,0.5)' },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },
    textInput: { flex: 1, color: '#ffffff', padding: 8 },
    sendBtn: { backgroundColor: '#38BDF8', padding: 8, borderRadius: 999, marginLeft: 8 },
});

export default ChatScreen;
