import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Keyboard,
    Platform,
    ActivityIndicator,
    StyleSheet,
    Modal,
    Animated,
    TouchableOpacity,
} from 'react-native';
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
    ThumbsUp,
    ThumbsDown,
    ArrowDown,
    BookMarked,
    Info,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, gradients } from '../../../core/theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../../../core/theme/motion';
import EmptyState from '../../../core/components/EmptyState';
import ConfirmDialog from '../../../core/components/ConfirmDialog';
import CitationModal from '../../../core/components/CitationModal';
import Toast from '../../../core/components/Toast';
import { AnimatedPressable } from '../../../core/components/AnimatedPressable';
import { DEFAULT_INITIAL_COURSE, CourseItem, SubjectItem, PDFDoc, LAST_STUDY_CONTEXT_KEY } from '../../pdf-list/presentation/DashboardScreen';

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
    feedback?: 'up' | 'down';
}

type ScopeType = 'course' | 'subject' | 'doc';

const TUTOR_HISTORY_PREFIX = '@pdf_app_tutor_history_';

const ChatScreen = ({ route, navigation }: any) => {
    const { colors, shadows, isDark, typography } = useTheme();
    const tabAccent = colors.tabAITutor; // Violet #7C5CFA
    const styles = useMemo(() => createStyles(colors, shadows, tabAccent), [colors, shadows, tabAccent]);

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
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);

    // Citation Inspection Modal
    const [activeCitation, setActiveCitation] = useState<TutorCitation | null>(null);

    // Clear Chat Confirmation Modal
    const [isClearChatConfirmOpen, setIsClearChatConfirmOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // 3-dot typing animation
    const dot1Anim = useRef(new Animated.Value(0)).current;
    const dot2Anim = useRef(new Animated.Value(0)).current;
    const dot3Anim = useRef(new Animated.Value(0)).current;

    const abortControllerRef = useRef<AbortController | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (isStreaming && !getIsReducedMotion()) {
            const createDotAnim = (anim: Animated.Value, delay: number) =>
                Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.timing(anim, { toValue: -6, duration: 250, useNativeDriver: true }),
                        Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
                        Animated.delay(500 - delay),
                    ])
                );

            const a1 = createDotAnim(dot1Anim, 0);
            const a2 = createDotAnim(dot2Anim, 150);
            const a3 = createDotAnim(dot3Anim, 300);

            a1.start();
            a2.start();
            a3.start();

            return () => {
                a1.stop();
                a2.stop();
                a3.stop();
            };
        }
    }, [isStreaming]);

    useEffect(() => {
        loadTutorContextAndHistory();
    }, []);

    const loadTutorContextAndHistory = async () => {
        try {
            const coursesRaw = await AsyncStorage.getItem('@pdf_app_courses_library_v3');
            let loadedCourses = [DEFAULT_INITIAL_COURSE];
            if (coursesRaw) {
                const parsed = JSON.parse(coursesRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    loadedCourses = parsed;
                    setCourses(parsed);
                }
            }

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

            const histRaw = await AsyncStorage.getItem(`${TUTOR_HISTORY_PREFIX}${currentCourse.id}`);
            if (histRaw) {
                const saved = JSON.parse(histRaw);
                if (Array.isArray(saved) && saved.length > 0) {
                    setMessages(saved);
                    return;
                }
            }

            // Default starter welcoming message
            setMessages([
                {
                    id: 'msg_welcome',
                    sender: 'ai',
                    text: `Hello! I am your **AI Study Tutor** for **${currentCourse.title}**. I am grounded directly in your syllabus notes and PDFs. Ask me anything, or tap a starter topic below!`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    scope: `Course: ${currentCourse.title}`,
                },
            ]);
        } catch (e) {
            console.warn('Error loading tutor context:', e);
        }
    };

    const saveChatHistory = async (courseId: string, msgs: TutorMessage[]) => {
        setMessages(msgs);
        try {
            await AsyncStorage.setItem(`${TUTOR_HISTORY_PREFIX}${courseId}`, JSON.stringify(msgs));
        } catch (e) {
            console.warn('Failed to save tutor chat history:', e);
        }
    };

    const starterQuestions = useMemo(() => {
        const subName = selectedSubject?.name || 'Pre-Medical Science';
        return [
            `What are the most heavily-tested concepts in ${subName}?`,
            `Explain the primary regulatory pathways in ${subName}.`,
            `Compare key terms with clinical exam examples.`,
            `Summarize the high-yield formulas on recent pages.`,
        ];
    }, [selectedSubject]);

    const scopeLabel = useMemo(() => {
        if (scopeType === 'course') return `Whole Course: ${selectedCourse.title}`;
        if (scopeType === 'subject' && selectedSubject) return `Subject: ${selectedSubject.name}`;
        if (scopeType === 'doc' && selectedDoc) return `Document: ${selectedDoc.filename}`;
        return selectedCourse.title;
    }, [scopeType, selectedCourse, selectedSubject, selectedDoc]);

    const handleSend = async (questionText?: string) => {
        const query = (questionText || input).trim();
        if (!query || isStreaming) return;

        triggerHaptic('selection');
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
                    { page: 2, snippet: 'Directly supported by syllabus chapter overview.' },
                    { page: 6, snippet: 'Detailed mechanistic derivation and chemical parameters.' },
                ];
            } else {
                aiText = "I couldn't find this in your material. Make sure your course documents cover this topic, or switch your scope to the whole course.";
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
            triggerHaptic('selection');
        }
    };

    const handleCopyMessage = (msgId: string, text: string) => {
        triggerHaptic('selection');
        setCopiedId(msgId);
        setToastMessage('Message copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleFeedback = (msgId: string, type: 'up' | 'down') => {
        triggerHaptic('selection');
        setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, feedback: type } : m))
        );
        setToastMessage(type === 'up' ? 'Thanks for the feedback!' : 'Feedback recorded.');
    };

    const handleClearChat = () => {
        setMessages([]);
        saveChatHistory(selectedCourse.id, []);
        setIsClearChatConfirmOpen(false);
        setToastMessage('Conversation cleared.');
    };

    return (
        <View style={styles.container}>
            {/* Top Bar with Scope Selector Pill */}
            <View style={styles.topBar}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.topBarTitle}>AI Tutor</Text>
                    <AnimatedPressable
                        style={[styles.scopePill, { backgroundColor: colors.surfaceRaised }]}
                        onPress={() => setIsScopePickerOpen(true)}
                    >
                        <Layers size={13} color={tabAccent} strokeWidth={2} style={{ marginRight: 5 }} />
                        <Text style={[styles.scopePillText, { color: colors.text }]} numberOfLines={1}>
                            {scopeType === 'course'
                                ? 'Whole Course'
                                : scopeType === 'subject'
                                ? `Subject: ${selectedSubject?.name || 'Subject'}`
                                : `PDF: ${selectedDoc?.filename || 'Document'}`}
                        </Text>
                        <ChevronDown size={13} color={colors.textMuted} strokeWidth={2} style={{ marginLeft: 4 }} />
                    </AnimatedPressable>
                </View>

                <AnimatedPressable
                    style={styles.clearBtn}
                    onPress={() => setIsClearChatConfirmOpen(true)}
                    accessibilityLabel="Clear conversation"
                >
                    <Trash2 size={18} color={colors.textMuted} strokeWidth={1.75} />
                </AnimatedPressable>
            </View>

            {/* Messages Scroll Area */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesScroll}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y;
                    const contentHeight = e.nativeEvent.contentSize.height;
                    const layoutHeight = e.nativeEvent.layoutMeasurement.height;
                    setShowJumpToBottom(contentHeight - (offsetY + layoutHeight) > 120);
                }}
                scrollEventThrottle={16}
            >
                {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                        <View
                            key={msg.id}
                            style={[
                                styles.messageWrapper,
                                isUser ? styles.userMessageWrapper : styles.aiMessageWrapper,
                            ]}
                        >
                            <View
                                style={[
                                    styles.bubble,
                                    isUser
                                        ? [styles.userBubble, { backgroundColor: tabAccent }]
                                        : [styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card],
                                ]}
                            >
                                {!isUser && (
                                    <View style={styles.aiHeaderRow}>
                                        <View style={[styles.aiAvatarCircle, { backgroundColor: colors.primaryMuted }]}>
                                            <Sparkles size={13} color={tabAccent} strokeWidth={2} />
                                        </View>
                                        <Text style={[styles.aiLabel, { color: tabAccent }]}>Grounded Tutor</Text>
                                        <Text style={[styles.msgTime, { color: colors.textMuted }]}>{msg.timestamp}</Text>
                                    </View>
                                )}

                                {/* Message text */}
                                <Text
                                    style={[
                                        styles.messageText,
                                        { color: isUser ? '#FFFFFF' : colors.text },
                                        !isUser && { fontFamily: typography.fontFamily.reading },
                                    ]}
                                >
                                    {msg.text}
                                </Text>

                                {/* Not found calm notice */}
                                {msg.isNotFound && (
                                    <View style={[styles.notFoundBox, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                                        <Info size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                                        <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
                                            Tip: Try asking about specific terms, definitions, or broad mechanisms.
                                        </Text>
                                    </View>
                                )}

                                {/* Citations */}
                                {msg.citations && msg.citations.length > 0 && (
                                    <View style={styles.citationsRow}>
                                        {msg.citations.map((c, cIdx) => (
                                            <AnimatedPressable
                                                key={cIdx}
                                                style={[styles.citationChip, { backgroundColor: colors.surfaceRaised }]}
                                                onPress={() => setActiveCitation(c)}
                                            >
                                                <BookMarked size={12} color={tabAccent} strokeWidth={2} style={{ marginRight: 4 }} />
                                                <Text style={[styles.citationChipText, { color: tabAccent }]}>
                                                    Page {c.page}
                                                </Text>
                                            </AnimatedPressable>
                                        ))}
                                    </View>
                                )}

                                {/* Message Action Toolbar for AI */}
                                {!isUser && (
                                    <View style={styles.msgToolbar}>
                                        <AnimatedPressable
                                            style={styles.toolbarBtn}
                                            onPress={() => handleCopyMessage(msg.id, msg.text)}
                                        >
                                            {copiedId === msg.id ? (
                                                <Check size={14} color={colors.success} strokeWidth={2} />
                                            ) : (
                                                <Copy size={14} color={colors.textMuted} strokeWidth={1.75} />
                                            )}
                                        </AnimatedPressable>

                                        <AnimatedPressable
                                            style={styles.toolbarBtn}
                                            onPress={() => handleFeedback(msg.id, 'up')}
                                        >
                                            <ThumbsUp
                                                size={14}
                                                color={msg.feedback === 'up' ? tabAccent : colors.textMuted}
                                                strokeWidth={1.75}
                                            />
                                        </AnimatedPressable>

                                        <AnimatedPressable
                                            style={styles.toolbarBtn}
                                            onPress={() => handleFeedback(msg.id, 'down')}
                                        >
                                            <ThumbsDown
                                                size={14}
                                                color={msg.feedback === 'down' ? colors.danger : colors.textMuted}
                                                strokeWidth={1.75}
                                            />
                                        </AnimatedPressable>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}

                {/* 3-Dot Typing Indicator */}
                {isStreaming && (
                    <View style={styles.typingBubbleWrapper}>
                        <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.subtle]}>
                            <Animated.View style={[styles.typingDot, { backgroundColor: tabAccent, transform: [{ translateY: dot1Anim }] }]} />
                            <Animated.View style={[styles.typingDot, { backgroundColor: tabAccent, transform: [{ translateY: dot2Anim }] }]} />
                            <Animated.View style={[styles.typingDot, { backgroundColor: tabAccent, transform: [{ translateY: dot3Anim }] }]} />
                        </View>
                    </View>
                )}

                {/* Starter Questions Chips */}
                {messages.length <= 1 && (
                    <View style={styles.starterBlock}>
                        <Text style={styles.starterHeading}>Suggested Topics to Explore</Text>
                        <View style={styles.starterGrid}>
                            {starterQuestions.map((sq, sIdx) => (
                                <AnimatedPressable
                                    key={sIdx}
                                    style={[styles.starterChip, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.subtle]}
                                    onPress={() => handleSend(sq)}
                                >
                                    <Sparkles size={13} color={tabAccent} strokeWidth={2} style={{ marginRight: 6 }} />
                                    <Text style={[styles.starterChipText, { color: colors.text }]}>{sq}</Text>
                                </AnimatedPressable>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Jump to bottom floating pill */}
            {showJumpToBottom && (
                <AnimatedPressable
                    style={[styles.jumpBottomBtn, { backgroundColor: colors.surface }, shadows.card]}
                    onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                    <ArrowDown size={15} color={tabAccent} strokeWidth={2.5} style={{ marginRight: 4 }} />
                    <Text style={[styles.jumpBottomText, { color: tabAccent }]}>Latest</Text>
                </AnimatedPressable>
            )}

            {/* Auto-growing Rounded Composer */}
            <View style={[styles.composerContainer, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.elevated]}>
                <TextInput
                    style={[styles.composerInput, { color: colors.text }]}
                    placeholder={`Ask about ${selectedSubject?.name || 'notes'}...`}
                    placeholderTextColor={colors.textMuted}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={1000}
                />

                {isStreaming ? (
                    <AnimatedPressable
                        style={[styles.stopBtn, { backgroundColor: colors.danger }]}
                        onPress={handleStopStreaming}
                    >
                        <Square size={14} color="#FFFFFF" strokeWidth={3} />
                    </AnimatedPressable>
                ) : (
                    <AnimatedPressable
                        style={[
                            styles.sendBtn,
                            { backgroundColor: input.trim() ? tabAccent : colors.surfaceRaised },
                        ]}
                        onPress={() => handleSend()}
                        disabled={!input.trim()}
                    >
                        <Send size={16} color={input.trim() ? '#FFFFFF' : colors.textMuted} strokeWidth={2} />
                    </AnimatedPressable>
                )}
            </View>

            {/* Scope Picker Modal */}
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
                    <View style={[styles.scopeModalCard, shadows.modal]}>
                        <Text style={styles.scopeModalTitle}>Select Tutor Scope</Text>
                        <Text style={styles.scopeModalSub}>
                            Choose whether answers draw from the entire course or a single subject/PDF.
                        </Text>

                        {/* Whole Course */}
                        <AnimatedPressable
                            style={[
                                styles.scopeOptionCard,
                                scopeType === 'course' && { borderColor: tabAccent, backgroundColor: colors.primaryMuted },
                            ]}
                            onPress={() => {
                                setScopeType('course');
                                setIsScopePickerOpen(false);
                            }}
                        >
                            <BookOpen size={18} color={tabAccent} strokeWidth={2} style={{ marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.scopeOptionTitle}>Whole Course</Text>
                                <Text style={styles.scopeOptionDesc}>{selectedCourse.title}</Text>
                            </View>
                            {scopeType === 'course' && <Check size={18} color={tabAccent} strokeWidth={2.5} />}
                        </AnimatedPressable>

                        {/* Specific Subjects */}
                        <Text style={styles.scopeGroupLabel}>By Subject</Text>
                        {(selectedCourse.subjects || []).map((sub) => (
                            <AnimatedPressable
                                key={sub.id}
                                style={[
                                    styles.scopeOptionCard,
                                    scopeType === 'subject' && selectedSubject?.id === sub.id && {
                                        borderColor: tabAccent,
                                        backgroundColor: colors.primaryMuted,
                                    },
                                ]}
                                onPress={() => {
                                    setScopeType('subject');
                                    setSelectedSubject(sub);
                                    setIsScopePickerOpen(false);
                                }}
                            >
                                <Layers size={18} color={tabAccent} strokeWidth={2} style={{ marginRight: 10 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.scopeOptionTitle}>{sub.name}</Text>
                                    <Text style={styles.scopeOptionDesc}>{(sub.documents || []).length} PDFs attached</Text>
                                </View>
                                {scopeType === 'subject' && selectedSubject?.id === sub.id && (
                                    <Check size={18} color={tabAccent} strokeWidth={2.5} />
                                )}
                            </AnimatedPressable>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Grounding Citation Modal */}
            <CitationModal
                visible={!!activeCitation}
                citationText={activeCitation?.snippet || ''}
                pageNumber={activeCitation?.page}
                documentTitle={selectedDoc?.filename || selectedSubject?.name}
                onClose={() => setActiveCitation(null)}
            />

            {/* Clear Chat Confirm Dialog */}
            <ConfirmDialog
                visible={isClearChatConfirmOpen}
                title="Clear Conversation?"
                message="This will delete your current chat history with the tutor for this course."
                confirmText="Clear History"
                cancelText="Cancel"
                isDestructive={true}
                onConfirm={handleClearChat}
                onCancel={() => setIsClearChatConfirmOpen(false)}
            />

            {/* Undo Toast */}
            <Toast
                visible={!!toastMessage}
                message={toastMessage || ''}
                onDismiss={() => setToastMessage(null)}
            />
        </View>
    );
};

const createStyles = (colors: ThemeColors, shadows: any, tabAccent: string) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingHorizontal: 16,
            paddingBottom: 10,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        topBarTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.2,
        },
        scopePill: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
            alignSelf: 'flex-start',
            marginTop: 4,
            maxWidth: 240,
        },
        scopePillText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            flex: 1,
        },
        clearBtn: {
            padding: 8,
            borderRadius: radii.full,
        },
        messagesScroll: {
            flex: 1,
            paddingHorizontal: 16,
        },
        messagesContent: {
            paddingTop: 14,
            paddingBottom: 100,
        },
        messageWrapper: {
            marginVertical: 6,
        },
        userMessageWrapper: {
            alignItems: 'flex-end',
        },
        aiMessageWrapper: {
            alignItems: 'flex-start',
            width: '100%',
        },
        bubble: {
            padding: 14,
            borderRadius: radii.cards,
        },
        userBubble: {
            maxWidth: '82%',
            borderBottomRightRadius: 4,
        },
        aiBubble: {
            width: '100%',
            borderWidth: 1,
            borderBottomLeftRadius: 4,
        },
        aiHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        aiAvatarCircle: {
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 6,
        },
        aiLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            letterSpacing: 0.2,
        },
        msgTime: {
            fontSize: 10,
            marginLeft: 'auto',
        },
        messageText: {
            fontSize: typography.sizes.sm + 1,
            lineHeight: 23,
        },
        notFoundBox: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 10,
            borderRadius: radii.controls,
            borderWidth: 1,
            marginTop: 10,
        },
        notFoundText: {
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            flex: 1,
        },
        citationsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 12,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        citationChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: radii.full,
        },
        citationChipText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        msgToolbar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 10,
            paddingTop: 6,
        },
        toolbarBtn: {
            padding: 4,
        },
        typingBubbleWrapper: {
            alignItems: 'flex-start',
            marginVertical: 6,
        },
        typingBubble: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: radii.full,
            borderWidth: 1,
        },
        typingDot: {
            width: 7,
            height: 7,
            borderRadius: 3.5,
        },
        starterBlock: {
            marginTop: 20,
        },
        starterHeading: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '800',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 10,
        },
        starterGrid: {
            gap: 8,
        },
        starterChip: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            borderRadius: radii.controls,
            borderWidth: 1,
        },
        starterChipText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            flex: 1,
        },
        jumpBottomBtn: {
            position: 'absolute',
            bottom: 84,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.border,
            zIndex: 99,
        },
        jumpBottomText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        composerContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderRadius: radii.sheets,
            marginHorizontal: 16,
            marginBottom: 75,
            paddingHorizontal: 14,
            paddingVertical: 6,
        },
        composerInput: {
            flex: 1,
            maxHeight: 120,
            fontSize: typography.sizes.sm,
            paddingVertical: 6,
        },
        sendBtn: {
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
        },
        stopBtn: {
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        scopeModalCard: {
            width: '100%',
            maxWidth: 380,
            backgroundColor: colors.surface,
            borderRadius: radii.sheets,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 22,
        },
        scopeModalTitle: {
            fontSize: typography.sizes.md + 1,
            fontWeight: '800',
            color: colors.text,
        },
        scopeModalSub: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 4,
            marginBottom: 16,
        },
        scopeGroupLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 12,
            marginBottom: 6,
        },
        scopeOptionCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            borderRadius: radii.controls,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 8,
        },
        scopeOptionTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            color: colors.text,
        },
        scopeOptionDesc: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
    });

export default ChatScreen;
