import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { ChevronLeft, Send, Bot, BookOpen } from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const formatTitle = (name?: string) => {
    if (!name) return 'Document';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

const ChatScreen = ({ route, navigation }: any) => {
    const { pdfId, title: routeTitle } = route.params;
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const cleanTitle = formatTitle(routeTitle);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMsg = { sender: 'user', text: input };
        setMessages((prev) => [...prev, userMsg]);
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
                sources: response.data.sources,
            };
            setMessages((prev) => [...prev, aiMsg]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { sender: 'ai', text: 'Error connecting to RAG engine. Please ensure backend is running.' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            {/* ── Header ── */}
            <View style={styles.headerRow}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    activeOpacity={0.7}
                >
                    <ChevronLeft size={22} color="#ffffff" />
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {cleanTitle}
                    </Text>
                    <Text style={styles.headerSub}>RAG Knowledge Assistant</Text>
                </View>
            </View>

            {/* ── Message Thread ── */}
            <ScrollView
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                style={styles.messageList}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconWrapper}>
                            <Bot size={44} color="#38BDF8" />
                        </View>
                        <Text style={styles.emptyTitle}>Ask Anything</Text>
                        <Text style={styles.emptyText}>
                            Query facts, clarify definitions, and search concepts grounded in this document.
                        </Text>
                    </View>
                ) : (
                    messages.map((msg, i) => (
                        <View
                            key={i}
                            style={[
                                styles.messageRow,
                                { justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' },
                            ]}
                        >
                            <View
                                style={[
                                    styles.bubble,
                                    msg.sender === 'user' ? styles.userBubble : styles.aiBubble,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.bubbleText,
                                        { color: msg.sender === 'user' ? '#020617' : '#ffffff' },
                                    ]}
                                >
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
                                                • {s.substring(0, 90)}...
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

            {/* ── Input Bar ── */}
            <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Ask a question about this document..."
                        placeholderTextColor="#64748b"
                        value={input}
                        onChangeText={setInput}
                        multiline
                    />
                    <TouchableOpacity
                        style={styles.sendBtn}
                        onPress={sendMessage}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Send size={18} color="#020617" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
        paddingTop: 48,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    backBtn: {
        width: 40,
        height: 40,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
        marginLeft: 14,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
    },
    headerSub: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    messageList: {
        flex: 1,
        paddingHorizontal: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 80,
        paddingHorizontal: 20,
    },
    emptyIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(56,189,248,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    emptyText: {
        color: '#64748B',
        textAlign: 'center',
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    bubble: {
        maxWidth: '85%',
        padding: 16,
        borderRadius: 20,
    },
    userBubble: {
        backgroundColor: '#38BDF8',
        borderTopRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    bubbleText: {
        lineHeight: 22,
        fontSize: 14,
    },
    sources: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    sourcesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    sourcesLabel: {
        color: '#94a3b8',
        fontSize: 10,
        marginLeft: 4,
        fontWeight: 'bold',
    },
    sourceItem: {
        color: '#64748b',
        fontSize: 11,
        marginBottom: 3,
        fontStyle: 'italic',
    },
    inputContainer: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: 'rgba(15,23,42,0.7)',
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    textInput: {
        flex: 1,
        color: '#ffffff',
        padding: 8,
        fontSize: 14,
        maxHeight: 100,
    },
    sendBtn: {
        backgroundColor: '#38BDF8',
        padding: 9,
        borderRadius: 999,
        marginLeft: 8,
    },
});

export default ChatScreen;
