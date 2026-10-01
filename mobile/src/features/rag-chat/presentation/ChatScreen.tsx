import React, { useState, useRef, useMemo, useEffect } from 'react';
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
    Alert,
} from 'react-native';
import {
    ChevronLeft,
    Send,
    Bot,
    BookOpen,
    Sparkles,
    Trash2,
    Copy,
    Check,
    ThumbsUp,
    ThumbsDown,
    FileText,
    ExternalLink,
    Volume2,
    VolumeX,
    GraduationCap,
    Award,
    AlertTriangle,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import ttsService from '../../../core/tts/ttsService';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, darkShadows } from '../../../core/theme/tokens';
import SegmentedControl from '../../../core/components/SegmentedControl';
import CitationModal from '../../../core/components/CitationModal';

const formatTitle = (name?: string) => {
    if (!name) return 'Knowledge Base';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    sources?: string[];
    feedback?: 'up' | 'down';
    socraticData?: {
        score?: number;
        strengths?: string[];
        missing?: string[];
        misconceptions?: string[];
        followUp?: string;
    };
}

const ChatScreen = ({ route, navigation }: any) => {
    const routeParams = route?.params || {};
    const initialPdfId = routeParams.pdfId;
    const initialTitle = routeParams.title ? formatTitle(routeParams.title) : '';

    const { colors, shadows } = useTheme();
    const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

    // Document state
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>(initialPdfId || '');
    const [docTitle, setDocTitle] = useState<string>(initialTitle);

    // Mode state: 'qa' | 'socratic'
    const [chatMode, setChatMode] = useState<'qa' | 'socratic'>('qa');

    // Conversation state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

    // Citation inspection modal state
    const [selectedCitation, setSelectedCitation] = useState<string | null>(null);

    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        fetchDocs();
        return () => {
            ttsService.stop();
        };
    }, []);

    const fetchDocs = async () => {
        try {
            const res = await apiClient.get('/pdf/list');
            setDocs(res.data || []);
            if (!selectedDocId && res.data && res.data.length > 0) {
                setSelectedDocId(res.data[0].id);
                setDocTitle(formatTitle(res.data[0].original_name));
            }
        } catch {
            // Ignore error
        }
    };

    const starterPrompts = [
        'Summarize the core arguments and scope of this PDF',
        'Explain the most challenging concept with an intuitive analogy',
        'Identify key definitions, formulas, or algorithmic rules',
        'What are potential exam questions based on these notes?',
    ];

    const socraticPrompts = [
        'Test my understanding of the core concept in this document',
        'Challenge me on how data flows through this system',
        'Ask me a tough exam-level question to explain in plain English',
    ];

    const handleSendMessage = async (textToSend?: string) => {
        const queryText = (textToSend || input).trim();
        if (!queryText || loading) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: queryText,
        };

        setMessages((prev) => [...prev, userMsg]);
        if (!textToSend) setInput('');
        setLoading(true);

        try {
            if (chatMode === 'socratic') {
                // Socratic Teach-Back Mode
                const response = await apiClient.post('/ai/socratic', {
                    pdf_id: selectedDocId || undefined,
                    concept_or_topic: queryText,
                    student_explanation: queryText,
                });

                const data = response.data;
                const aiMsg: ChatMessage = {
                    id: `ai-${Date.now()}`,
                    sender: 'ai',
                    text: data.tutor_feedback || 'Assessment completed.',
                    socraticData: {
                        score: data.comprehension_score,
                        strengths: data.strengths,
                        missing: data.missing_aspects,
                        misconceptions: data.misconceptions,
                        followUp: data.follow_up_challenge,
                    },
                };
                setMessages((prev) => [...prev, aiMsg]);
            } else {
                // Direct Grounded RAG Q&A Mode
                const response = await apiClient.post('/ai/query', {
                    pdf_id: selectedDocId || undefined,
                    question: queryText,
                });

                const aiMsg: ChatMessage = {
                    id: `ai-${Date.now()}`,
                    sender: 'ai',
                    text: response.data.answer || 'No direct answer retrieved from document.',
                    sources: response.data.sources || [],
                };
                setMessages((prev) => [...prev, aiMsg]);
            }
        } catch (err: any) {
            const errorMsg: ChatMessage = {
                id: `err-${Date.now()}`,
                sender: 'ai',
                text:
                    err?.response?.data?.detail ||
                    'Error connecting to AI Tutor. Please verify backend connection.',
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    // ── TTS Audio Reading of AI message ──
    const handleSpeakMessage = async (msgId: string, text: string) => {
        if (speakingMsgId === msgId) {
            await ttsService.stop();
            setSpeakingMsgId(null);
            return;
        }

        try {
            setSpeakingMsgId(msgId);
            await ttsService.speak(text, {
                onDone: () => setSpeakingMsgId(null),
                onStopped: () => setSpeakingMsgId(null),
                onError: () => setSpeakingMsgId(null),
            });
        } catch {
            setSpeakingMsgId(null);
        }
    };

    const handleCopy = (msgId: string, text: string) => {
        setCopiedId(msgId);
        setTimeout(() => setCopiedId(null), 2000);
        Alert.alert('Copied', 'Message text copied to clipboard.');
    };

    const handleFeedback = (msgId: string, type: 'up' | 'down') => {
        setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, feedback: type } : m))
        );
    };

    const handleClearChat = () => {
        if (messages.length === 0) return;
        Alert.alert('Clear Dialogue', 'Are you sure you want to clear this dialogue history?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: () => {
                    ttsService.stop();
                    setMessages([]);
                },
            },
        ]);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            {/* ── Top Header ── */}
            <View style={styles.headerRow}>
                {navigation?.canGoBack?.() ? (
                    <TouchableOpacity
                        onPress={() => {
                            ttsService.stop();
                            navigation.goBack();
                        }}
                        style={styles.backBtn}
                        activeOpacity={0.7}
                    >
                        <ChevronLeft size={22} color={colors.text} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.headerIconBg}>
                        <Bot size={20} color={colors.accent} />
                    </View>
                )}

                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {docTitle || 'AI Academic Tutor'}
                    </Text>
                    <Text style={styles.headerSub}>
                        {chatMode === 'socratic'
                            ? 'Socratic Mode (Feynman Technique)'
                            : 'Grounded RAG Dialogue'}
                    </Text>
                </View>

                {messages.length > 0 && (
                    <TouchableOpacity
                        onPress={handleClearChat}
                        style={styles.clearBtn}
                        activeOpacity={0.7}
                        accessibilityLabel="Clear Dialogue"
                    >
                        <Trash2 size={16} color={colors.textSubtle} />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Document Switcher Chips ── */}
            {docs.length > 1 && (
                <View style={styles.docPickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {docs.map((d) => {
                            const isSel = d.id === selectedDocId;
                            return (
                                <TouchableOpacity
                                    key={d.id}
                                    style={[styles.docChip, isSel && styles.docChipActive]}
                                    onPress={() => {
                                        setSelectedDocId(d.id);
                                        setDocTitle(formatTitle(d.original_name));
                                    }}
                                >
                                    <FileText
                                        size={12}
                                        color={isSel ? colors.textInverse : colors.textMuted}
                                        style={{ marginRight: 5 }}
                                    />
                                    <Text
                                        style={[styles.docChipText, isSel && styles.docChipTextActive]}
                                        numberOfLines={1}
                                    >
                                        {formatTitle(d.original_name)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* ── Mode Switcher (Q&A vs Socratic Teach-Back) ── */}
            <View style={styles.modeContainer}>
                <SegmentedControl
                    options={[
                        { key: 'qa', label: 'Direct Q&A', icon: Bot },
                        { key: 'socratic', label: 'Socratic Teach-Back', icon: GraduationCap },
                    ]}
                    selectedKey={chatMode}
                    onSelect={(m) => setChatMode(m as 'qa' | 'socratic')}
                />
            </View>

            {/* ── Message Thread ── */}
            <ScrollView
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                showsVerticalScrollIndicator={false}
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconWrapper}>
                            {chatMode === 'socratic' ? (
                                <GraduationCap size={36} color={colors.indigo} />
                            ) : (
                                <Bot size={36} color={colors.accent} />
                            )}
                        </View>
                        <Text style={styles.emptyTitle}>
                            {chatMode === 'socratic'
                                ? 'Socratic Teach-Back Arena'
                                : 'Ask About This Document'}
                        </Text>
                        <Text style={styles.emptyText}>
                            {chatMode === 'socratic'
                                ? 'Test your retention using the Feynman Technique! Type a concept explanation, and the AI will score your comprehension, uncover missing edge cases, and challenge you.'
                                : 'Query verified facts, explain difficult sections, or test your comprehension with AI responses grounded in your uploaded PDF.'}
                        </Text>

                        {/* Starter Prompts */}
                        <Text style={styles.starterHeading}>Suggested Prompts</Text>
                        <View style={styles.starterList}>
                            {(chatMode === 'socratic' ? socraticPrompts : starterPrompts).map((prompt, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.starterCard}
                                    onPress={() => handleSendMessage(prompt)}
                                    activeOpacity={0.75}
                                >
                                    <Sparkles
                                        size={14}
                                        color={chatMode === 'socratic' ? colors.indigo : colors.accent}
                                        style={{ marginRight: 8, marginTop: 2 }}
                                    />
                                    <Text style={styles.starterText}>{prompt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : (
                    messages.map((msg) => {
                        const isUser = msg.sender === 'user';
                        const isSpeakingThis = speakingMsgId === msg.id;

                        return (
                            <View
                                key={msg.id}
                                style={[
                                    styles.messageRow,
                                    { justifyContent: isUser ? 'flex-end' : 'flex-start' },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.bubble,
                                        isUser ? styles.userBubble : styles.aiBubble,
                                    ]}
                                >
                                    {!isUser && (
                                        <View style={styles.aiHeader}>
                                            <View style={styles.aiBadge}>
                                                <Sparkles size={11} color={colors.accent} />
                                                <Text style={styles.aiBadgeText}>
                                                    {chatMode === 'socratic'
                                                        ? 'Socratic Professor'
                                                        : 'Academic Tutor'}
                                                </Text>
                                            </View>

                                            {/* Audio Pronunciation / Narration Button */}
                                            <TouchableOpacity
                                                onPress={() => handleSpeakMessage(msg.id, msg.text)}
                                                style={styles.ttsMsgBtn}
                                                activeOpacity={0.7}
                                            >
                                                {isSpeakingThis ? (
                                                    <VolumeX size={14} color={colors.accent} />
                                                ) : (
                                                    <Volume2 size={14} color={colors.textMuted} />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <Text
                                        style={isUser ? styles.userText : styles.aiText}
                                    >
                                        {msg.text}
                                    </Text>

                                    {/* Socratic Feedback Scorecard Card */}
                                    {msg.socraticData && (
                                        <View style={styles.socraticCard}>
                                            {msg.socraticData.score !== undefined && (
                                                <View style={styles.socraticScoreRow}>
                                                    <Award size={18} color={colors.accent} />
                                                    <Text style={styles.socraticScoreText}>
                                                        Comprehension Score: {msg.socraticData.score}/100
                                                    </Text>
                                                </View>
                                            )}

                                            {/* Strengths */}
                                            {msg.socraticData.strengths && msg.socraticData.strengths.length > 0 && (
                                                <View style={styles.socraticAspect}>
                                                    <Text style={styles.aspectTitlePositive}>
                                                        ✓ Accurate Understanding:
                                                    </Text>
                                                    {msg.socraticData.strengths.map((s, i) => (
                                                        <Text key={i} style={styles.aspectItem}>
                                                            • {s}
                                                        </Text>
                                                    ))}
                                                </View>
                                            )}

                                            {/* Missing Edge Cases */}
                                            {msg.socraticData.missing && msg.socraticData.missing.length > 0 && (
                                                <View style={styles.socraticAspect}>
                                                    <Text style={styles.aspectTitleMissing}>
                                                        ⚠ Missing Key Nuances:
                                                    </Text>
                                                    {msg.socraticData.missing.map((m, i) => (
                                                        <Text key={i} style={styles.aspectItem}>
                                                            • {m}
                                                        </Text>
                                                    ))}
                                                </View>
                                            )}

                                            {/* Follow-up challenge */}
                                            {msg.socraticData.followUp && (
                                                <View style={styles.followUpBox}>
                                                    <Text style={styles.followUpLabel}>
                                                        Next Socratic Challenge:
                                                    </Text>
                                                    <Text style={styles.followUpText}>
                                                        {msg.socraticData.followUp}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Grounding Source Citations */}
                                    {msg.sources && msg.sources.length > 0 && (
                                        <View style={styles.sourcesSection}>
                                            <View style={styles.sourcesHeader}>
                                                <BookOpen size={11} color={colors.textSubtle} />
                                                <Text style={styles.sourcesLabel}>GROUNDING CITATIONS</Text>
                                            </View>
                                            <View style={styles.citationChipsWrap}>
                                                {msg.sources.map((src, sIdx) => {
                                                    const chunkMatch = src.match(/chunk\s*(\d+)/i);
                                                    const chunkLabel = chunkMatch
                                                        ? `Chunk #${chunkMatch[1]}`
                                                        : `Source ${sIdx + 1}`;

                                                    return (
                                                        <TouchableOpacity
                                                            key={sIdx}
                                                            style={styles.citationChip}
                                                            onPress={() => setSelectedCitation(src)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <FileText size={11} color={colors.accent} />
                                                            <Text style={styles.citationChipText}>
                                                                {chunkLabel}
                                                            </Text>
                                                            <ExternalLink size={10} color={colors.textSubtle} />
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    )}

                                    {/* Message Footer Actions */}
                                    {!isUser && (
                                        <View style={styles.msgFooterActions}>
                                            <TouchableOpacity
                                                onPress={() => handleCopy(msg.id, msg.text)}
                                                style={styles.footerActionBtn}
                                                activeOpacity={0.7}
                                            >
                                                {copiedId === msg.id ? (
                                                    <Check size={13} color={colors.success} />
                                                ) : (
                                                    <Copy size={13} color={colors.textSubtle} />
                                                )}
                                            </TouchableOpacity>

                                            <View style={styles.feedbackGroup}>
                                                <TouchableOpacity
                                                    onPress={() => handleFeedback(msg.id, 'up')}
                                                    style={styles.feedbackBtn}
                                                    activeOpacity={0.7}
                                                >
                                                    <ThumbsUp
                                                        size={13}
                                                        color={msg.feedback === 'up' ? colors.success : colors.textSubtle}
                                                    />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => handleFeedback(msg.id, 'down')}
                                                    style={styles.feedbackBtn}
                                                    activeOpacity={0.7}
                                                >
                                                    <ThumbsDown
                                                        size={13}
                                                        color={msg.feedback === 'down' ? colors.danger : colors.textSubtle}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })
                )}

                {loading && (
                    <View style={styles.messageRow}>
                        <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
                            <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 10 }} />
                            <Text style={styles.loadingText}>
                                {chatMode === 'socratic'
                                    ? 'Analyzing comprehension against lecture materials...'
                                    : 'Retrieving vector chunks and formulating grounded response...'}
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ── Chat Composer Bar ── */}
            <View style={styles.composerContainer}>
                <View style={styles.inputRow}>
                    <TextInput
                        style={[styles.textInput, { maxHeight: 110 }]}
                        placeholder={
                            chatMode === 'socratic'
                                ? 'Explain this concept in your own words...'
                                : 'Ask any question about your study materials...'
                        }
                        placeholderTextColor={colors.textSubtle}
                        value={input}
                        onChangeText={setInput}
                        multiline
                        editable={!loading}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendBtn,
                            (!input.trim() || loading) && styles.sendBtnDisabled,
                        ]}
                        onPress={() => handleSendMessage()}
                        disabled={!input.trim() || loading}
                        activeOpacity={0.85}
                    >
                        <Send
                            size={16}
                            color={!input.trim() || loading ? colors.textSubtle : colors.textInverse}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Citation Inspection Modal ── */}
            <CitationModal
                visible={!!selectedCitation}
                citationText={selectedCitation || ''}
                documentTitle={docTitle}
                onClose={() => setSelectedCitation(null)}
            />
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: ThemeColors, shadows: typeof darkShadows) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
            paddingTop: 50,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.xs,
        },
        headerIconBg: {
            width: 38,
            height: 38,
            borderRadius: radii.md,
            backgroundColor: colors.accentMuted,
            justifyContent: 'center',
            alignItems: 'center',
        },
        backBtn: {
            width: 38,
            height: 38,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        titleContainer: {
            flex: 1,
            marginHorizontal: 12,
        },
        headerTitle: {
            color: colors.text,
            fontSize: typography.sizes.base,
            fontWeight: '700',
        },
        headerSub: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            marginTop: 1,
        },
        clearBtn: {
            width: 38,
            height: 38,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        docPickerContainer: {
            paddingHorizontal: spacing.lg,
            marginVertical: spacing.xs,
        },
        docChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            marginRight: 6,
            maxWidth: 180,
        },
        docChipActive: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        docChipText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        docChipTextActive: {
            color: colors.textInverse,
            fontWeight: '700',
        },
        modeContainer: {
            paddingHorizontal: spacing.lg,
            marginVertical: spacing.xs,
        },
        messageList: {
            flex: 1,
            paddingHorizontal: spacing.lg,
        },
        messageListContent: {
            paddingBottom: 85, // Space for bottom tab bar
        },
        emptyContainer: {
            alignItems: 'center',
            marginTop: spacing.lg,
            paddingHorizontal: spacing.sm,
        },
        emptyIconWrapper: {
            width: 64,
            height: 64,
            borderRadius: radii.full,
            backgroundColor: colors.accentMuted,
            borderWidth: 1,
            borderColor: colors.accentBorder,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.sm,
        },
        emptyTitle: {
            color: colors.text,
            fontSize: typography.sizes.md,
            fontWeight: '700',
            textAlign: 'center',
        },
        emptyText: {
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 4,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            maxWidth: 320,
        },
        starterHeading: {
            alignSelf: 'flex-start',
            color: colors.textSubtle,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginTop: spacing.md,
            marginBottom: spacing.xs,
        },
        starterList: {
            width: '100%',
            gap: 6,
        },
        starterCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.sm,
            ...shadows.card,
        },
        starterText: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            flex: 1,
            fontWeight: '500',
        },
        messageRow: {
            flexDirection: 'row',
            marginBottom: spacing.md,
        },
        bubble: {
            maxWidth: '88%',
            padding: spacing.md,
            borderRadius: radii.lg,
        },
        userBubble: {
            backgroundColor: colors.accent,
            borderBottomRightRadius: radii.xs,
            ...shadows.glowAccent,
        },
        aiBubble: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xs,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.card,
        },
        aiHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
        },
        aiBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.accentMuted,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: radii.full,
        },
        aiBadgeText: {
            color: colors.accent,
            fontSize: 9,
            fontWeight: '700',
            marginLeft: 4,
        },
        ttsMsgBtn: {
            padding: 4,
        },
        userText: {
            color: colors.textInverse,
            fontSize: typography.sizes.sm,
            lineHeight: 21,
            fontWeight: '600',
        },
        aiText: {
            color: colors.textSecondary,
            fontSize: typography.sizes.sm,
            lineHeight: 22,
        },
        socraticCard: {
            marginTop: spacing.sm,
            padding: spacing.sm,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        socraticScoreRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            paddingBottom: 4,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        socraticScoreText: {
            color: colors.accent,
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        socraticAspect: {
            marginBottom: 6,
        },
        aspectTitlePositive: {
            color: colors.success,
            fontSize: 11,
            fontWeight: '700',
            marginBottom: 2,
        },
        aspectTitleMissing: {
            color: colors.warning,
            fontSize: 11,
            fontWeight: '700',
            marginBottom: 2,
        },
        aspectItem: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            marginLeft: 4,
        },
        followUpBox: {
            marginTop: 4,
            padding: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: radii.xs,
            borderLeftWidth: 2,
            borderLeftColor: colors.indigo,
        },
        followUpLabel: {
            color: colors.indigo,
            fontSize: 10,
            fontWeight: '800',
            textTransform: 'uppercase',
            marginBottom: 2,
        },
        followUpText: {
            color: colors.text,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        sourcesSection: {
            marginTop: spacing.xs,
            paddingTop: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        sourcesHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
        },
        sourcesLabel: {
            color: colors.textSubtle,
            fontSize: 8,
            marginLeft: 4,
            fontWeight: '800',
        },
        citationChipsWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
        },
        citationChip: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: radii.xs,
            gap: 4,
        },
        citationChipText: {
            color: colors.accent,
            fontSize: 10,
            fontWeight: '600',
        },
        msgFooterActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
        },
        footerActionBtn: {
            padding: 4,
        },
        feedbackGroup: {
            flexDirection: 'row',
            gap: 6,
        },
        feedbackBtn: {
            padding: 4,
        },
        loadingBubble: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
        },
        loadingText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
        },
        composerContainer: {
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xs,
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            marginBottom: 75, // Above bottom tab bar
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
        },
        textInput: {
            flex: 1,
            color: colors.text,
            fontSize: typography.sizes.sm,
            paddingHorizontal: 8,
            paddingVertical: 8,
            minHeight: 36,
        },
        sendBtn: {
            backgroundColor: colors.accent,
            width: 34,
            height: 34,
            borderRadius: radii.md,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 2,
            ...shadows.glowAccent,
        },
        sendBtnDisabled: {
            backgroundColor: colors.surfaceSubtle,
            shadowOpacity: 0,
            elevation: 0,
        },
    });

export default ChatScreen;
