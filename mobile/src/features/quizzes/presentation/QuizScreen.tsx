import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    TextInput,
    Alert,
    Platform,
} from 'react-native';
import {
    ChevronLeft,
    GraduationCap,
    Sparkles,
    Timer,
    CheckCircle2,
    XCircle,
    RotateCw,
    Award,
    AlertTriangle,
    BookOpen,
    HelpCircle,
    ArrowRight,
    ArrowLeft,
    Flame,
    FileText,
    X,
    Check,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme, useSafeTopGap, getStaticSafeTopGap } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import SegmentedControl from '../../../core/components/SegmentedControl';
import EmptyState from '../../../core/components/EmptyState';
import ConfirmDialog from '../../../core/components/ConfirmDialog';
import TactileButton from '../../../core/components/TactileButton';
import TactileCard from '../../../core/components/TactileCard';
import TactileProgressBar from '../../../core/components/TactileProgressBar';
import QuizFeedbackSheet from '../../../core/components/QuizFeedbackSheet';

interface QuizQuestion {
    id: number;
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
}

const formatTitle = (name?: string) => {
    if (!name) return 'Knowledge Base';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

const QuizScreen = ({ route, navigation }: any) => {
    const routeParams = route?.params || {};
    const pdfId = routeParams.pdfId;
    const initialTitle = routeParams.title ? formatTitle(routeParams.title) : '';

    const { colors, shadows, isDark } = useTheme();
    const topGap = useSafeTopGap();
    const styles = useMemo(() => createStyles(colors, topGap), [colors, topGap]);

    // Available documents for selector
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>(pdfId || '');
    const [customTopic, setCustomTopic] = useState<string>('');
    const [numQuestions, setNumQuestions] = useState<number>(5);
    const [examMode, setExamMode] = useState<'practice' | 'mock'>('practice');

    // Quiz Generation & Execution State
    const [generating, setGenerating] = useState(false);
    const [quizData, setQuizData] = useState<QuizQuestion[] | null>(null);
    const [activeTopic, setActiveTopic] = useState<string>('');

    // Active Quiz Session State
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);

    // Timed Mock Exam State
    const [timeLeft, setTimeLeft] = useState<number>(300);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        fetchDocs();
    }, []);

    useEffect(() => {
        if (pdfId) {
            setSelectedDocId(pdfId);
        }
    }, [pdfId]);

    const fetchDocs = async () => {
        try {
            const res = await apiClient.get('/pdf/list');
            setDocs(res.data || []);
            if (!selectedDocId && res.data && res.data.length > 0) {
                setSelectedDocId(res.data[0].id);
            }
        } catch {
            // Ignore error
        }
    };

    // Timer for Mock Exam Mode
    useEffect(() => {
        if (quizData && examMode === 'mock' && !submitted) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        handleSubmitExam();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [quizData, examMode, submitted]);

    const handleGenerateQuiz = async (topicOverride?: string) => {
        const selectedDoc = docs.find((d) => d.id === selectedDocId);
        const effectiveTopic =
            topicOverride ||
            customTopic.trim() ||
            (selectedDoc ? formatTitle(selectedDoc.original_name) : 'Core Document Concepts');

        setGenerating(true);
        setQuizData(null);
        setUserAnswers({});
        setSelectedOption(null);
        setCurrentQIndex(0);
        setSubmitted(false);
        setIsFeedbackOpen(false);
        setActiveTopic(effectiveTopic);
        setTimeLeft(numQuestions * 60);

        try {
            const response = await apiClient.post('/quiz/generate', {
                topic: effectiveTopic,
                pdf_id: selectedDocId || undefined,
                num_questions: numQuestions,
            });

            if (response.data && response.data.questions && response.data.questions.length > 0) {
                setQuizData(response.data.questions);
            } else {
                Alert.alert('Quiz Generation', 'Unable to generate questions for this topic. Please try again.');
            }
        } catch (err: any) {
            Alert.alert(
                'Quiz Notice',
                err?.response?.data?.detail || 'Failed to generate quiz. Please check server connection.'
            );
        } finally {
            setGenerating(false);
        }
    };

    const handleSelectOption = (option: string) => {
        if (isFeedbackOpen) return;
        setSelectedOption(option);
    };

    // Check Answer action in Practice Mode
    const handleCheckAnswer = () => {
        if (!selectedOption || !quizData) return;
        const currentQ = quizData[currentQIndex];

        setUserAnswers((prev) => ({ ...prev, [currentQ.id]: selectedOption }));

        if (examMode === 'practice') {
            setIsFeedbackOpen(true);
        } else {
            // Mock exam: advance directly
            handleAdvanceQuestion();
        }
    };

    const handleAdvanceQuestion = () => {
        setIsFeedbackOpen(false);
        setSelectedOption(null);

        if (quizData && currentQIndex + 1 < quizData.length) {
            setCurrentQIndex((prev) => prev + 1);
        } else {
            handleSubmitExam();
        }
    };

    const handleSubmitExam = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setSubmitted(true);
        setIsFeedbackOpen(false);
    };

    // Score Calculations
    const scoreSummary = useMemo(() => {
        if (!quizData) return { correct: 0, total: 0, percentage: 0, grade: 'F', weakSpots: [] };

        let correct = 0;
        const weakSpots: { question: string; explanation: string }[] = [];

        quizData.forEach((q) => {
            const ans = userAnswers[q.id];
            if (ans === q.correct_answer) {
                correct++;
            } else {
                weakSpots.push({ question: q.question, explanation: q.explanation });
            }
        });

        const total = quizData.length;
        const percentage = Math.round((correct / total) * 100);

        let grade = 'F';
        if (percentage >= 90) grade = 'A+';
        else if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B';
        else if (percentage >= 60) grade = 'C';
        else if (percentage >= 50) grade = 'D';

        return { correct, total, percentage, grade, weakSpots };
    }, [quizData, userAnswers]);

    const formatTimer = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const currentDocObj = docs.find((d) => d.id === selectedDocId);
    const displayDocTitle = currentDocObj
        ? formatTitle(currentDocObj.original_name)
        : initialTitle || 'Select Document';

    const currentQ = quizData ? quizData[currentQIndex] : null;
    const isAnswerCorrect = currentQ && selectedOption ? selectedOption === currentQ.correct_answer : false;

    return (
        <View style={styles.container}>
            {/* ── Top Header ── */}
            {!quizData || submitted ? (
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        onPress={() => navigation?.goBack?.()}
                        style={styles.backBtn}
                        activeOpacity={0.7}
                        accessibilityLabel="Go Back"
                    >
                        <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
                    </TouchableOpacity>

                    <View style={styles.titleContainer}>
                        <Text style={styles.headerTitle}>Practice &amp; Quiz Arena</Text>
                        <Text style={styles.headerSub}>Adaptive Tests &amp; Active Recall</Text>
                    </View>
                </View>
            ) : (
                /* Active Quiz Top Bar with Exit X and Progress Bar */
                <View style={styles.activeTopBar}>
                    <TouchableOpacity
                        onPress={() => setIsQuitConfirmOpen(true)}
                        style={styles.closeQuizBtn}
                        accessibilityLabel="Quit practice"
                    >
                        <X size={22} color={colors.textMuted} strokeWidth={2.5} />
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <TactileProgressBar
                            progress={((currentQIndex + 1) / quizData.length) * 100}
                            height={12}
                            variant="accent"
                        />
                    </View>

                    {examMode === 'mock' && (
                        <View style={[styles.timerBadge, timeLeft < 60 && { backgroundColor: colors.dangerMuted }]}>
                            <Timer size={14} color={timeLeft < 60 ? colors.danger : colors.accent} />
                            <Text style={[styles.timerText, { color: timeLeft < 60 ? colors.danger : colors.accent }]}>
                                {formatTimer(timeLeft)}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* ================================================================= */}
            {/* 1. QUIZ SETUP SCREEN */}
            {/* ================================================================= */}
            {!quizData && !generating && (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Mode Selector */}
                    <View style={styles.sectionBox}>
                        <Text style={styles.sectionLabel}>Select Mode</Text>
                        <SegmentedControl
                            options={[
                                { key: 'practice', label: 'Practice Quiz', icon: BookOpen },
                                { key: 'mock', label: 'Timed Mock Exam', icon: Timer },
                            ]}
                            selectedKey={examMode}
                            onSelect={(key) => setExamMode(key as 'practice' | 'mock')}
                        />
                    </View>

                    {/* Document Selector Chips */}
                    {docs.length > 0 && (
                        <View style={styles.sectionBox}>
                            <Text style={styles.sectionLabel}>Target Document</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.docScroll}>
                                {docs.map((doc) => {
                                    const isSel = doc.id === selectedDocId;
                                    return (
                                        <TouchableOpacity
                                            key={doc.id}
                                            style={[styles.docChip, isSel && styles.docChipActive]}
                                            onPress={() => setSelectedDocId(doc.id)}
                                        >
                                            <FileText
                                                size={13}
                                                color={isSel ? colors.textInverse : colors.textMuted}
                                                style={{ marginRight: 6 }}
                                            />
                                            <Text
                                                style={[styles.docChipText, isSel && styles.docChipTextActive]}
                                                numberOfLines={1}
                                            >
                                                {formatTitle(doc.original_name)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Custom Topic Input */}
                    <View style={styles.sectionBox}>
                        <Text style={styles.sectionLabel}>Topic Focus (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder={`e.g. Chapter 3 transport mechanisms...`}
                            placeholderTextColor={colors.textMuted}
                            value={customTopic}
                            onChangeText={setCustomTopic}
                        />
                    </View>

                    {/* Question Count Selector */}
                    <View style={styles.sectionBox}>
                        <Text style={styles.sectionLabel}>Questions Count</Text>
                        <View style={styles.countRow}>
                            {[3, 5, 10, 15].map((num) => {
                                const isSel = numQuestions === num;
                                return (
                                    <TouchableOpacity
                                        key={num}
                                        style={[
                                            styles.countBtn,
                                            isSel && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
                                        ]}
                                        onPress={() => setNumQuestions(num)}
                                    >
                                        <Text
                                            style={[
                                                styles.countBtnText,
                                                isSel && { color: colors.accent, fontWeight: '800' },
                                            ]}
                                        >
                                            {num}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Primary Generate Button */}
                    <TactileButton
                        title={examMode === 'mock' ? 'Start Mock Exam' : 'Start Practice Quiz'}
                        onPress={() => handleGenerateQuiz()}
                        variant="primary"
                        size="lg"
                        fullWidth
                        icon={Sparkles}
                        style={{ marginTop: 8, marginBottom: 16 }}
                    />

                    {/* Info Card */}
                    <TactileCard contentStyle={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <Award size={28} color={colors.accent} strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoCardTitle}>Active Recall Practice</Text>
                            <Text style={styles.infoCardText}>
                                Formulated directly from your notes with instant feedback and step-by-step answer derivations.
                            </Text>
                        </View>
                    </TactileCard>
                </ScrollView>
            )}

            {/* ================================================================= */}
            {/* 2. GENERATING SKELETON */}
            {/* ================================================================= */}
            {generating && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.generatingTitle}>Synthesizing Quiz Questions</Text>
                    <Text style={styles.generatingSub}>
                        Analyzing materials, formulating distractors, and preparing verified explanations...
                    </Text>
                </View>
            )}

            {/* ================================================================= */}
            {/* 3. ACTIVE 1-QUESTION PER SCREEN PRACTICE FLOW */}
            {/* ================================================================= */}
            {quizData && !submitted && currentQ && (
                <View style={styles.activeQuizContainer}>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.questionScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.questionNumLabel}>
                            Question {currentQIndex + 1} of {quizData.length}
                        </Text>
                        <Text style={styles.questionText}>{currentQ.question}</Text>

                        {/* 4 Large Tactile Answer Cards */}
                        <View style={styles.optionsContainer}>
                            {currentQ.options.map((opt, oIdx) => {
                                const isSelected = selectedOption === opt;
                                const letter = String.fromCharCode(65 + oIdx);

                                return (
                                    <TactileCard
                                        key={oIdx}
                                        selected={isSelected}
                                        onPress={() => handleSelectOption(opt)}
                                        variant="accent"
                                        contentStyle={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 16,
                                            gap: 12,
                                        }}
                                        accessibilityLabel={`Option ${letter}: ${opt}`}
                                    >
                                        <View
                                            style={[
                                                styles.optionLetterPill,
                                                {
                                                    backgroundColor: isSelected ? colors.accent : colors.surfaceRaised,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionLetterText,
                                                    { color: isSelected ? colors.textInverse : colors.text },
                                                ]}
                                            >
                                                {letter}
                                            </Text>
                                        </View>

                                        <Text
                                            style={[
                                                styles.optionText,
                                                { color: isSelected ? colors.accent : colors.text },
                                            ]}
                                        >
                                            {opt}
                                        </Text>
                                    </TactileCard>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Bottom Primary Check / Submit Action Bar */}
                    <View style={styles.bottomBar}>
                        <TactileButton
                            title="Check Answer"
                            onPress={handleCheckAnswer}
                            disabled={!selectedOption}
                            variant="primary"
                            size="lg"
                            fullWidth
                        />
                    </View>

                    {/* Sliding Feedback Bottom Sheet (Duolingo Style) */}
                    <QuizFeedbackSheet
                        visible={isFeedbackOpen}
                        isCorrect={isAnswerCorrect}
                        correctAnswerText={currentQ.correct_answer}
                        explanation={currentQ.explanation}
                        onContinue={handleAdvanceQuestion}
                    />
                </View>
            )}

            {/* ================================================================= */}
            {/* 4. RESULT & SCORECARD SCREEN */}
            {/* ================================================================= */}
            {quizData && submitted && (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <TactileCard contentStyle={{ padding: 24, alignItems: 'center' }}>
                        <View style={[styles.trophyWrapper, { backgroundColor: colors.accentMuted }]}>
                            <Award size={52} color={colors.accent} strokeWidth={2.5} />
                        </View>

                        <Text style={styles.scoreTitle}>Quiz Completed!</Text>
                        <Text style={styles.scoreSub}>{activeTopic}</Text>

                        {/* Grade Badge */}
                        <View style={[styles.gradeCircle, { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }]}>
                            <Text style={[styles.gradeText, { color: colors.accent }]}>{scoreSummary.grade}</Text>
                            <Text style={[styles.percentageText, { color: colors.textMuted }]}>{scoreSummary.percentage}%</Text>
                        </View>

                        <Text style={styles.scoreRatio}>
                            {scoreSummary.correct} of {scoreSummary.total} Questions Correct
                        </Text>

                        {/* Weak Spots Detected */}
                        {scoreSummary.weakSpots.length > 0 && (
                            <View style={styles.weakSpotBox}>
                                <View style={styles.weakSpotHeader}>
                                    <AlertTriangle size={16} color={colors.goldDark} />
                                    <Text style={[styles.weakSpotLabel, { color: colors.goldDark }]}>
                                        Weak Spots to Review ({scoreSummary.weakSpots.length})
                                    </Text>
                                </View>
                                {scoreSummary.weakSpots.map((item, i) => (
                                    <View key={i} style={styles.weakSpotItemBox}>
                                        <Text style={styles.weakSpotQuestion}>• {item.question}</Text>
                                        <Text style={styles.weakSpotExplanation}>{item.explanation}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <TactileButton
                            title="Practice Again"
                            onPress={() => handleGenerateQuiz()}
                            variant="primary"
                            size="lg"
                            fullWidth
                            icon={RotateCw}
                            style={{ marginBottom: 10, marginTop: 10 }}
                        />

                        <TactileButton
                            title="Back to Quiz Arena"
                            onPress={() => {
                                setQuizData(null);
                                setSubmitted(false);
                            }}
                            variant="secondary"
                            size="md"
                            fullWidth
                        />
                    </TactileCard>
                </ScrollView>
            )}

            {/* Quit Confirmation Dialog */}
            <ConfirmDialog
                visible={isQuitConfirmOpen}
                title="Leave Quiz Session?"
                message="Your current quiz progress will be lost."
                confirmText="Leave"
                cancelText="Keep Going"
                isDestructive
                onConfirm={() => {
                    setIsQuitConfirmOpen(false);
                    setQuizData(null);
                }}
                onCancel={() => setIsQuitConfirmOpen(false)}
            />
        </View>
    );
};

const createStyles = (colors: ThemeColors, topGap: number = getStaticSafeTopGap()) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
            paddingTop: topGap,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            marginBottom: 14,
        },
        backBtn: {
            width: 38,
            height: 38,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 2,
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
            fontSize: typography.sizes.md,
            fontWeight: '800',
        },
        headerSub: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '600',
            marginTop: 1,
        },
        activeTopBar: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingBottom: 10,
        },
        closeQuizBtn: {
            padding: 4,
        },
        timerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.accentMuted,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radii.full,
            gap: 4,
        },
        timerText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        scroll: {
            flex: 1,
            paddingHorizontal: 20,
        },
        scrollContent: {
            paddingBottom: 110,
        },
        sectionBox: {
            marginBottom: 14,
        },
        sectionLabel: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
        },
        docScroll: {
            flexDirection: 'row',
        },
        docChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.full,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginRight: 8,
            maxWidth: 200,
        },
        docChipActive: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        docChipText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        docChipTextActive: {
            color: colors.textInverse,
            fontWeight: '800',
        },
        textInput: {
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: typography.sizes.sm,
            color: colors.text,
            fontWeight: '600',
        },
        countRow: {
            flexDirection: 'row',
            gap: 8,
        },
        countBtn: {
            flex: 1,
            paddingVertical: 12,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: radii.lg,
            alignItems: 'center',
        },
        countBtnText: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        infoCardTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 2,
        },
        infoCardText: {
            fontSize: typography.sizes.xs,
            color: colors.textSecondary,
            lineHeight: 18,
            fontWeight: '500',
        },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
        },
        generatingTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
            marginTop: 16,
            textAlign: 'center',
        },
        generatingSub: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 18,
        },
        activeQuizContainer: {
            flex: 1,
            justifyContent: 'space-between',
        },
        questionScrollContent: {
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 20,
        },
        questionNumLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: colors.textMuted,
            marginBottom: 8,
        },
        questionText: {
            fontSize: 20,
            fontWeight: '800',
            color: colors.text,
            lineHeight: 28,
            marginBottom: 20,
        },
        optionsContainer: {
            gap: 6,
        },
        optionLetterPill: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        optionLetterText: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
        },
        optionText: {
            flex: 1,
            fontSize: typography.sizes.md,
            fontWeight: '700',
            lineHeight: 22,
        },
        bottomBar: {
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderTopWidth: 2,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            paddingBottom: Platform.OS === 'ios' ? 32 : 14,
        },
        trophyWrapper: {
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
        },
        scoreTitle: {
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 4,
        },
        scoreSub: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '600',
            marginBottom: 16,
        },
        gradeCircle: {
            width: 90,
            height: 90,
            borderRadius: 45,
            borderWidth: 3,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
        },
        gradeText: {
            fontSize: 28,
            fontWeight: '800',
        },
        percentageText: {
            fontSize: 12,
            fontWeight: '700',
        },
        scoreRatio: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            color: colors.textSecondary,
            marginBottom: 16,
        },
        weakSpotBox: {
            width: '100%',
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.xl,
            padding: 14,
            marginBottom: 16,
        },
        weakSpotHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
        },
        weakSpotLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            textTransform: 'uppercase',
        },
        weakSpotItemBox: {
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
        },
        weakSpotQuestion: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 2,
        },
        weakSpotExplanation: {
            fontSize: 11,
            color: colors.textMuted,
            lineHeight: 16,
        },
    });

export default QuizScreen;
