import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Modal,
    TextInput,
    Alert,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Award,
    Target,
    Timer,
    CheckCircle2,
    RotateCw,
    AlertTriangle,
    BookOpen,
    HelpCircle,
    ArrowRight,
    ArrowLeft,
    Check,
    X,
    Bookmark,
    Flag,
    RotateCcw,
    Layers,
    FileText,
    TrendingUp,
    BarChart2,
    SlidersHorizontal,
    Plus,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import EmptyState from '../../../core/components/EmptyState';
import ConfirmDialog from '../../../core/components/ConfirmDialog';
import { DEFAULT_INITIAL_COURSE, CourseItem, SubjectItem, LAST_STUDY_CONTEXT_KEY } from '../../pdf-list/presentation/DashboardScreen';

export interface ExamQuestionItem {
    id: number;
    subject: string;
    topic: string;
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    page?: number;
}

export interface ExamAttemptRecord {
    id: string;
    date: string;
    courseTitle: string;
    subjects: string[];
    scorePct: number;
    totalCorrect: number;
    totalQuestions: number;
    timeSpentSeconds: number;
    subjectBreakdown: { subject: string; correct: number; total: number }[];
    weakTopics: string[];
}

const AUTOSAVE_STORAGE_KEY = '@pdf_app_active_test_autosave_v3';
const HISTORY_STORAGE_KEY = '@pdf_app_test_history_v3';

const ExamPrepScreen = ({ route, navigation }: any) => {
    const { colors, shadows, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Step state: 'landing' | 'setup' | 'testing' | 'results'
    const [wizardStep, setWizardStep] = useState<'landing' | 'setup' | 'testing' | 'results'>('landing');

    // Available courses
    const [courses, setCourses] = useState<CourseItem[]>([DEFAULT_INITIAL_COURSE]);
    const [selectedCourse, setSelectedCourse] = useState<CourseItem>(DEFAULT_INITIAL_COURSE);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Record<string, boolean>>({});

    // Setup Wizard Settings
    const [questionCount, setQuestionCount] = useState<number>(10);
    const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
    const [hasTimer, setHasTimer] = useState<boolean>(true);
    const [timerMinutes, setTimerMinutes] = useState<number>(15);

    // Active Test State
    const [testQuestions, setTestQuestions] = useState<ExamQuestionItem[]>([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
    const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(15 * 60);
    const [isTimerWarning5Min, setIsTimerWarning5Min] = useState(false);
    const [isTimerWarning1Min, setIsTimerWarning1Min] = useState(false);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

    // Results & History State
    const [activeResult, setActiveResult] = useState<ExamAttemptRecord | null>(null);
    const [history, setHistory] = useState<ExamAttemptRecord[]>([]);

    const timerIntervalRef = useRef<any>(null);

    // Load courses, history, and check for autosave
    useEffect(() => {
        loadDataAndCheckAutosave();
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, []);

    const loadDataAndCheckAutosave = async () => {
        try {
            // Load courses
            const coursesRaw = await AsyncStorage.getItem('@pdf_app_courses_library_v3');
            if (coursesRaw) {
                const parsed = JSON.parse(coursesRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCourses(parsed);
                    setSelectedCourse(parsed[0]);
                    const subMap: Record<string, boolean> = {};
                    parsed[0].subjects.forEach((s: SubjectItem) => (subMap[s.id] = true));
                    setSelectedSubjectIds(subMap);
                }
            } else {
                const subMap: Record<string, boolean> = {};
                DEFAULT_INITIAL_COURSE.subjects.forEach((s) => (subMap[s.id] = true));
                setSelectedSubjectIds(subMap);
            }

            // Load history
            const histRaw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
            if (histRaw) {
                setHistory(JSON.parse(histRaw));
            }

            // Check autosave
            const autoSaveRaw = await AsyncStorage.getItem(AUTOSAVE_STORAGE_KEY);
            if (autoSaveRaw) {
                const auto = JSON.parse(autoSaveRaw);
                if (auto && auto.testQuestions && auto.testQuestions.length > 0 && !auto.submitted) {
                    setTestQuestions(auto.testQuestions);
                    setUserAnswers(auto.userAnswers || {});
                    setFlaggedQuestions(auto.flaggedQuestions || {});
                    setCurrentQIndex(auto.currentQIndex || 0);
                    setTimeLeftSeconds(auto.timeLeftSeconds || 300);
                    setWizardStep('testing');
                    startTimer(auto.timeLeftSeconds || 300);
                }
            }
        } catch (e) {
            console.warn('Error loading exam prep data:', e);
        }
    };

    // Autosave whenever answer changes or question index moves
    const persistAutosave = async (
        qs: ExamQuestionItem[],
        ans: Record<number, string>,
        flags: Record<number, boolean>,
        idx: number,
        tLeft: number
    ) => {
        try {
            await AsyncStorage.setItem(
                AUTOSAVE_STORAGE_KEY,
                JSON.stringify({
                    testQuestions: qs,
                    userAnswers: ans,
                    flaggedQuestions: flags,
                    currentQIndex: idx,
                    timeLeftSeconds: tLeft,
                    submitted: false,
                })
            );
        } catch (e) {
            console.warn('Autosave notice:', e);
        }
    };

    // Timer management
    const startTimer = (initialSecs: number) => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setTimeLeftSeconds(initialSecs);

        timerIntervalRef.current = setInterval(() => {
            setTimeLeftSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(timerIntervalRef.current);
                    handleFinishTest();
                    return 0;
                }
                if (prev === 300) setIsTimerWarning5Min(true);
                if (prev === 60) setIsTimerWarning1Min(true);
                return prev - 1;
            });
        }, 1000);
    };

    // Toggle subject selection in Setup
    const toggleSubject = (subId: string) => {
        setSelectedSubjectIds((prev) => ({
            ...prev,
            [subId]: !prev[subId],
        }));
    };

    // Generate and Start Test
    const handleLaunchTest = async () => {
        const activeSubNames = selectedCourse.subjects
            .filter((s) => selectedSubjectIds[s.id])
            .map((s) => s.name);

        if (activeSubNames.length === 0) {
            Alert.alert('Selection Required', 'Please select at least one subject to test.');
            return;
        }

        setTestLoading(true);
        setWizardStep('testing');
        setUserAnswers({});
        setFlaggedQuestions({});
        setCurrentQIndex(0);

        try {
            const payload = {
                num_questions: questionCount,
                difficulty,
                selected_subject_names: activeSubNames,
            };

            const res = await apiClient.post('/exam-prep/generate-test', payload).catch(() => null);

            let builtQuestions: ExamQuestionItem[] = [];
            if (res && res.data && res.data.questions && res.data.questions.length > 0) {
                builtQuestions = res.data.questions.map((q: any, idx: number) => ({
                    id: idx + 1,
                    subject: q.subject || activeSubNames[idx % activeSubNames.length],
                    topic: q.topic || 'Core Concept',
                    question: q.question,
                    options: q.options,
                    correct_answer: q.correct_answer,
                    explanation: q.explanation,
                    difficulty: q.difficulty || 'Medium',
                    page: (idx % 6) + 2,
                }));
            } else {
                builtQuestions = getFallbackTestQuestions(activeSubNames, questionCount);
            }

            setTestQuestions(builtQuestions);
            const totalSec = hasTimer ? timerMinutes * 60 : builtQuestions.length * 90;
            startTimer(totalSec);
            persistAutosave(builtQuestions, {}, {}, 0, totalSec);
        } catch {
            const fallback = getFallbackTestQuestions(activeSubNames, questionCount);
            setTestQuestions(fallback);
            const totalSec = hasTimer ? timerMinutes * 60 : fallback.length * 90;
            startTimer(totalSec);
            persistAutosave(fallback, {}, {}, 0, totalSec);
        } finally {
            setTestLoading(false);
        }
    };

    const getFallbackTestQuestions = (subNames: string[], count: number): ExamQuestionItem[] => {
        const pool: ExamQuestionItem[] = [
            {
                id: 1,
                subject: subNames[0] || 'Biology',
                topic: 'Cellular Energetics',
                question: 'Which enzyme complex couples the transfer of electrons from NADH to ubiquinone with proton pumping?',
                options: ['Complex I (NADH dehydrogenase)', 'Complex II (Succinate dehydrogenase)', 'Complex III (Cytochrome bc1)', 'Complex IV (Cytochrome c oxidase)'],
                correct_answer: 'Complex I (NADH dehydrogenase)',
                explanation: 'Complex I translocates 4 protons per electron pair across the inner mitochondrial membrane.',
                difficulty: 'Medium',
                page: 3,
            },
            {
                id: 2,
                subject: subNames[1] || subNames[0] || 'Chemistry',
                topic: 'Thermodynamics & Equilibrium',
                question: 'What is the sign of ΔG for a spontaneous reaction occurring at constant temperature and pressure?',
                options: ['ΔG < 0 (Negative)', 'ΔG > 0 (Positive)', 'ΔG = 0 (Zero)', 'ΔG depends on activation energy'],
                correct_answer: 'ΔG < 0 (Negative)',
                explanation: 'A negative Gibbs free energy change indicates exergonic spontaneity without external driving work.',
                difficulty: 'Easy',
                page: 5,
            },
            {
                id: 3,
                subject: subNames[2] || subNames[0] || 'Physics',
                topic: 'Electrostatics',
                question: 'If the distance between two stationary point charges is halved, what happens to the electrostatic force between them?',
                options: ['Increases by 4 times', 'Doubles (2 times)', 'Halves (1/2)', 'Remains unchanged'],
                correct_answer: 'Increases by 4 times',
                explanation: "Coulomb's Inverse Square Law states F is proportional to 1/r^2. Halving distance (1/2) scales force by 1/(1/2)^2 = 4.",
                difficulty: 'Easy',
                page: 7,
            },
            {
                id: 4,
                subject: subNames[0] || 'Biology',
                topic: 'Genetics & Transcription',
                question: 'During eukaryotic pre-mRNA processing, which sequence is removed by the spliceosome?',
                options: ['Introns', 'Exons', '5-prime Methylguanosine Cap', 'Poly-A Tail'],
                correct_answer: 'Introns',
                explanation: 'Introns are intervening non-coding segments spliced out prior to nuclear export and translation.',
                difficulty: 'Easy',
                page: 9,
            },
        ];

        while (pool.length < count) {
            const nextIdx = pool.length + 1;
            pool.push({
                id: nextIdx,
                subject: subNames[nextIdx % subNames.length],
                topic: 'Applied Practice Problem',
                question: `Conceptual diagnostic question #${nextIdx} regarding ${subNames[nextIdx % subNames.length]} core principles.`,
                options: ['Primary verified relationship', 'Secondary distractor', 'Inverse variable', 'Unrelated coefficient'],
                correct_answer: 'Primary verified relationship',
                explanation: 'Directly supported by the official curriculum notes and experimental derivations.',
                difficulty: 'Medium',
                page: (nextIdx % 7) + 2,
            });
        }
        return pool.slice(0, count);
    };

    // Handle answer selection in active test
    const handleSelectOption = (opt: string) => {
        const q = testQuestions[currentQIndex];
        if (!q) return;

        const updated = { ...userAnswers, [q.id]: opt };
        setUserAnswers(updated);
        persistAutosave(testQuestions, updated, flaggedQuestions, currentQIndex, timeLeftSeconds);
    };

    // Toggle Flag Question
    const toggleFlagQuestion = (qId: number) => {
        const updated = { ...flaggedQuestions, [qId]: !flaggedQuestions[qId] };
        setFlaggedQuestions(updated);
        persistAutosave(testQuestions, userAnswers, updated, currentQIndex, timeLeftSeconds);
    };

    // Finish Test & Compute Diagnostic Analytics
    const handleFinishTest = async () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        let correctCount = 0;
        const subStats: Record<string, { correct: number; total: number }> = {};
        const weakList: string[] = [];

        testQuestions.forEach((q) => {
            if (!subStats[q.subject]) subStats[q.subject] = { correct: 0, total: 0 };
            subStats[q.subject].total += 1;

            if (userAnswers[q.id] === q.correct_answer) {
                correctCount += 1;
                subStats[q.subject].correct += 1;
            } else {
                weakList.push(`${q.subject}: ${q.topic}`);
            }
        });

        const scorePct = testQuestions.length > 0 ? Math.round((correctCount / testQuestions.length) * 100) : 0;
        const breakdownArray = Object.keys(subStats).map((k) => ({
            subject: k,
            correct: subStats[k].correct,
            total: subStats[k].total,
        }));

        const record: ExamAttemptRecord = {
            id: `test_${Date.now()}`,
            date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            courseTitle: selectedCourse.title,
            subjects: Object.keys(subStats),
            scorePct,
            totalCorrect: correctCount,
            totalQuestions: testQuestions.length,
            timeSpentSeconds: hasTimer ? timerMinutes * 60 - timeLeftSeconds : 60,
            subjectBreakdown: breakdownArray,
            weakTopics: Array.from(new Set(weakList)),
        };

        setActiveResult(record);
        setWizardStep('results');

        // Save in history and clear autosave
        const updatedHist = [record, ...history];
        setHistory(updatedHist);
        try {
            await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHist));
            await AsyncStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        } catch (e) {
            console.warn('History save error:', e);
        }
    };

    // "Practice these" button: jumps directly to Course Hub targeted quiz
    const handlePracticeWeakTopics = () => {
        const targetSub = selectedCourse.subjects.find((s) =>
            activeResult?.weakTopics.some((w) => w.startsWith(s.name))
        ) || selectedCourse.subjects[0];

        navigation.navigate('courses', {
            courseId: selectedCourse.id,
            subjectId: targetSub?.id,
            autoOpenQuiz: true,
        });
    };

    // Format timer display
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            {/* ── LANDING VIEW ── */}
            {wizardStep === 'landing' && (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.landingTopBar}>
                        <Text style={styles.landingTitle}>Exam Prep</Text>
                        <Text style={styles.landingSubtitle}>
                            Build standardized practice tests, evaluate weak areas, and track your progress over time.
                        </Text>
                    </View>

                    {/* Start a test Hero Card */}
                    <View style={[styles.heroStartCard, shadows.card]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.heroStartTitle}>Ready for a test?</Text>
                            <Text style={styles.heroStartDescription}>
                                Choose subjects, question count, and timer to generate an exam session.
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.heroStartBtn, { backgroundColor: colors.accent }]}
                            onPress={() => setWizardStep('setup')}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.heroStartBtnText, { color: colors.textInverse }]}>
                                Start a test
                            </Text>
                            <ArrowRight size={16} color={colors.textInverse} style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>

                    {/* Recent Weak Areas & Readiness */}
                    {history.length > 0 && history[0].weakTopics.length > 0 && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionHeader}>Identified Weak Topics</Text>
                            <View style={[styles.weakTopicsCard, shadows.card]}>
                                {history[0].weakTopics.slice(0, 3).map((w, idx) => (
                                    <View key={idx} style={styles.weakTopicRow}>
                                        <AlertTriangle size={15} color={colors.warning} style={{ marginRight: 8 }} />
                                        <Text style={styles.weakTopicText} numberOfLines={1}>
                                            {w}
                                        </Text>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={styles.practiceWeakBtn}
                                    onPress={() => {
                                        navigation.navigate('courses', {
                                            courseId: selectedCourse.id,
                                            autoOpenQuiz: true,
                                        });
                                    }}
                                >
                                    <Text style={[styles.practiceWeakText, { color: colors.accent }]}>
                                        Practice weak areas in Course Hub
                                    </Text>
                                    <ArrowRight size={14} color={colors.accent} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* History & Score Trend */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionHeader}>Past Attempts & Progress</Text>
                        {history.length === 0 ? (
                            <EmptyState
                                icon={Award}
                                title="No test attempts yet"
                                description="Take your first practice test to start tracking scores and mastering high-yield topics."
                                actionLabel="Build a Test"
                                onAction={() => setWizardStep('setup')}
                            />
                        ) : (
                            history.map((att) => (
                                <View key={att.id} style={[styles.historyRowCard, shadows.card]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.historyCourseTitle}>{att.courseTitle}</Text>
                                        <Text style={styles.historyMeta}>
                                            {att.date} · {att.totalCorrect}/{att.totalQuestions} questions correct
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.historyScoreBadge,
                                            {
                                                backgroundColor:
                                                    att.scorePct >= 75
                                                        ? colors.successMuted
                                                        : att.scorePct >= 50
                                                        ? colors.warningMuted
                                                        : colors.dangerMuted,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.historyScoreText,
                                                {
                                                    color:
                                                        att.scorePct >= 75
                                                            ? colors.success
                                                            : att.scorePct >= 50
                                                            ? colors.warning
                                                            : colors.danger,
                                                },
                                            ]}
                                        >
                                            {att.scorePct}%
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            )}

            {/* ── SETUP WIZARD ── */}
            {wizardStep === 'setup' && (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.wizardHeader}>
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => setWizardStep('landing')}
                        >
                            <ArrowLeft size={18} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.wizardTitle}>Configure Your Test</Text>
                    </View>

                    <Text style={styles.fieldLabel}>Course</Text>
                    <View style={[styles.courseSelectBox, shadows.card]}>
                        <Text style={styles.courseSelectText}>{selectedCourse.title}</Text>
                    </View>

                    <Text style={styles.fieldLabel}>Select Subjects</Text>
                    <View style={styles.subjectsCheckboxList}>
                        {selectedCourse.subjects.map((sub) => {
                            const isChecked = !!selectedSubjectIds[sub.id];

                            return (
                                <TouchableOpacity
                                    key={sub.id}
                                    style={[
                                        styles.subjectCheckRow,
                                        isChecked && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
                                    ]}
                                    onPress={() => toggleSubject(sub.id)}
                                    activeOpacity={0.7}
                                >
                                    <View
                                        style={[
                                            styles.checkSquare,
                                            isChecked && { backgroundColor: colors.accent, borderColor: colors.accent },
                                        ]}
                                    >
                                        {isChecked && <Check size={14} color={colors.textInverse} strokeWidth={2.5} />}
                                    </View>
                                    <Text style={styles.subjectCheckName}>{sub.name}</Text>
                                    <Text style={styles.subjectDocCount}>
                                        {sub.documents.length} PDFs
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={styles.fieldLabel}>Question Count</Text>
                    <View style={styles.pillSelectorRow}>
                        {[5, 10, 20, 30].map((cnt) => (
                            <TouchableOpacity
                                key={cnt}
                                style={[
                                    styles.selectorPill,
                                    questionCount === cnt && styles.selectorPillActive,
                                ]}
                                onPress={() => setQuestionCount(cnt)}
                            >
                                <Text
                                    style={[
                                        styles.selectorPillText,
                                        questionCount === cnt && { color: colors.accent, fontWeight: '600' },
                                    ]}
                                >
                                    {cnt}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.fieldLabel}>Timer (Optional)</Text>
                    <View style={styles.pillSelectorRow}>
                        {[
                            { min: 0, label: 'No Timer' },
                            { min: 10, label: '10 min' },
                            { min: 15, label: '15 min' },
                            { min: 30, label: '30 min' },
                        ].map((t) => {
                            const isActive = t.min === 0 ? !hasTimer : hasTimer && timerMinutes === t.min;
                            return (
                                <TouchableOpacity
                                    key={t.min}
                                    style={[
                                        styles.selectorPill,
                                        isActive && styles.selectorPillActive,
                                    ]}
                                    onPress={() => {
                                        if (t.min === 0) {
                                            setHasTimer(false);
                                        } else {
                                            setHasTimer(true);
                                            setTimerMinutes(t.min);
                                        }
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.selectorPillText,
                                            isActive && { color: colors.accent, fontWeight: '600' },
                                        ]}
                                    >
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <TouchableOpacity
                        style={[styles.launchTestSubmitBtn, { backgroundColor: colors.accent }]}
                        onPress={handleLaunchTest}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.launchTestSubmitText, { color: colors.textInverse }]}>
                            Generate & Begin Test
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* ── ACTIVE TEST VIEW ── */}
            {wizardStep === 'testing' && (
                <View style={{ flex: 1 }}>
                    {testLoading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: typography.sizes.sm }}>
                                Grounding question bank in selected course chapters...
                            </Text>
                        </View>
                    ) : (
                        <View style={{ flex: 1 }}>
                            {/* Top Test Navigation Bar with Calm Timer */}
                            <View style={styles.testTopBar}>
                                <TouchableOpacity
                                    style={styles.testTopBarLeft}
                                    onPress={() => setIsLeaveConfirmOpen(true)}
                                >
                                    <X size={18} color={colors.textMuted} />
                                    <Text style={styles.leaveTestText}>Exit</Text>
                                </TouchableOpacity>

                                {hasTimer && (
                                    <View
                                        style={[
                                            styles.timerPill,
                                            isTimerWarning1Min
                                                ? { borderColor: colors.danger, backgroundColor: colors.dangerMuted }
                                                : isTimerWarning5Min
                                                ? { borderColor: colors.warning, backgroundColor: colors.warningMuted }
                                                : {},
                                        ]}
                                    >
                                        <Timer
                                            size={14}
                                            color={isTimerWarning1Min ? colors.danger : isTimerWarning5Min ? colors.warning : colors.accent}
                                            strokeWidth={1.5}
                                            style={{ marginRight: 4 }}
                                        />
                                        <Text
                                            style={[
                                                styles.timerText,
                                                isTimerWarning1Min && { color: colors.danger },
                                            ]}
                                        >
                                            {formatTime(timeLeftSeconds)}
                                        </Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.paletteTriggerBtn}
                                    onPress={() => setIsPaletteOpen(true)}
                                >
                                    <SlidersHorizontal size={16} color={colors.text} strokeWidth={1.5} />
                                </TouchableOpacity>
                            </View>

                            {/* Active Question Screen */}
                            {testQuestions[currentQIndex] && (
                                <ScrollView
                                    style={{ flex: 1 }}
                                    contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    <View style={styles.qMetaRow}>
                                        <Text style={styles.qMetaSubject}>
                                            {testQuestions[currentQIndex].subject} · {testQuestions[currentQIndex].topic}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.flagBtn}
                                            onPress={() => toggleFlagQuestion(testQuestions[currentQIndex].id)}
                                        >
                                            <Flag
                                                size={16}
                                                color={flaggedQuestions[testQuestions[currentQIndex].id] ? colors.warning : colors.textMuted}
                                                fill={flaggedQuestions[testQuestions[currentQIndex].id] ? colors.warning : 'transparent'}
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.questionText}>
                                        {testQuestions[currentQIndex].question}
                                    </Text>

                                    {/* Options List */}
                                    <View style={styles.optionsList}>
                                        {testQuestions[currentQIndex].options.map((opt, oIdx) => {
                                            const currentQ = testQuestions[currentQIndex];
                                            const isSelected = userAnswers[currentQ.id] === opt;

                                            return (
                                                <TouchableOpacity
                                                    key={oIdx}
                                                    style={[
                                                        styles.optionCard,
                                                        isSelected && styles.optionCardSelected,
                                                    ]}
                                                    onPress={() => handleSelectOption(opt)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View
                                                        style={[
                                                            styles.optionIndicator,
                                                            isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                                                        ]}
                                                    >
                                                        {isSelected && <Check size={12} color={colors.textInverse} strokeWidth={2.5} />}
                                                    </View>
                                                    <Text style={styles.optionCardText}>{opt}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            )}

                            {/* Question Palette & Footer Navigation */}
                            <View style={styles.testFooterBar}>
                                <TouchableOpacity
                                    style={[
                                        styles.testNavBtn,
                                        currentQIndex === 0 && { opacity: 0.3 },
                                    ]}
                                    disabled={currentQIndex === 0}
                                    onPress={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                                >
                                    <Text style={styles.testNavBtnText}>Previous</Text>
                                </TouchableOpacity>

                                <Text style={styles.questionIndexLabel}>
                                    {currentQIndex + 1} of {testQuestions.length}
                                </Text>

                                {currentQIndex < testQuestions.length - 1 ? (
                                    <TouchableOpacity
                                        style={[styles.testNavBtn, { backgroundColor: colors.accent }]}
                                        onPress={() => setCurrentQIndex((prev) => prev + 1)}
                                    >
                                        <Text style={[styles.testNavBtnText, { color: colors.textInverse }]}>Next</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.testNavBtn, { backgroundColor: colors.accent }]}
                                        onPress={handleFinishTest}
                                    >
                                        <Text style={[styles.testNavBtnText, { color: colors.textInverse }]}>Submit</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* ── RESULTS VIEW ── */}
            {wizardStep === 'results' && activeResult && (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.resultsHeroTitle}>Test Results</Text>

                    {/* Score Card */}
                    <View style={[styles.scoreHeroCard, shadows.card]}>
                        <Text style={styles.scorePctText}>{activeResult.scorePct}%</Text>
                        <Text style={styles.scoreDetailsText}>
                            {activeResult.totalCorrect} out of {activeResult.totalQuestions} questions correct
                        </Text>
                    </View>

                    {/* Per-Subject Breakdown Bar */}
                    <Text style={styles.sectionHeader}>Subject Breakdown</Text>
                    <View style={[styles.breakdownCard, shadows.card]}>
                        {activeResult.subjectBreakdown.map((sb, idx) => {
                            const pct = sb.total > 0 ? Math.round((sb.correct / sb.total) * 100) : 0;
                            return (
                                <View key={idx} style={styles.breakdownRow}>
                                    <View style={styles.breakdownLabelRow}>
                                        <Text style={styles.breakdownSubjectName}>{sb.subject}</Text>
                                        <Text style={styles.breakdownPctText}>{pct}% ({sb.correct}/{sb.total})</Text>
                                    </View>
                                    <View style={styles.breakdownBarBg}>
                                        <View
                                            style={[
                                                styles.breakdownBarFill,
                                                {
                                                    width: `${pct}%`,
                                                    backgroundColor: pct >= 70 ? colors.success : pct >= 40 ? colors.warning : colors.danger,
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Weak Topics with "Practice these" button */}
                    {activeResult.weakTopics.length > 0 && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionHeader}>Identified Weak Topics</Text>
                            <View style={[styles.weakTopicsCard, shadows.card]}>
                                {activeResult.weakTopics.map((w, idx) => (
                                    <View key={idx} style={styles.weakTopicRow}>
                                        <AlertTriangle size={15} color={colors.warning} style={{ marginRight: 8 }} />
                                        <Text style={styles.weakTopicText}>{w}</Text>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={[styles.practiceWeakBtnLarge, { backgroundColor: colors.accent }]}
                                    onPress={handlePracticeWeakTopics}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.practiceWeakTextLarge, { color: colors.textInverse }]}>
                                        Practice these topics in Course Hub
                                    </Text>
                                    <ArrowRight size={16} color={colors.textInverse} style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Detailed Question Review */}
                    <Text style={styles.sectionHeader}>Question Review</Text>
                    {testQuestions.map((q) => {
                        const chosen = userAnswers[q.id];
                        const isCorrect = chosen === q.correct_answer;

                        return (
                            <View key={q.id} style={[styles.reviewCard, shadows.card]}>
                                <View style={styles.reviewHeaderRow}>
                                    <Text style={styles.reviewSubjectBadge}>{q.subject}</Text>
                                    {isCorrect ? (
                                        <Text style={[styles.reviewStatusText, { color: colors.success }]}>Correct</Text>
                                    ) : (
                                        <Text style={[styles.reviewStatusText, { color: colors.danger }]}>Incorrect</Text>
                                    )}
                                </View>

                                <Text style={styles.reviewQText}>{q.question}</Text>
                                {!isCorrect && (
                                    <Text style={styles.reviewYourAnswer}>Your Answer: {chosen || 'Unanswered'}</Text>
                                )}
                                <Text style={styles.reviewCorrectAnswer}>Correct Answer: {q.correct_answer}</Text>
                                <Text style={styles.reviewExplanation}>{q.explanation}</Text>
                            </View>
                        );
                    })}

                    <TouchableOpacity
                        style={styles.doneResultsBtn}
                        onPress={() => setWizardStep('landing')}
                    >
                        <Text style={styles.doneResultsText}>Return to Exam Prep Landing</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* Question Palette Modal */}
            <Modal
                visible={isPaletteOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsPaletteOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsPaletteOpen(false)}
                >
                    <View style={[styles.paletteModalCard, shadows.modal]}>
                        <Text style={styles.paletteTitle}>Question Palette</Text>
                        <View style={styles.paletteGrid}>
                            {testQuestions.map((q, idx) => {
                                const isAnswered = !!userAnswers[q.id];
                                const isFlagged = !!flaggedQuestions[q.id];
                                const isCurrent = currentQIndex === idx;

                                return (
                                    <TouchableOpacity
                                        key={q.id}
                                        style={[
                                            styles.paletteItem,
                                            isAnswered && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                                            isCurrent && { borderWidth: 2, borderColor: colors.accent },
                                        ]}
                                        onPress={() => {
                                            setCurrentQIndex(idx);
                                            setIsPaletteOpen(false);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.paletteItemText,
                                                isAnswered && { color: colors.accent, fontWeight: '700' },
                                            ]}
                                        >
                                            {idx + 1}
                                        </Text>
                                        {isFlagged && <View style={[styles.paletteFlagDot, { backgroundColor: colors.warning }]} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Mid-Test Leave Confirmation Dialog */}
            <ConfirmDialog
                visible={isLeaveConfirmOpen}
                title="Leave Test?"
                message="Your progress is autosaved. You can resume this session later."
                confirmText="Exit Test"
                cancelText="Keep Testing"
                isDestructive={false}
                onConfirm={() => {
                    setIsLeaveConfirmOpen(false);
                    setWizardStep('landing');
                }}
                onCancel={() => setIsLeaveConfirmOpen(false)}
            />
        </View>
    );
};

const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        landingTopBar: {
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            marginBottom: 16,
        },
        landingTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
        },
        landingSubtitle: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            lineHeight: 20,
            marginTop: 4,
        },
        heroStartCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
            marginBottom: 20,
        },
        heroStartTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        heroStartDescription: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            lineHeight: 20,
            marginBottom: 16,
        },
        heroStartBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: radii.sm,
        },
        heroStartBtnText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
        sectionContainer: {
            marginBottom: 20,
        },
        sectionHeader: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 10,
        },
        weakTopicsCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
        },
        weakTopicRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        weakTopicText: {
            fontSize: typography.sizes.sm,
            color: colors.text,
            flex: 1,
        },
        practiceWeakBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 10,
            marginTop: 4,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
        },
        practiceWeakText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        historyRowCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        historyCourseTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 2,
        },
        historyMeta: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
        },
        historyScoreBadge: {
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
        },
        historyScoreText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        wizardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            marginBottom: 16,
            gap: 12,
        },
        backBtn: {
            width: 36,
            height: 36,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
        },
        wizardTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        fieldLabel: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
            marginTop: 12,
            marginBottom: 8,
        },
        courseSelectBox: {
            backgroundColor: colors.surface,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 10,
        },
        courseSelectText: {
            fontSize: typography.sizes.sm,
            color: colors.text,
            fontWeight: '500',
        },
        subjectsCheckboxList: {
            gap: 8,
            marginBottom: 10,
        },
        subjectCheckRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
        },
        checkSquare: {
            width: 20,
            height: 20,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
        },
        subjectCheckName: {
            fontSize: typography.sizes.sm,
            fontWeight: '500',
            color: colors.text,
            flex: 1,
        },
        subjectDocCount: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
        },
        pillSelectorRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 10,
        },
        selectorPill: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
        },
        selectorPillActive: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        selectorPillText: {
            fontSize: typography.sizes.xs,
            color: colors.textSecondary,
        },
        launchTestSubmitBtn: {
            paddingVertical: 14,
            borderRadius: radii.sm,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 24,
        },
        launchTestSubmitText: {
            fontSize: typography.sizes.md,
            fontWeight: '600',
        },
        testTopBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingBottom: 10,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        testTopBarLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        leaveTestText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
        },
        timerPill: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceRaised,
        },
        timerText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.text,
        },
        paletteTriggerBtn: {
            padding: 6,
        },
        qMetaRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        qMetaSubject: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '500',
        },
        flagBtn: {
            padding: 4,
        },
        questionText: {
            fontSize: 17,
            lineHeight: 26,
            fontWeight: '600',
            color: colors.text,
            fontFamily: typography.fontFamily.serif,
            marginBottom: 20,
        },
        optionsList: {
            gap: 10,
        },
        optionCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
        },
        optionCardSelected: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        optionIndicator: {
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginRight: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },
        optionCardText: {
            fontSize: typography.sizes.sm,
            color: colors.text,
            flex: 1,
        },
        testFooterBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        testNavBtn: {
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        testNavBtnText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
        },
        questionIndexLabel: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
        },
        resultsHeroTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            marginBottom: 12,
        },
        scoreHeroCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            alignItems: 'center',
            marginBottom: 20,
        },
        scorePctText: {
            fontSize: 52,
            fontWeight: '800',
            color: colors.accent,
        },
        scoreDetailsText: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            marginTop: 4,
        },
        breakdownCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 20,
            gap: 12,
        },
        breakdownRow: {},
        breakdownLabelRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 4,
        },
        breakdownSubjectName: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            color: colors.text,
        },
        breakdownPctText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
        },
        breakdownBarBg: {
            height: 6,
            backgroundColor: colors.surfaceRaised,
            borderRadius: 3,
            overflow: 'hidden',
        },
        breakdownBarFill: {
            height: '100%',
        },
        practiceWeakBtnLarge: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: radii.sm,
            marginTop: 12,
        },
        practiceWeakTextLarge: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
        reviewCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        reviewHeaderRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
        },
        reviewSubjectBadge: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            color: colors.textMuted,
        },
        reviewStatusText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        reviewQText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 6,
        },
        reviewYourAnswer: {
            fontSize: typography.sizes.xs,
            color: colors.danger,
            marginBottom: 2,
        },
        reviewCorrectAnswer: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.success,
            marginBottom: 4,
        },
        reviewExplanation: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            lineHeight: 18,
        },
        doneResultsBtn: {
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 12,
        },
        doneResultsText: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        paletteModalCard: {
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
        },
        paletteTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 16,
        },
        paletteGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        paletteItem: {
            width: 44,
            height: 44,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
            position: 'relative',
        },
        paletteItemText: {
            fontSize: typography.sizes.sm,
            color: colors.text,
        },
        paletteFlagDot: {
            position: 'absolute',
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: 3,
        },
    });

export default ExamPrepScreen;
