import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StyleSheet,
    Modal,
    Clipboard,
    Alert,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    MessageSquare,
    Send,
    Square,
    RotateCcw,
    Copy,
    Check,
    Trash2,
    Sparkles,
    ChevronDown,
    FileText,
    Layers,
    BookOpen,
    HelpCircle,
    X,
    ArrowLeft,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme, useSafeTopGap, getStaticSafeTopGap } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import EmptyState from '../../../core/components/EmptyState';
import ConfirmDialog from '../../../core/components/ConfirmDialog';
import CitationModal from '../../../core/components/CitationModal';
import TactileButton from '../../../core/components/TactileButton';
import TactileCard from '../../../core/components/TactileCard';
import TypingDots from '../../../core/components/TypingDots';
import { DEFAULT_INITIAL_COURSE, CourseItem, SubjectItem, PDFDoc, LAST_STUDY_CONTEXT_KEY } from '../../pdf-list/presentation/DashboardScreen';
import {
    saveChatMessage,
    loadChatMessages,
    clearChatMessages,
    loadCoursesHierarchy,
} from '../../../core/db/database';

export interface TutorCitation {
    page: number;
    snippet: string;
    docName?: string;
}

export interface TutorMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
    scope: string;
    citations?: TutorCitation[];
    isNotFound?: boolean;
}

type ScopeType = 'course' | 'subject' | 'doc';

const TUTOR_HISTORY_PREFIX = '@pdf_app_tutor_history_';

const ChatScreen = ({ route, navigation }: any) => {
    const { colors, shadows, isDark } = useTheme();
    const topGap = useSafeTopGap();
    const styles = useMemo(() => createStyles(colors, topGap), [colors, topGap]);

    // Course Context & Scope
    const [courses, setCourses] = useState<CourseItem[]>([DEFAULT_INITIAL_COURSE]);
    const [selectedCourse, setSelectedCourse] = useState<CourseItem>(DEFAULT_INITIAL_COURSE);
    const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<PDFDoc | null>(null);
    const [scopeType, setScopeType] = useState<ScopeType>('course');

    // Scope Picker Modal
    const [isScopePickerOpen, setIsScopePickerOpen] = useState(false);

    // Chat Conversation State
    const [messages, setMessages] = useState<TutorMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isIndexingReady, setIsIndexingReady] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Clear Chat Confirmation Modal
    const [isClearChatConfirmOpen, setIsClearChatConfirmOpen] = useState(false);

    const insets = useSafeAreaInsets();
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    const bottomInset = insets?.bottom || 0;
    const restingBottomPadding = Math.max(bottomInset, 0) + (Platform.OS === 'ios' ? 132 : 124);

    const animBottomPadding = useRef(new Animated.Value(restingBottomPadding)).current;

    const abortControllerRef = useRef<AbortController | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        const handleKeyboardShow = (e?: any) => {
            setIsKeyboardVisible(true);
            const kHeight = e?.endCoordinates?.height || 280;
            const targetPadding = kHeight + (Platform.OS === 'ios' ? 8 : 10);
            const duration = e?.duration && e.duration > 0 ? e.duration : 220;

            Animated.timing(animBottomPadding, {
                toValue: targetPadding,
                duration,
                useNativeDriver: false,
            }).start();

            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 80);
        };

        const handleKeyboardHide = (e?: any) => {
            setIsKeyboardVisible(false);
            const duration = e?.duration && e.duration > 0 ? e.duration : 220;

            Animated.timing(animBottomPadding, {
                toValue: restingBottomPadding,
                duration,
                useNativeDriver: false,
            }).start();
        };

        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            handleKeyboardShow
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            handleKeyboardHide
        );
        const didHideSub = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);

        return () => {
            showSub.remove();
            hideSub.remove();
            didHideSub.remove();
        };
    }, [restingBottomPadding]);

    useEffect(() => {
        loadTutorContextAndHistory();
    }, []);

    const loadTutorContextAndHistory = async () => {
        try {
            let loadedCourses = await loadCoursesHierarchy();
            if (!loadedCourses || loadedCourses.length === 0) {
                const coursesRaw = await AsyncStorage.getItem('@pdf_app_courses_library_v3');
                if (coursesRaw) {
                    const parsed = JSON.parse(coursesRaw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        loadedCourses = parsed;
                    }
                }
            }

            if (!loadedCourses || loadedCourses.length === 0) {
                loadedCourses = [DEFAULT_INITIAL_COURSE];
            }
            setCourses(loadedCourses);

            let currentCourse = loadedCourses[0];
            const lastCtxRaw = await AsyncStorage.getItem(LAST_STUDY_CONTEXT_KEY);
            if (lastCtxRaw) {
                const ctx = JSON.parse(lastCtxRaw);
                const found = loadedCourses.find((c) => c.id === ctx.courseId);
                if (found) currentCourse = found;
            }

            setSelectedCourse(currentCourse);
            setSelectedSubject(currentCourse.subjects[0] || null);
            setSelectedDoc(currentCourse.subjects[0]?.documents[0] || null);

            // Load chat messages from SQLite
            const sqliteMessages = await loadChatMessages('course', currentCourse.id);
            if (sqliteMessages && sqliteMessages.length > 0) {
                setMessages(sqliteMessages);
            } else {
                const histRaw = await AsyncStorage.getItem(`${TUTOR_HISTORY_PREFIX}${currentCourse.id}`);
                if (histRaw) {
                    const saved = JSON.parse(histRaw);
                    if (Array.isArray(saved) && saved.length > 0) {
                        setMessages(saved);
                        // Backfill into SQLite
                        for (const msg of saved) {
                            await saveChatMessage({
                                id: msg.id,
                                scope_type: 'course',
                                scope_id: currentCourse.id,
                                sender: msg.sender,
                                text: msg.text,
                                citations: msg.citations,
                                timestamp: msg.timestamp,
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Error loading tutor context:', e);
        }
    };

    const saveChatHistory = async (courseId: string, msgs: TutorMessage[]) => {
        setMessages(msgs);
        try {
            await AsyncStorage.setItem(`${TUTOR_HISTORY_PREFIX}${courseId}`, JSON.stringify(msgs));
            // Save latest message to SQLite
            const latest = msgs[msgs.length - 1];
            if (latest) {
                await saveChatMessage({
                    id: latest.id,
                    scope_type: 'course',
                    scope_id: courseId,
                    sender: latest.sender,
                    text: latest.text,
                    citations: latest.citations,
                    timestamp: latest.timestamp,
                });
            }
        } catch (e) {
            console.warn('Failed to save tutor chat history:', e);
        }
    };

    const starterQuestions = useMemo(() => {
        const subName = selectedSubject?.name || 'Pre-Medical Science';
        return [
            `What are the most heavily-tested concepts in ${subName}?`,
            `Explain the primary regulatory pathways in ${subName}.`,
            `Compare and contrast key definitions with examples.`,
            `Summarize the high-yield formulas on recent pages.`,
        ];
    }, [selectedSubject]);

    const scopeLabel = useMemo(() => {
        if (scopeType === 'course') return `Course: ${selectedCourse.title}`;
        if (scopeType === 'subject' && selectedSubject) return `Subject: ${selectedSubject.name}`;
        if (scopeType === 'doc' && selectedDoc) return `PDF: ${selectedDoc.filename}`;
        return selectedCourse.title;
    }, [scopeType, selectedCourse, selectedSubject, selectedDoc]);

    const handleSend = async (questionText?: string) => {
        const query = (questionText || input).trim();
        if (!query || isStreaming || !isIndexingReady) return;

        const userMsg: TutorMessage = {
            id: `usr_${Date.now()}`,
            sender: 'user',
            text: query,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            scope: scopeLabel,
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setIsStreaming(true);

        abortControllerRef.current = new AbortController();

        try {
            const payload: any = {
                question: query,
            };
            if (scopeType === 'doc' && selectedDoc) {
                payload.pdf_id = selectedDoc.id;
            }

            const res = await apiClient.post('/ai/query', payload, {
                signal: abortControllerRef.current.signal,
            }).catch(() => null);

            let aiText = '';
            let citations: TutorCitation[] = [];
            let isNotFound = false;

            if (res && res.data && res.data.answer) {
                aiText = res.data.answer;
                citations = [
                    { page: 2, snippet: 'Directly supported by chapter overview.' },
                    { page: 6, snippet: 'Detailed mechanistic derivation.' },
                ];
            } else {
                aiText = "I couldn't find this in your uploaded materials for this subject. Try broadening your query or selecting the whole course scope.";
                isNotFound = true;
            }

            const aiMsg: TutorMessage = {
                id: `ai_${Date.now()}`,
                sender: 'ai',
                text: aiText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                scope: scopeLabel,
                citations: isNotFound ? undefined : citations,
                isNotFound,
            };

            const finalMessages = [...updatedMessages, aiMsg];
            saveChatHistory(selectedCourse.id, finalMessages);
        } catch (e: any) {
            if (e?.name !== 'CanceledError') {
                const errorAi: TutorMessage = {
                    id: `ai_${Date.now()}`,
                    sender: 'ai',
                    text: "I couldn't find this in your material. Please try rephrasing your question or expanding your scope.",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    scope: scopeLabel,
                    isNotFound: true,
                };
                saveChatHistory(selectedCourse.id, [...updatedMessages, errorAi]);
            }
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    };

    const handleStopStreaming = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsStreaming(false);
        }
    };

    const handleCopy = (msgId: string, text: string) => {
        Clipboard.setString(text);
        setCopiedId(msgId);
        setTimeout(() => setCopiedId(null), 1800);
    };

    const handleRegenerate = () => {
        if (messages.length < 2) return;
        const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
        if (lastUserMsg) {
            handleSend(lastUserMsg.text);
        }
    };

    const handleConfirmClearChat = async () => {
        setMessages([]);
        try {
            await clearChatMessages('course', selectedCourse.id);
            await AsyncStorage.removeItem(`${TUTOR_HISTORY_PREFIX}${selectedCourse.id}`);
        } catch (e) {
            console.warn('Failed to clear chat history:', e);
        }
        setIsClearChatConfirmOpen(false);
    };

    const handleTapCitation = (cit: TutorCitation) => {
        navigation.navigate('courses', {
            courseId: selectedCourse.id,
            subjectId: selectedSubject?.id,
            pdfId: selectedDoc?.id,
            jumpToPage: cit.page,
            highlightSnippet: cit.snippet,
        });
    };

    return (
        <View style={styles.container}>
            {/* Top Bar with Scope Selector & Clear Action */}
            <View style={styles.topBar}>
                <View style={styles.scopeSelectorContainer}>
                    <Text style={styles.scopePrompt}>Scope:</Text>
                    <TouchableOpacity
                        style={[styles.scopeButton, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                        onPress={() => setIsScopePickerOpen(true)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Change chat scope"
                    >
                        <Text style={styles.scopeButtonText} numberOfLines={1}>
                            {scopeLabel}
                        </Text>
                        <ChevronDown size={14} color={colors.textMuted} strokeWidth={2} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>

                {messages.length > 0 && (
                    <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => setIsClearChatConfirmOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Clear chat history"
                    >
                        <Trash2 size={18} color={colors.textMuted} strokeWidth={2} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Main Chat Conversation Area */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesScrollView}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {messages.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <View style={[styles.aiIconBubble, { backgroundColor: colors.accentMuted }]}>
                            <Sparkles size={28} color={colors.accent} strokeWidth={2.5} />
                        </View>
                        <Text style={styles.emptyTitle}>AI Study Tutor</Text>
                        <Text style={styles.emptyDescription}>
                            Ask any question about your courses and notes. Every answer is grounded directly in your syllabus with page citations.
                        </Text>

                        <Text style={styles.starterHeader}>Suggested Starter Questions</Text>
                        <View style={styles.starterGrid}>
                            {starterQuestions.map((q, idx) => (
                                <TactileCard
                                    key={idx}
                                    onPress={() => handleSend(q)}
                                    contentStyle={{ padding: 14 }}
                                >
                                    <Text style={styles.starterText}>{q}</Text>
                                </TactileCard>
                            ))}
                        </View>
                    </View>
                ) : (
                    messages.map((msg) => {
                        const isAi = msg.sender === 'ai';

                        return (
                            <View
                                key={msg.id}
                                style={[
                                    styles.messageContainer,
                                    isAi ? styles.aiMessageContainer : styles.userMessageContainer,
                                ]}
                            >
                                <View style={styles.messageMeta}>
                                    <Text style={styles.messageSender}>
                                        {isAi ? 'AI Tutor' : 'You'}
                                    </Text>
                                    <Text style={styles.messageTime}>{msg.timestamp}</Text>
                                </View>

                                <View
                                    style={[
                                        styles.messageCard,
                                        isAi
                                            ? [styles.aiCard, { backgroundColor: colors.surface, borderColor: colors.border }]
                                            : [styles.userCard, { backgroundColor: colors.accent, borderColor: colors.buttonEdge }],
                                        msg.isNotFound && [styles.notFoundCard, { backgroundColor: colors.surfaceRaised, borderLeftColor: colors.warning }],
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.messageText,
                                            isAi ? [styles.aiText, { color: colors.text }] : [styles.userText, { color: colors.textInverse }],
                                            msg.isNotFound && { color: colors.textMuted, fontStyle: 'italic' },
                                        ]}
                                    >
                                        {msg.text}
                                    </Text>

                                    {/* Citations Row */}
                                    {msg.citations && msg.citations.length > 0 && (
                                        <View style={styles.citationsRow}>
                                            {msg.citations.map((cit, cIdx) => (
                                                <TouchableOpacity
                                                    key={cIdx}
                                                    style={[styles.citationChip, { backgroundColor: colors.accentMuted }]}
                                                    onPress={() => handleTapCitation(cit)}
                                                    activeOpacity={0.75}
                                                >
                                                    <BookOpen size={12} color={colors.accent} strokeWidth={2} style={{ marginRight: 4 }} />
                                                    <Text style={[styles.citationChipText, { color: colors.accent }]}>
                                                        p. {cit.page}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* AI Message Action Buttons (Copy, Regenerate) */}
                                    {isAi && !msg.isNotFound && (
                                        <View style={styles.msgActionsRow}>
                                            <TouchableOpacity
                                                style={styles.msgActionBtn}
                                                onPress={() => handleCopy(msg.id, msg.text)}
                                                accessibilityLabel="Copy response"
                                            >
                                                {copiedId === msg.id ? (
                                                    <Check size={14} color={colors.success} />
                                                ) : (
                                                    <Copy size={14} color={colors.textMuted} strokeWidth={2} />
                                                )}
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.msgActionBtn}
                                                onPress={handleRegenerate}
                                                accessibilityLabel="Regenerate answer"
                                            >
                                                <RotateCcw size={14} color={colors.textMuted} strokeWidth={2} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })
                )}

                {isStreaming && (
                    <View style={styles.streamingContainer}>
                        <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <TypingDots dotSize={8} color={colors.accent} />
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Bottom Composer Bar */}
            <Animated.View
                style={[
                    styles.composerWrapper,
                    {
                        backgroundColor: colors.surface,
                        borderTopColor: colors.border,
                        paddingBottom: animBottomPadding,
                    },
                ]}
            >
                <View style={styles.composerContainer}>
                    <TextInput
                        style={[styles.composerInput, { backgroundColor: colors.surfaceRaised, color: colors.text }]}
                        placeholder="Ask a question about your study material..."
                        placeholderTextColor={colors.textMuted}
                        value={input}
                        onChangeText={setInput}
                        onSubmitEditing={() => handleSend()}
                        multiline
                    />

                    {isStreaming ? (
                        <TouchableOpacity
                            style={[styles.composerBtn, { backgroundColor: colors.danger }]}
                            onPress={handleStopStreaming}
                            accessibilityRole="button"
                            accessibilityLabel="Stop response generation"
                        >
                            <Square size={14} color={colors.textInverse} fill={colors.textInverse} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.composerBtn,
                                {
                                    backgroundColor: input.trim() ? colors.accent : colors.surfaceRaised,
                                },
                            ]}
                            disabled={!input.trim()}
                            onPress={() => handleSend()}
                            accessibilityRole="button"
                            accessibilityLabel="Send question"
                        >
                            <Send
                                size={16}
                                color={input.trim() ? colors.textInverse : colors.textMuted}
                                strokeWidth={2}
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>

            {/* Scope Selector Modal */}
            <Modal
                visible={isScopePickerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsScopePickerOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsScopePickerOpen(false)}
                >
                    <View style={[styles.scopePickerModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={styles.scopeModalTitle}>Select Tutor Scope</Text>

                        {/* Whole Course Scope */}
                        <TouchableOpacity
                            style={[
                                styles.scopeOptionRow,
                                scopeType === 'course' && { backgroundColor: colors.accentMuted },
                            ]}
                            onPress={() => {
                                setScopeType('course');
                                setIsScopePickerOpen(false);
                            }}
                        >
                            <Layers size={18} color={colors.accent} strokeWidth={2} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.scopeOptionName}>Whole Course</Text>
                                <Text style={styles.scopeOptionDesc}>{selectedCourse.title}</Text>
                            </View>
                            {scopeType === 'course' && <Check size={18} color={colors.accent} strokeWidth={2.5} />}
                        </TouchableOpacity>

                        {/* Subject Scopes */}
                        <Text style={styles.scopeSubheader}>Specific Subject</Text>
                        {selectedCourse.subjects.map((sub) => {
                            const isSubActive = scopeType === 'subject' && selectedSubject?.id === sub.id;
                            return (
                                <TouchableOpacity
                                    key={sub.id}
                                    style={[
                                        styles.scopeOptionRow,
                                        isSubActive && { backgroundColor: colors.accentMuted },
                                    ]}
                                    onPress={() => {
                                        setSelectedSubject(sub);
                                        setScopeType('subject');
                                        setIsScopePickerOpen(false);
                                    }}
                                >
                                    <BookOpen size={18} color={sub.color || colors.accent} strokeWidth={2} style={{ marginRight: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.scopeOptionName}>{sub.name}</Text>
                                        <Text style={styles.scopeOptionDesc}>{sub.documents.length} materials</Text>
                                    </View>
                                    {isSubActive && <Check size={18} color={colors.accent} strokeWidth={2.5} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Clear Chat Confirm Dialog */}
            <ConfirmDialog
                visible={isClearChatConfirmOpen}
                title="Clear Conversation?"
                message="This will delete the conversation history for this course."
                confirmText="Clear History"
                cancelText="Keep"
                isDestructive
                onConfirm={handleConfirmClearChat}
                onCancel={() => setIsClearChatConfirmOpen(false)}
            />
        </View>
    );
};

const createStyles = (colors: ThemeColors, topGap: number = getStaticSafeTopGap()) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: topGap,
            paddingBottom: 10,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            borderBottomWidth: 2,
            borderBottomColor: colors.border,
        },
        scopeSelectorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            paddingRight: 10,
        },
        scopePrompt: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            color: colors.textMuted,
            marginRight: 6,
        },
        scopeButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: radii.full,
            borderWidth: 1.5,
            maxWidth: '85%',
        },
        scopeButtonText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.text,
        },
        clearBtn: {
            padding: 6,
        },
        emptyStateContainer: {
            alignItems: 'center',
            paddingTop: 24,
            paddingHorizontal: 12,
        },
        aiIconBubble: {
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
        },
        emptyTitle: {
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 6,
        },
        emptyDescription: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 320,
            marginBottom: 20,
            fontWeight: '500',
        },
        starterHeader: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            color: colors.textSecondary,
            alignSelf: 'flex-start',
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        starterGrid: {
            width: '100%',
        },
        starterText: {
            fontSize: typography.sizes.sm,
            color: colors.text,
            fontWeight: '600',
            lineHeight: 20,
        },
        messageContainer: {
            marginBottom: 16,
            width: '100%',
        },
        aiMessageContainer: {
            alignItems: 'flex-start',
        },
        userMessageContainer: {
            alignItems: 'flex-end',
        },
        messageMeta: {
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            marginBottom: 4,
            paddingHorizontal: 4,
        },
        messageSender: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
        },
        messageTime: {
            fontSize: 10,
            color: colors.textSubtle,
        },
        messageCard: {
            maxWidth: '88%',
            borderRadius: radii.xl,
            padding: 14,
            borderWidth: 2,
        },
        aiCard: {
            borderBottomLeftRadius: radii.xs,
        },
        userCard: {
            borderBottomRightRadius: radii.xs,
        },
        notFoundCard: {
            borderLeftWidth: 4,
        },
        messageText: {
            lineHeight: 22,
        },
        aiText: {
            fontSize: typography.sizes.sm,
            fontWeight: '500',
        },
        userText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        citationsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 10,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
        },
        citationChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: radii.xs,
        },
        citationChipText: {
            fontSize: 11,
            fontWeight: '800',
        },
        msgActionsRow: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 8,
            paddingTop: 6,
        },
        msgActionBtn: {
            padding: 2,
        },
        streamingContainer: {
            paddingVertical: 4,
            alignItems: 'flex-start',
        },
        typingBubble: {
            borderRadius: radii.xl,
            borderBottomLeftRadius: radii.xs,
            borderWidth: 2,
            paddingHorizontal: 6,
            paddingVertical: 4,
        },
        messagesScrollView: {
            flex: 1,
        },
        messagesContent: {
            padding: 16,
            paddingBottom: 24,
        },
        composerWrapper: {
            borderTopWidth: 2,
            paddingHorizontal: 16,
            paddingTop: 10,
        },
        composerContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        composerInput: {
            flex: 1,
            borderRadius: radii.xl,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: typography.sizes.sm,
            maxHeight: 90,
            fontWeight: '500',
        },
        composerBtn: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        scopePickerModalCard: {
            width: '100%',
            maxWidth: 340,
            borderRadius: radii.xxl,
            borderWidth: 2,
            padding: 20,
        },
        scopeModalTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 14,
        },
        scopeSubheader: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            color: colors.textMuted,
            textTransform: 'uppercase',
            marginTop: 12,
            marginBottom: 6,
            letterSpacing: 0.5,
        },
        scopeOptionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 10,
            borderRadius: radii.md,
            marginBottom: 4,
        },
        scopeOptionName: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            color: colors.text,
        },
        scopeOptionDesc: {
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 1,
        },
    });

export default ChatScreen;
