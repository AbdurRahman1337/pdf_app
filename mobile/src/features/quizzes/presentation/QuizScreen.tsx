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
    Flame,
    FileText,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, darkShadows } from '../../../core/theme/tokens';
import SegmentedControl from '../../../core/components/SegmentedControl';
import EmptyState from '../../../core/components/EmptyState';

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

    const { colors, shadows } = useTheme();
    const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

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

    // Quiz Session State
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [submitted, setSubmitted] = useState(false);

    // Timed Mock Exam State
    const [timeLeft, setTimeLeft] = useState<number>(300); // 5 mins in seconds
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

    // Timer handler for Mock Exam Mode
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
        setCurrentQIndex(0);
        setSubmitted(false);
        setActiveTopic(effectiveTopic);
        setTimeLeft(numQuestions * 60); // 1 minute per question in mock mode

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

    const handleSelectOption = (qId: number, option: string) => {
        if (submitted && examMode === 'practice') return;
        setUserAnswers((prev) => ({ ...prev, [qId]: option }));
    };

    const handleSubmitExam = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setSubmitted(true);
    };

    // Score Calculations
    const scoreSummary = useMemo(() => {
        if (!quizData) return { correct: 0, total: 0, percentage: 0, grade: 'F', weakSpots: [] };

        let correct = 0;
        const weakSpots: string[] = [];

        quizData.forEach((q) => {
            const ans = userAnswers[q.id];
            if (ans === q.correct_answer) {
                correct++;
            } else {
                weakSpots.push(q.question);
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

    return (
        <View style={styles.container}>
            {/* ── Top Header ── */}
            <View style={styles.headerRow}>
                {navigation?.canGoBack?.() ? (
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                        activeOpacity={0.7}
                    >
                        <ChevronLeft size={22} color={colors.text} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.headerIconBg}>
                        <GraduationCap size={20} color={colors.accent} />
                    </View>
                )}

                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle}>AI Exam &amp; Quiz Arena</Text>
                    <Text style={styles.headerSub}>Adaptive Testing &amp; Timed Mock Exams</Text>
                </View>

                {quizData && (
                    <TouchableOpacity
                        onPress={() => handleGenerateQuiz()}
                        style={styles.headerActionBtn}
                        activeOpacity={0.7}
                    >
                        <RotateCw size={17} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* ================================================================= */}
            {/* QUIZ SETUP SCREEN */}
            {/* ================================================================= */}
            {!quizData && !generating && (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Mode Selector */}
                    <View style={styles.sectionBox}>
                        <Text style={styles.sectionLabel}>Select Assessment Mode</Text>
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
                            <Text style={styles.sectionLabel}>Target Study Document</Text>
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
                        <View style={styles.inputWrap}>
                            <TextInput
                                style={styles.textInput}
                                placeholder={`e.g., Core Principles of ${displayDocTitle.substring(0, 20)}...`}
                                placeholderTextColor={colors.textSubtle}
                                value={customTopic}
                                onChangeText={setCustomTopic}
                            />
                        </View>
                    </View>

                    {/* Question Count Selector */}
                    <View style={styles.sectionBox}>
                        <Text style={styles.sectionLabel}>Question Quantity</Text>
                        <View style={styles.countRow}>
                            {[3, 5, 10, 15].map((num) => {
                                const isSel = numQuestions === num;
                                return (
                                    <TouchableOpacity
                                        key={num}
                                        style={[styles.countBtn, isSel && styles.countBtnActive]}
                                        onPress={() => setNumQuestions(num)}
                                    >
                                        <Text style={[styles.countBtnText, isSel && styles.countBtnTextActive]}>
                                            {num} Questions
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Generate Button */}
                    <TouchableOpacity
                        style={styles.generateBtn}
                        onPress={() => handleGenerateQuiz()}
                        activeOpacity={0.85}
                    >
                        <Sparkles size={18} color={colors.textInverse} style={{ marginRight: 8 }} />
                        <Text style={styles.generateBtnText}>
                            {examMode === 'mock' ? 'Start Timed Mock Exam' : 'Generate Practice Quiz'}
                        </Text>
                    </TouchableOpacity>

                    {/* Info Card */}
                    <View style={styles.infoCard}>
                        <Award size={20} color={colors.indigo} style={{ marginRight: 12, marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoCardTitle}>Active Recall Assessment</Text>
                            <Text style={styles.infoCardText}>
                                The AI extracts real verified test questions grounded in your course materials.
                                In Mock Exam mode, questions are timed with full diagnostic scorecards at completion.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            )}

            {/* ================================================================= */}
            {/* GENERATING SKELETON / LOADER */}
            {/* ================================================================= */}
            {generating && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.generatingTitle}>Synthesizing Rigorous Quiz</Text>
                    <Text style={styles.generatingSub}>
                        Analyzing notes, formulating distractors, and building answer explanations...
                    </Text>
                </View>
            )}

            {/* ================================================================= */}
            {/* ACTIVE QUIZ / EXAM SCREEN */}
            {/* ================================================================= */}
            {quizData && !submitted && (
                <View style={styles.activeQuizContainer}>
                    {/* Status Top Bar */}
                    <View style={styles.quizProgressBarRow}>
                        <Text style={styles.questionIndexText}>
                            Question {currentQIndex + 1} of {quizData.length}
                        </Text>

                        {examMode === 'mock' && (
                            <View style={[styles.timerBadge, timeLeft < 60 && styles.timerBadgeWarning]}>
                                <Timer size={14} color={timeLeft < 60 ? colors.danger : colors.accent} />
                                <Text style={[styles.timerText, timeLeft < 60 && { color: colors.danger }]}>
                                    {formatTimer(timeLeft)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarBg}>
                        <View
                            style={[
                                styles.progressBarFill,
                                { width: `${((currentQIndex + 1) / quizData.length) * 100}%` },
                            ]}
                        />
                    </View>

                    {/* Question Card Scroll Area */}
                    <ScrollView
                        style={styles.quizScroll}
                        contentContainerStyle={styles.quizScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {(() => {
                            const currentQ = quizData[currentQIndex];
                            const selectedOption = userAnswers[currentQ.id];
                            const isAnswered = selectedOption !== undefined;

                            return (
                                <View style={styles.questionCard}>
                                    <Text style={styles.questionText}>{currentQ.question}</Text>

                                    {/* Options List */}
                                    <View style={styles.optionsList}>
                                        {currentQ.options.map((opt, oIdx) => {
                                            const isSelected = selectedOption === opt;
                                            const isCorrect = opt === currentQ.correct_answer;

                                            let optStyle: any = styles.optionBtn;
                                            let textStyle: any = styles.optionText;

                                            if (examMode === 'practice' && isAnswered) {
                                                if (isCorrect) {
                                                    optStyle = [styles.optionBtn, styles.optionCorrect];
                                                    textStyle = [styles.optionText, styles.optionTextCorrect];
                                                } else if (isSelected && !isCorrect) {
                                                    optStyle = [styles.optionBtn, styles.optionIncorrect];
                                                    textStyle = [styles.optionText, styles.optionTextIncorrect];
                                                }
                                            } else if (isSelected) {
                                                optStyle = [styles.optionBtn, styles.optionSelected];
                                                textStyle = [styles.optionText, styles.optionTextSelected];
                                            }

                                            return (
                                                <TouchableOpacity
                                                    key={oIdx}
                                                    style={optStyle}
                                                    onPress={() => handleSelectOption(currentQ.id, opt)}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={styles.optionLetterBadge}>
                                                        <Text style={styles.optionLetterText}>
                                                            {String.fromCharCode(65 + oIdx)}
                                                        </Text>
                                                    </View>
                                                    <Text style={textStyle}>{opt}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Practice Mode Immediate Explanation */}
                                    {examMode === 'practice' && isAnswered && (
                                        <View style={styles.explanationBox}>
                                            <View style={styles.explanationHeader}>
                                                <HelpCircle size={14} color={colors.accent} />
                                                <Text style={styles.explanationLabel}>
                                                    {selectedOption === currentQ.correct_answer
                                                        ? 'CORRECT'
                                                        : 'EXPLANATION'}
                                                </Text>
                                            </View>
                                            <Text style={styles.explanationText}>
                                                {currentQ.explanation}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })()}
                    </ScrollView>

                    {/* Bottom Navigation Buttons */}
                    <View style={styles.bottomNavRow}>
                        <TouchableOpacity
                            style={[styles.navStepBtn, currentQIndex === 0 && { opacity: 0.4 }]}
                            disabled={currentQIndex === 0}
                            onPress={() => setCurrentQIndex((prev) => prev - 1)}
                        >
                            <Text style={styles.navStepBtnText}>Previous</Text>
                        </TouchableOpacity>

                        {currentQIndex < quizData.length - 1 ? (
                            <TouchableOpacity
                                style={[styles.navStepBtn, styles.navStepBtnPrimary]}
                                onPress={() => setCurrentQIndex((prev) => prev + 1)}
                            >
                                <Text style={styles.navStepBtnTextPrimary}>Next Question</Text>
                                <ArrowRight size={16} color={colors.textInverse} style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.navStepBtn, styles.navStepBtnSubmit]}
                                onPress={handleSubmitExam}
                            >
                                <CheckCircle2 size={16} color={colors.textInverse} style={{ marginRight: 6 }} />
                                <Text style={styles.navStepBtnTextPrimary}>Submit Exam</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            {/* ================================================================= */}
            {/* SCORECARD & WEAK-SPOT REPORT */}
            {/* ================================================================= */}
            {quizData && submitted && (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.scoreCardContainer}>
                        <View style={styles.trophyWrapper}>
                            <Award size={48} color={colors.accent} />
                        </View>

                        <Text style={styles.scoreTitle}>Assessment Completed!</Text>
                        <Text style={styles.scoreSub}>{activeTopic}</Text>

                        {/* Grade Badge */}
                        <View style={styles.gradeCircle}>
                            <Text style={styles.gradeText}>{scoreSummary.grade}</Text>
                            <Text style={styles.percentageText}>{scoreSummary.percentage}%</Text>
                        </View>

                        <Text style={styles.scoreRatio}>
                            {scoreSummary.correct} of {scoreSummary.total} Questions Correct
                        </Text>

                        {/* Weak Spots Detected */}
                        {scoreSummary.weakSpots.length > 0 && (
                            <View style={styles.weakSpotBox}>
                                <View style={styles.weakSpotHeader}>
                                    <AlertTriangle size={15} color={colors.warning} />
                                    <Text style={styles.weakSpotLabel}>
                                        Weak Spots Detected ({scoreSummary.weakSpots.length})
                                    </Text>
                                </View>
                                <Text style={styles.weakSpotDesc}>
                                    Concepts to review before test day:
                                </Text>
                                {scoreSummary.weakSpots.map((qText, i) => (
                                    <Text key={i} style={styles.weakSpotItem}>
                                        • {qText}
                                    </Text>
                                ))}
                            </View>
                        )}

                        {/* Action Buttons */}
                        <TouchableOpacity
                            style={styles.retakeBtn}
                            onPress={() => handleGenerateQuiz()}
                            activeOpacity={0.85}
                        >
                            <RotateCw size={16} color={colors.textInverse} style={{ marginRight: 6 }} />
                            <Text style={styles.retakeBtnText}>Generate New Quiz</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.backConfigBtn}
                            onPress={() => {
                                setQuizData(null);
                                setSubmitted(false);
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.backConfigBtnText}>Configure Another Assessment</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </View>
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
            marginBottom: spacing.md,
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
        headerActionBtn: {
            width: 38,
            height: 38,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        scroll: {
            flex: 1,
            paddingHorizontal: spacing.lg,
        },
        scrollContent: {
            paddingBottom: spacing.xxl,
        },
        sectionBox: {
            marginBottom: spacing.md,
        },
        sectionLabel: {
            color: colors.textSubtle,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 6,
        },
        docScroll: {
            flexDirection: 'row',
        },
        docChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
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
            fontWeight: '600',
        },
        docChipTextActive: {
            color: colors.textInverse,
            fontWeight: '700',
        },
        inputWrap: {
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: 8,
        },
        textInput: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            padding: 0,
        },
        countRow: {
            flexDirection: 'row',
            gap: 8,
        },
        countBtn: {
            flex: 1,
            paddingVertical: 9,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            alignItems: 'center',
        },
        countBtnActive: {
            backgroundColor: colors.accentMuted,
            borderColor: colors.accent,
        },
        countBtnText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        countBtnTextActive: {
            color: colors.accent,
            fontWeight: '700',
        },
        generateBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
            paddingVertical: 14,
            borderRadius: radii.lg,
            marginTop: spacing.sm,
            marginBottom: spacing.lg,
            ...shadows.glowAccent,
        },
        generateBtnText: {
            color: colors.textInverse,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        infoCard: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            padding: spacing.md,
            ...shadows.card,
        },
        infoCardTitle: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            marginBottom: 3,
        },
        infoCardText: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
        },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: spacing.xl,
        },
        generatingTitle: {
            color: colors.text,
            fontSize: typography.sizes.md,
            fontWeight: '700',
            marginTop: 16,
            textAlign: 'center',
        },
        generatingSub: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 18,
        },
        activeQuizContainer: {
            flex: 1,
            paddingHorizontal: spacing.lg,
            justifyContent: 'space-between',
        },
        quizProgressBarRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        questionIndexText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        timerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.accentMuted,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radii.full,
            gap: 4,
        },
        timerBadgeWarning: {
            backgroundColor: colors.dangerMuted,
        },
        timerText: {
            color: colors.accent,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        progressBarBg: {
            height: 4,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: 2,
            marginBottom: spacing.md,
            overflow: 'hidden',
        },
        progressBarFill: {
            height: '100%',
            backgroundColor: colors.accent,
        },
        quizScroll: {
            flex: 1,
        },
        quizScrollContent: {
            paddingBottom: spacing.lg,
        },
        questionCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: spacing.lg,
            ...shadows.card,
        },
        questionText: {
            color: colors.text,
            fontSize: typography.sizes.base,
            fontWeight: '700',
            lineHeight: 24,
            marginBottom: spacing.lg,
        },
        optionsList: {
            gap: 10,
        },
        optionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.md,
        },
        optionSelected: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        optionCorrect: {
            borderColor: colors.success,
            backgroundColor: colors.successMuted,
        },
        optionIncorrect: {
            borderColor: colors.danger,
            backgroundColor: colors.dangerMuted,
        },
        optionLetterBadge: {
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
        },
        optionLetterText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
        },
        optionText: {
            color: colors.textSecondary,
            fontSize: typography.sizes.sm,
            flex: 1,
            fontWeight: '500',
        },
        optionTextSelected: {
            color: colors.accent,
            fontWeight: '700',
        },
        optionTextCorrect: {
            color: colors.success,
            fontWeight: '700',
        },
        optionTextIncorrect: {
            color: colors.danger,
            fontWeight: '600',
        },
        explanationBox: {
            marginTop: spacing.md,
            padding: spacing.sm,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            borderLeftWidth: 3,
            borderLeftColor: colors.accent,
        },
        explanationHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
            gap: 4,
        },
        explanationLabel: {
            color: colors.accent,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.5,
        },
        explanationText: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
        },
        bottomNavRow: {
            flexDirection: 'row',
            gap: 10,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        navStepBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
        },
        navStepBtnPrimary: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        navStepBtnSubmit: {
            backgroundColor: colors.success,
            borderColor: colors.success,
        },
        navStepBtnText: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
        navStepBtnTextPrimary: {
            color: colors.textInverse,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        scoreCardContainer: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: spacing.xl,
            alignItems: 'center',
            ...shadows.card,
        },
        trophyWrapper: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.accentMuted,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.md,
        },
        scoreTitle: {
            color: colors.text,
            fontSize: typography.sizes.lg,
            fontWeight: '700',
            textAlign: 'center',
        },
        scoreSub: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            marginTop: 2,
            textAlign: 'center',
            marginBottom: spacing.lg,
        },
        gradeCircle: {
            width: 110,
            height: 110,
            borderRadius: 55,
            borderWidth: 4,
            borderColor: colors.accent,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.surfaceSubtle,
            marginBottom: spacing.md,
        },
        gradeText: {
            color: colors.text,
            fontSize: 32,
            fontWeight: '900',
        },
        percentageText: {
            color: colors.accent,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        scoreRatio: {
            color: colors.textSecondary,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            marginBottom: spacing.md,
        },
        weakSpotBox: {
            width: '100%',
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
            borderLeftWidth: 3,
            borderLeftColor: colors.warning,
        },
        weakSpotHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
        },
        weakSpotLabel: {
            color: colors.warning,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        weakSpotDesc: {
            color: colors.textSubtle,
            fontSize: 11,
            marginBottom: 6,
        },
        weakSpotItem: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            marginBottom: 4,
        },
        retakeBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
            width: '100%',
            paddingVertical: 13,
            borderRadius: radii.md,
            marginBottom: 8,
            ...shadows.glowAccent,
        },
        retakeBtnText: {
            color: colors.textInverse,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        backConfigBtn: {
            paddingVertical: 10,
        },
        backConfigBtnText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
    });

export default QuizScreen;
