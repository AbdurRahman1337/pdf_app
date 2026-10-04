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
    Animated,
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
    Lightbulb,
    RotateCcw,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, gradients } from '../../../core/theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../../../core/theme/motion';
import SegmentedControl from '../../../core/components/SegmentedControl';
import EmptyState from '../../../core/components/EmptyState';
import ProgressRing from '../../../core/components/ProgressRing';
import ConfettiBurst from '../../../core/components/ConfettiBurst';
import { AnimatedPressable } from '../../../core/components/AnimatedPressable';
import { GradientButton } from '../../../core/components/GradientView';

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

    const { colors, shadows, typography, isDark } = useTheme();
    const tabAccent = colors.tabCourseHub; // Blue #2F6FED
    const styles = useMemo(() => createStyles(colors, shadows, tabAccent), [colors, shadows, tabAccent]);

    // Available documents for selector
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>(pdfId || '');
    const [customTopic, setCustomTopic] = useState<string>('');
    const [numQuestions, setNumQuestions] = useState<number>(5);

    // Quiz Generation & Execution State
    const [generating, setGenerating] = useState(false);
    const [quizData, setQuizData] = useState<QuizQuestion[] | null>(null);
    const [activeTopic, setActiveTopic] = useState<string>('');

    // Quiz Session State
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [submitted, setSubmitted] = useState(false);

    // Wrong answer shake animation
    const shakeAnim = useRef(new Animated.Value(0)).current;

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

    const handleGenerateQuiz = async (topicOverride?: string) => {
        const selectedDoc = docs.find((d) => d.id === selectedDocId);
        const effectiveTopic =
            topicOverride ||
            customTopic.trim() ||
            (selectedDoc ? formatTitle(selectedDoc.original_name) : 'Core Curriculum Concepts');

        setGenerating(true);
        setQuizData(null);
        setUserAnswers({});
        setCurrentQIndex(0);
        setSubmitted(false);
        setActiveTopic(effectiveTopic);
        triggerHaptic('selection');

        try {
            const response = await apiClient.post('/quiz/generate', {
                topic: effectiveTopic,
                pdf_id: selectedDocId || undefined,
                num_questions: numQuestions,
            });

            if (response.data && response.data.questions && response.data.questions.length > 0) {
                setQuizData(response.data.questions);
            } else {
                setQuizData(getFallbackQuestions());
            }
        } catch {
            setQuizData(getFallbackQuestions());
        } finally {
            setGenerating(false);
        }
    };

    const getFallbackQuestions = (): QuizQuestion[] => [
        {
            id: 1,
            question: 'What primary thermodynamic potential powers the rotation of ATP synthase during respiration?',
            options: [
                'Proton motive force across the inner membrane',
                'Direct substrate-level phosphorylation in cytoplasm',
                'Osmotic expansion of mitochondrial outer space',
                'Spontaneous breakdown of lipid membranes',
            ],
            correct_answer: 'Proton motive force across the inner membrane',
            explanation: 'The proton gradient generated by the electron transport chain powers the catalytic head of ATP synthase.',
        },
        {
            id: 2,
            question: 'How does an allosteric inhibitor alter enzyme kinetics?',
            options: [
                'By binding an allosteric site and inducing a conformational change',
                'By competing directly for the catalytic substrate pocket',
                'By irreversibly cleaving peptide bonds',
                'By changing cellular pH without enzyme binding',
            ],
            correct_answer: 'By binding an allosteric site and inducing a conformational change',
            explanation: 'Allosteric effectors bind away from the active catalytic cleft to modulate substrate affinity.',
        },
    ];

    const handleSelectOption = (opt: string) => {
        if (userAnswers[currentQIndex] !== undefined) return;

        const currentQ = quizData?.[currentQIndex];
        const isCorrect = currentQ?.correct_answer === opt;

        if (isCorrect) {
            triggerHaptic('success');
        } else {
            triggerHaptic('error');
            if (!getIsReducedMotion()) {
                Animated.sequence([
                    Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
                ]).start();
            }
        }

        setUserAnswers((prev) => ({
            ...prev,
            [currentQIndex]: opt,
        }));
    };

    const handleNext = () => {
        triggerHaptic('selection');
        if (quizData && currentQIndex < quizData.length - 1) {
            setCurrentQIndex(currentQIndex + 1);
        } else {
            setSubmitted(true);
        }
    };

    const scorePct = useMemo(() => {
        if (!quizData || quizData.length === 0) return 0;
        let correct = 0;
        quizData.forEach((q, idx) => {
            if (userAnswers[idx] === q.correct_answer) correct++;
        });
        return Math.round((correct / quizData.length) * 100);
    }, [quizData, userAnswers]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <AnimatedPressable onPress={() => navigation?.goBack?.()} style={styles.backBtn}>
                    <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
                </AnimatedPressable>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerSuperText}>KNOWLEDGE PRACTICE</Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {initialTitle || 'Quiz Assessment'}
                    </Text>
                </View>
            </View>

            {/* Quiz Setup */}
            {!quizData ? (
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 16 }}
                    contentContainerStyle={{ paddingTop: 14, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.setupCard, shadows.card]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                            <Lightbulb size={22} color={tabAccent} strokeWidth={2} style={{ marginRight: 8 }} />
                            <Text style={styles.setupTitle}>Generate Practice Quiz</Text>
                        </View>

                        <Text style={styles.fieldLabel}>Custom Topic (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Enzyme Kinetics & Thermodynamics"
                            placeholderTextColor={colors.textMuted}
                            value={customTopic}
                            onChangeText={setCustomTopic}
                        />

                        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Questions Count</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                            {[3, 5, 10].map((cnt) => (
                                <TouchableOpacity
                                    key={cnt}
                                    style={[
                                        styles.countPill,
                                        numQuestions === cnt && { backgroundColor: tabAccent },
                                    ]}
                                    onPress={() => setNumQuestions(cnt)}
                                >
                                    <Text
                                        style={[
                                            styles.countPillText,
                                            { color: numQuestions === cnt ? '#FFFFFF' : colors.text },
                                        ]}
                                    >
                                        {cnt} Questions
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <GradientButton
                            colors={gradients.tealToBlue[isDark ? 'dark' : 'light']}
                            title={generating ? 'Generating Questions...' : 'Generate Practice Quiz'}
                            onPress={() => handleGenerateQuiz()}
                            loading={generating}
                        />
                    </View>
                </ScrollView>
            ) : submitted ? (
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 16 }}
                    contentContainerStyle={{ paddingTop: 20, paddingBottom: 100, alignItems: 'center' }}
                    showsVerticalScrollIndicator={false}
                >
                    {scorePct >= 80 && <ConfettiBurst />}

                    <View style={[styles.resultsCard, shadows.elevated]}>
                        <Text style={styles.resultsBadge}>Results Summary</Text>
                        <Text style={styles.resultsTopic}>{activeTopic}</Text>

                        <View style={{ marginVertical: 20 }}>
                            <ProgressRing
                                percentage={scorePct}
                                size={110}
                                strokeWidth={9}
                                showLabel={true}
                                gradientColors={gradients.tealToBlue[isDark ? 'dark' : 'light']}
                            />
                        </View>

                        <Text style={styles.resultsSummaryText}>
                            You scored {scorePct}% on this knowledge check.
                        </Text>

                        <AnimatedPressable
                            style={[styles.retryBtn, { backgroundColor: tabAccent }, shadows.glowAccent]}
                            onPress={() => handleGenerateQuiz(activeTopic)}
                        >
                            <RotateCcw size={16} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 6 }} />
                            <Text style={styles.retryBtnText}>Practice Again</Text>
                        </AnimatedPressable>
                    </View>
                </ScrollView>
            ) : (
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 16 }}
                    contentContainerStyle={{ paddingTop: 10, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.qHeader}>
                        <Text style={styles.qIndexText}>
                            Question {currentQIndex + 1} of {quizData.length}
                        </Text>
                    </View>

                    <Animated.View
                        style={[
                            styles.qBox,
                            shadows.card,
                            { transform: [{ translateX: shakeAnim }] },
                        ]}
                    >
                        <Text style={[styles.qText, { fontFamily: typography.fontFamily.reading }]}>
                            {quizData[currentQIndex].question}
                        </Text>
                    </Animated.View>

                    <View style={{ gap: 10, marginVertical: 14 }}>
                        {quizData[currentQIndex].options.map((opt, oIdx) => {
                            const isSelected = userAnswers[currentQIndex] === opt;
                            const hasAnswered = userAnswers[currentQIndex] !== undefined;
                            const isCorrect = opt === quizData[currentQIndex].correct_answer;

                            let optBg = colors.surface;
                            let optBorder = colors.border;
                            let optTextColor = colors.text;

                            if (hasAnswered) {
                                if (isCorrect) {
                                    optBg = colors.successMuted;
                                    optBorder = colors.success;
                                    optTextColor = colors.success;
                                } else if (isSelected) {
                                    optBg = colors.dangerMuted;
                                    optBorder = colors.danger;
                                    optTextColor = colors.danger;
                                }
                            }

                            return (
                                <AnimatedPressable
                                    key={oIdx}
                                    style={[
                                        styles.optCard,
                                        { backgroundColor: optBg, borderColor: optBorder },
                                        shadows.subtle,
                                    ]}
                                    onPress={() => handleSelectOption(opt)}
                                >
                                    <Text style={[styles.optText, { color: optTextColor }]}>{opt}</Text>
                                    {hasAnswered && isCorrect && (
                                        <CheckCircle2 size={18} color={colors.success} strokeWidth={2} />
                                    )}
                                    {hasAnswered && isSelected && !isCorrect && (
                                        <XCircle size={18} color={colors.danger} strokeWidth={2} />
                                    )}
                                </AnimatedPressable>
                            );
                        })}
                    </View>

                    {userAnswers[currentQIndex] !== undefined && (
                        <View style={[styles.expCard, shadows.card]}>
                            <Text style={styles.expTitle}>Explanation</Text>
                            <Text style={[styles.expText, { fontFamily: typography.fontFamily.reading }]}>
                                {quizData[currentQIndex].explanation}
                            </Text>

                            <AnimatedPressable
                                style={[styles.nextBtn, { backgroundColor: tabAccent }, shadows.glowAccent]}
                                onPress={handleNext}
                            >
                                <Text style={styles.nextBtnText}>
                                    {currentQIndex < quizData.length - 1 ? 'Next Question' : 'View Results'}
                                </Text>
                            </AnimatedPressable>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
};

const createStyles = (colors: ThemeColors, shadows: any, tabAccent: string) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingHorizontal: 16,
            paddingBottom: 10,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        backBtn: {
            width: 38,
            height: 38,
            borderRadius: radii.controls,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
        },
        headerTitleContainer: {
            flex: 1,
            marginLeft: 12,
        },
        headerSuperText: {
            fontSize: 10,
            fontWeight: '700',
            color: colors.textMuted,
            letterSpacing: 0.8,
        },
        headerTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
            marginTop: 1,
        },
        setupCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
        },
        setupTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
        },
        fieldLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
        },
        textInput: {
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.controls,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: typography.sizes.sm,
            color: colors.text,
        },
        countPill: {
            flex: 1,
            paddingVertical: 9,
            borderRadius: radii.controls,
            backgroundColor: colors.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
        },
        countPillText: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
        },
        qHeader: {
            marginBottom: 8,
        },
        qIndexText: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
            color: colors.textMuted,
        },
        qBox: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
        },
        qText: {
            fontSize: typography.sizes.md,
            lineHeight: 26,
            color: colors.text,
            fontWeight: '600',
        },
        optCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 14,
            borderRadius: radii.cards,
            borderWidth: 1.5,
        },
        optText: {
            flex: 1,
            fontSize: typography.sizes.sm + 1,
            lineHeight: 20,
            fontWeight: '600',
            paddingRight: 8,
        },
        expCard: {
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginTop: 10,
        },
        expTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        expText: {
            fontSize: typography.sizes.sm,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        nextBtn: {
            paddingVertical: 12,
            borderRadius: radii.controls,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 14,
        },
        nextBtnText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        resultsCard: {
            width: '100%',
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            alignItems: 'center',
        },
        resultsBadge: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: tabAccent,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
        },
        resultsTopic: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
            marginTop: 4,
            textAlign: 'center',
        },
        resultsSummaryText: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 20,
        },
        retryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 22,
            borderRadius: radii.controls,
        },
        retryBtnText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
    });

export default QuizScreen;
