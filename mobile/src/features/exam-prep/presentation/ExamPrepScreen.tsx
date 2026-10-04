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
    Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
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
    UploadCloud,
    ChevronDown,
    Flame,
    Sparkles,
    XCircle,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, gradients } from '../../../core/theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../../../core/theme/motion';
import EmptyState from '../../../core/components/EmptyState';
import ConfirmDialog from '../../../core/components/ConfirmDialog';
import ProgressRing from '../../../core/components/ProgressRing';
import ConfettiBurst from '../../../core/components/ConfettiBurst';
import Toast from '../../../core/components/Toast';
import { AnimatedPressable } from '../../../core/components/AnimatedPressable';
import { GradientView, GradientButton } from '../../../core/components/GradientView';
import { DEFAULT_INITIAL_COURSE, CourseItem, SubjectItem, PDFDoc, LAST_STUDY_CONTEXT_KEY } from '../../pdf-list/presentation/DashboardScreen';

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
    const routeParams = route?.params || {};
    const { colors, shadows, isDark, typography } = useTheme();
    const tabAccent = colors.tabExamPrep; // Coral #F2644A
    const styles = useMemo(() => createStyles(colors, shadows, tabAccent), [colors, shadows, tabAccent]);

    // Step state: 'landing' | 'setup' | 'testing' | 'results'
    const [wizardStep, setWizardStep] = useState<'landing' | 'setup' | 'testing' | 'results'>('landing');

    // Available courses
    const [courses, setCourses] = useState<CourseItem[]>([DEFAULT_INITIAL_COURSE]);
    const [selectedCourse, setSelectedCourse] = useState<CourseItem>(DEFAULT_INITIAL_COURSE);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Record<string, boolean>>({});
    const [isCoursePickerOpen, setIsCoursePickerOpen] = useState(false);

    // Setup Wizard Settings
    const [questionCount, setQuestionCount] = useState<number>(10);
    const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
    const [hasTimer, setHasTimer] = useState<boolean>(true);
    const [timerMinutes, setTimerMinutes] = useState<number>(15);
    const [extraAttachedFiles, setExtraAttachedFiles] = useState<{ name: string; size: number }[]>([]);

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
    const [reviewFilter, setReviewFilter] = useState<'all' | 'missed' | 'flagged'>('all');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const timerIntervalRef = useRef<any>(null);

    // Load courses, history, and check for autosave
    useEffect(() => {
        loadDataAndCheckAutosave();
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [routeParams]);

    const loadDataAndCheckAutosave = async () => {
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

            let activeCourse = loadedCourses[0];
            if (routeParams.courseId) {
                const found = loadedCourses.find((c) => c.id === routeParams.courseId);
                if (found) activeCourse = found;
            }
            setSelectedCourse(activeCourse);

            const subMap: Record<string, boolean> = {};
            (activeCourse.subjects || []).forEach((s: SubjectItem) => {
                subMap[s.id] = true;
            });
            setSelectedSubjectIds(subMap);

            const histRaw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
            if (histRaw) {
                const parsedHist = JSON.parse(histRaw);
                if (Array.isArray(parsedHist)) {
                    setHistory(parsedHist);
                }
            } else {
                // Default starter attempt record for trend display
                const sampleHistory: ExamAttemptRecord[] = [
                    {
                        id: 'hist_1',
                        date: 'Yesterday',
                        courseTitle: activeCourse.title,
                        subjects: ['Biology', 'Chemistry'],
                        scorePct: 82,
                        totalCorrect: 8,
                        totalQuestions: 10,
                        timeSpentSeconds: 420,
                        subjectBreakdown: [
                            { subject: 'Cell Biology', correct: 5, total: 6 },
                            { subject: 'Chemistry', correct: 3, total: 4 },
                        ],
                        weakTopics: ['Mitochondrial DNA', 'Enthalpy Calculations'],
                    },
                ];
                setHistory(sampleHistory);
            }

            const autoSaveRaw = await AsyncStorage.getItem(AUTOSAVE_STORAGE_KEY);
            if (autoSaveRaw) {
                const auto = JSON.parse(autoSaveRaw);
                if (auto && Array.isArray(auto.testQuestions) && auto.testQuestions.length > 0 && !auto.submitted) {
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

    // Autosave state
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

    const toggleSubject = (subId: string) => {
        triggerHaptic('selection');
        setSelectedSubjectIds((prev) => ({
            ...prev,
            [subId]: !prev[subId],
        }));
    };

    const handlePickExtraPDFs = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'text/plain'],
                multiple: true,
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newFiles = result.assets.map((a) => ({
                    name: a.name,
                    size: a.size || 1024000,
                }));
                setExtraAttachedFiles((prev) => [...prev, ...newFiles]);
            }
        } catch (e) {
            console.warn('PDF pick error:', e);
        }
    };

    // Start New Test
    const handleStartNewTest = async () => {
        const pickedSubs = (selectedCourse.subjects || []).filter((s) => selectedSubjectIds[s.id]);
        if (pickedSubs.length === 0) {
            Alert.alert('Selection Required', 'Please select at least one subject for this exam test.');
            return;
        }

        triggerHaptic('selection');
        setTestLoading(true);
        setWizardStep('testing');
        setUserAnswers({});
        setFlaggedQuestions({});
        setCurrentQIndex(0);

        try {
            const topic = `${selectedCourse.title} - ${pickedSubs.map((s) => s.name).join(', ')}`;
            const res = await apiClient.post('/quiz/generate', {
                topic,
                num_questions: questionCount,
            }).catch(() => null);

            let builtQuestions: ExamQuestionItem[] = [];
            if (res && res.data && res.data.questions && res.data.questions.length > 0) {
                builtQuestions = res.data.questions.map((q: any, i: number) => ({
                    id: i + 1,
                    subject: pickedSubs[i % pickedSubs.length]?.name || 'Pre-Med Science',
                    topic: `Topic ${i + 1}`,
                    question: q.question,
                    options: q.options || [],
                    correct_answer: q.correct_answer,
                    explanation: q.explanation || 'Verified from curriculum notes.',
                    difficulty,
                    page: (i % 6) + 2,
                }));
            } else {
                builtQuestions = getFallbackExamQuestions(pickedSubs);
            }

            setTestQuestions(builtQuestions);
            const totalSecs = hasTimer ? timerMinutes * 60 : 30 * 60;
            startTimer(totalSecs);
            persistAutosave(builtQuestions, {}, {}, 0, totalSecs);
        } catch {
            const fallback = getFallbackExamQuestions(pickedSubs);
            setTestQuestions(fallback);
            const totalSecs = hasTimer ? timerMinutes * 60 : 30 * 60;
            startTimer(totalSecs);
            persistAutosave(fallback, {}, {}, 0, totalSecs);
        } finally {
            setTestLoading(false);
        }
    };

    const getFallbackExamQuestions = (pickedSubs: SubjectItem[]): ExamQuestionItem[] => {
        const list: ExamQuestionItem[] = [];
        const baseSub = pickedSubs[0]?.name || 'Medical Sciences';

        for (let i = 0; i < questionCount; i++) {
            const sName = pickedSubs[i % pickedSubs.length]?.name || baseSub;
            list.push({
                id: i + 1,
                subject: sName,
                topic: `${sName} High-Yield`,
                question: `Exam Question #${i + 1}: In the context of ${sName}, which principle determines maximum energetic yield during biological transport?`,
                options: [
                    'Proton gradient coupling across semipermeable membranes',
                    'Passive diffusion with no thermodynamic barrier',
                    'Direct spontaneous oxidation of ribose rings',
                    'Allosteric inhibition of cytochrome c oxidase',
                ],
                correct_answer: 'Proton gradient coupling across semipermeable membranes',
                explanation: 'Chemiosmotic coupling across mitochondrial membranes converts the proton electrochemical potential into ATP synthesis.',
                difficulty,
                page: (i % 8) + 1,
            });
        }
        return list;
    };

    const handleSelectOption = (option: string) => {
        triggerHaptic('selection');
        const nextAnswers = {
            ...userAnswers,
            [currentQIndex]: option,
        };
        setUserAnswers(nextAnswers);
        persistAutosave(testQuestions, nextAnswers, flaggedQuestions, currentQIndex, timeLeftSeconds);
    };

    const handleToggleFlag = () => {
        triggerHaptic('selection');
        const nextFlags = {
            ...flaggedQuestions,
            [currentQIndex]: !flaggedQuestions[currentQIndex],
        };
        setFlaggedQuestions(nextFlags);
        persistAutosave(testQuestions, userAnswers, nextFlags, currentQIndex, timeLeftSeconds);
    };

    // Finish / Submit Test
    const handleFinishTest = async () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        triggerHaptic('success');

        let correct = 0;
        const subCounts: Record<string, { correct: number; total: number }> = {};
        const weakList: string[] = [];

        testQuestions.forEach((q, idx) => {
            const s = q.subject || 'General';
            if (!subCounts[s]) subCounts[s] = { correct: 0, total: 0 };
            subCounts[s].total++;

            if (userAnswers[idx] === q.correct_answer) {
                correct++;
                subCounts[s].correct++;
            } else {
                if (!weakList.includes(q.topic)) weakList.push(q.topic);
            }
        });

        const scorePct = Math.round((correct / (testQuestions.length || 1)) * 100);
        const newRecord: ExamAttemptRecord = {
            id: `test_${Date.now()}`,
            date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
            courseTitle: selectedCourse.title,
            subjects: Object.keys(subCounts),
            scorePct,
            totalCorrect: correct,
            totalQuestions: testQuestions.length,
            timeSpentSeconds: hasTimer ? timerMinutes * 60 - timeLeftSeconds : 0,
            subjectBreakdown: Object.entries(subCounts).map(([subject, counts]) => ({
                subject,
                correct: counts.correct,
                total: counts.total,
            })),
            weakTopics: weakList.slice(0, 4),
        };

        const updatedHist = [newRecord, ...history];
        setHistory(updatedHist);
        setActiveResult(newRecord);
        setWizardStep('results');

        try {
            await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHist));
            await AsyncStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        } catch (e) {
            console.warn('History save notice:', e);
        }
    };

    // Format timer
    const formattedTime = useMemo(() => {
        const m = Math.floor(timeLeftSeconds / 60);
        const s = timeLeftSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, [timeLeftSeconds]);

    // Review questions list
    const filteredReviewQuestions = useMemo(() => {
        return testQuestions.filter((q, idx) => {
            const isMissed = userAnswers[idx] !== q.correct_answer;
            const isFlagged = !!flaggedQuestions[idx];
            if (reviewFilter === 'missed') return isMissed;
            if (reviewFilter === 'flagged') return isFlagged;
            return true;
        });
    }, [testQuestions, userAnswers, flaggedQuestions, reviewFilter]);

    return (
        <View style={styles.container}>
            {/* ── STEP 1: DASHBOARD / LANDING ── */}
            {wizardStep === 'landing' && (
                <ScrollView
                    style={styles.landingScroll}
                    contentContainerStyle={styles.landingContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero Card: Start a Test (Coral to Yellow Gradient) */}
                    <GradientView
                        colors={gradients.coralToYellow[isDark ? 'dark' : 'light']}
                        borderRadius={radii.cards}
                        style={[styles.heroCard, shadows.elevated]}
                    >
                        <View style={styles.heroBadge}>
                            <Award size={14} color="#FFFFFF" strokeWidth={2.5} />
                            <Text style={styles.heroBadgeText}>Simulated Mock Examination</Text>
                        </View>
                        <Text style={styles.heroTitle}>Master Your Next Exam</Text>
                        <Text style={styles.heroSub}>
                            Timed multi-subject tests synthesized from your course documents.
                        </Text>

                        <AnimatedPressable
                            style={[styles.heroCtaBtn, { backgroundColor: '#FFFFFF' }]}
                            onPress={() => setWizardStep('setup')}
                        >
                            <Text style={[styles.heroCtaText, { color: tabAccent }]}>
                                Set Up New Test
                            </Text>
                            <ArrowRight size={16} color={tabAccent} strokeWidth={2.5} style={{ marginLeft: 6 }} />
                        </AnimatedPressable>
                    </GradientView>

                    {/* Recent Performance Trend */}
                    <Text style={styles.sectionHeader}>Recent Performance</Text>
                    {history.length === 0 ? (
                        <View style={[styles.emptyTrendBox, { backgroundColor: colors.surfaceRaised }]}>
                            <Text style={[styles.emptyTrendText, { color: colors.textMuted }]}>
                                No tests taken yet. Start a test to track your performance trend!
                            </Text>
                        </View>
                    ) : (
                        <View style={[styles.trendCard, shadows.card]}>
                            <View style={styles.trendCardHeader}>
                                <View>
                                    <Text style={styles.trendScoreMain}>
                                        {history[0].scorePct}%
                                    </Text>
                                    <Text style={styles.trendScoreSub}>Latest Test Score</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.trendMetaText}>
                                        {history[0].totalCorrect}/{history[0].totalQuestions} Correct
                                    </Text>
                                    <Text style={styles.trendMetaDate}>{history[0].date}</Text>
                                </View>
                            </View>

                            {/* Score history bars */}
                            <View style={styles.historyBarsRow}>
                                {history.slice(0, 5).reverse().map((h, hIdx) => (
                                    <View key={h.id || hIdx} style={styles.barColumn}>
                                        <View style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
                                            <View
                                                style={[
                                                    styles.barFill,
                                                    {
                                                        height: `${h.scorePct}%`,
                                                        backgroundColor: h.scorePct >= 80 ? colors.success : tabAccent,
                                                    },
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.barLabel}>{h.scorePct}%</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Weak Topics Chips */}
                    {history.length > 0 && history[0].weakTopics.length > 0 && (
                        <View style={{ marginTop: 18 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={styles.sectionHeader}>Areas for Improvement</Text>
                                <AnimatedPressable
                                    style={[styles.practiceBtn, { backgroundColor: colors.secondaryMuted }]}
                                    onPress={() => setWizardStep('setup')}
                                >
                                    <Text style={[styles.practiceBtnText, { color: tabAccent }]}>Practice These</Text>
                                </AnimatedPressable>
                            </View>

                            <View style={styles.weakTopicsRow}>
                                {history[0].weakTopics.map((top, idx) => (
                                    <View key={idx} style={[styles.weakChip, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                                        <Target size={12} color={tabAccent} strokeWidth={2} style={{ marginRight: 4 }} />
                                        <Text style={[styles.weakChipText, { color: colors.textSecondary }]}>
                                            {top}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* ── STEP 2: SETUP WIZARD ── */}
            {wizardStep === 'setup' && (
                <ScrollView
                    style={styles.landingScroll}
                    contentContainerStyle={styles.setupContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.setupHeaderRow}>
                        <AnimatedPressable
                            style={styles.backBtn}
                            onPress={() => setWizardStep('landing')}
                        >
                            <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
                        </AnimatedPressable>
                        <Text style={styles.setupHeaderTitle}>Test Configuration</Text>
                    </View>

                    {/* 1. Course Selection */}
                    <Text style={styles.setupSectionLabel}>1. Course Curriculum</Text>
                    <AnimatedPressable
                        style={[styles.courseSelectBox, shadows.subtle]}
                        onPress={() => setIsCoursePickerOpen(true)}
                    >
                        <BookOpen size={18} color={tabAccent} strokeWidth={2} style={{ marginRight: 10 }} />
                        <Text style={styles.courseSelectText} numberOfLines={1}>
                            {selectedCourse.title}
                        </Text>
                        <ChevronDown size={16} color={colors.textMuted} strokeWidth={2} />
                    </AnimatedPressable>

                    {/* 2. Subjects Multi-select */}
                    <Text style={[styles.setupSectionLabel, { marginTop: 16 }]}>2. Select Subjects</Text>
                    <View style={{ gap: 8 }}>
                        {(selectedCourse.subjects || []).map((sub) => {
                            const isPicked = !!selectedSubjectIds[sub.id];
                            return (
                                <AnimatedPressable
                                    key={sub.id}
                                    style={[
                                        styles.subjectSelectCard,
                                        isPicked && { borderColor: tabAccent, backgroundColor: colors.secondaryMuted },
                                        shadows.subtle,
                                    ]}
                                    onPress={() => toggleSubject(sub.id)}
                                >
                                    <View
                                        style={[
                                            styles.checkboxCircle,
                                            isPicked && { backgroundColor: tabAccent, borderColor: tabAccent },
                                        ]}
                                    >
                                        {isPicked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.subjectSelectName, isPicked && { color: tabAccent }]}>
                                            {sub.name}
                                        </Text>
                                        <Text style={styles.subjectSelectDocsCount}>
                                            {(sub.documents || []).length} PDF documents attached
                                        </Text>
                                    </View>
                                </AnimatedPressable>
                            );
                        })}
                    </View>

                    {/* 3. Question Count & Difficulty */}
                    <Text style={[styles.setupSectionLabel, { marginTop: 16 }]}>3. Test Size & Difficulty</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        {[5, 10, 15, 20].map((cnt) => (
                            <TouchableOpacity
                                key={cnt}
                                style={[
                                    styles.configPill,
                                    questionCount === cnt && { backgroundColor: tabAccent, borderColor: tabAccent },
                                ]}
                                onPress={() => setQuestionCount(cnt)}
                            >
                                <Text
                                    style={[
                                        styles.configPillText,
                                        { color: questionCount === cnt ? '#FFFFFF' : colors.text },
                                    ]}
                                >
                                    {cnt} Qs
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                        {(['Easy', 'Medium', 'Hard'] as const).map((diff) => (
                            <TouchableOpacity
                                key={diff}
                                style={[
                                    styles.configPill,
                                    difficulty === diff && { backgroundColor: tabAccent, borderColor: tabAccent },
                                ]}
                                onPress={() => setDifficulty(diff)}
                            >
                                <Text
                                    style={[
                                        styles.configPillText,
                                        { color: difficulty === diff ? '#FFFFFF' : colors.text },
                                    ]}
                                >
                                    {diff}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* 4. Timer Settings */}
                    <Text style={[styles.setupSectionLabel, { marginTop: 16 }]}>4. Examination Timer</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        {[10, 15, 30, 45].map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={[
                                    styles.configPill,
                                    timerMinutes === mins && { backgroundColor: tabAccent, borderColor: tabAccent },
                                ]}
                                onPress={() => setTimerMinutes(mins)}
                            >
                                <Text
                                    style={[
                                        styles.configPillText,
                                        { color: timerMinutes === mins ? '#FFFFFF' : colors.text },
                                    ]}
                                >
                                    {mins} min
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <GradientButton
                        colors={gradients.coralToYellow[isDark ? 'dark' : 'light']}
                        title="Start Examination Now"
                        onPress={handleStartNewTest}
                        style={{ marginTop: 26, marginBottom: 40 }}
                    />
                </ScrollView>
            )}

            {/* ── STEP 3: ACTIVE TEST SCREEN ── */}
            {wizardStep === 'testing' && (
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                    {testLoading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={tabAccent} />
                            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                                Synthesizing timed mock questions...
                            </Text>
                        </View>
                    ) : testQuestions[currentQIndex] ? (
                        <View style={{ flex: 1 }}>
                            {/* Top Sticky Test Bar */}
                            <View style={styles.testTopBar}>
                                <AnimatedPressable
                                    style={styles.leaveTestBtn}
                                    onPress={() => setIsLeaveConfirmOpen(true)}
                                >
                                    <X size={18} color={colors.textMuted} strokeWidth={2} />
                                </AnimatedPressable>

                                {/* Timer Pill (Turns amber at 5min, red at 1min) */}
                                <View
                                    style={[
                                        styles.timerPill,
                                        {
                                            backgroundColor: isTimerWarning1Min
                                                ? colors.dangerMuted
                                                : isTimerWarning5Min
                                                ? colors.warningMuted
                                                : colors.surfaceRaised,
                                            borderColor: isTimerWarning1Min
                                                ? colors.danger
                                                : isTimerWarning5Min
                                                ? colors.warning
                                                : colors.border,
                                        },
                                    ]}
                                >
                                    <Timer
                                        size={14}
                                        color={
                                            isTimerWarning1Min
                                                ? colors.danger
                                                : isTimerWarning5Min
                                                ? colors.warning
                                                : tabAccent
                                        }
                                        strokeWidth={2}
                                        style={{ marginRight: 5 }}
                                    />
                                    <Text
                                        style={[
                                            styles.timerText,
                                            {
                                                color: isTimerWarning1Min
                                                    ? colors.danger
                                                    : isTimerWarning5Min
                                                    ? colors.warning
                                                    : colors.text,
                                            },
                                        ]}
                                    >
                                        {formattedTime}
                                    </Text>
                                </View>

                                <AnimatedPressable
                                    style={styles.paletteToggleBtn}
                                    onPress={() => setIsPaletteOpen(true)}
                                >
                                    <Layers size={16} color={tabAccent} strokeWidth={2} style={{ marginRight: 4 }} />
                                    <Text style={[styles.paletteBtnText, { color: tabAccent }]}>
                                        {Object.keys(userAnswers).length}/{testQuestions.length}
                                    </Text>
                                </AnimatedPressable>
                            </View>

                            <ScrollView
                                contentContainerStyle={{ paddingBottom: 110, paddingTop: 6 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Question Header & Flag toggle */}
                                <View style={styles.qMetaRow}>
                                    <Text style={styles.qCountBadge}>
                                        Question {currentQIndex + 1} of {testQuestions.length}
                                    </Text>
                                    <AnimatedPressable
                                        style={[
                                            styles.flagBtn,
                                            flaggedQuestions[currentQIndex] && { backgroundColor: colors.warningMuted },
                                        ]}
                                        onPress={handleToggleFlag}
                                    >
                                        <Flag
                                            size={14}
                                            color={flaggedQuestions[currentQIndex] ? colors.warning : colors.textMuted}
                                            strokeWidth={2}
                                            style={{ marginRight: 4 }}
                                        />
                                        <Text
                                            style={[
                                                styles.flagBtnText,
                                                { color: flaggedQuestions[currentQIndex] ? colors.warning : colors.textMuted },
                                            ]}
                                        >
                                            {flaggedQuestions[currentQIndex] ? 'Flagged' : 'Flag'}
                                        </Text>
                                    </AnimatedPressable>
                                </View>

                                {/* Question Text Card */}
                                <View style={[styles.testQuestionCard, shadows.card]}>
                                    <Text style={styles.testSubjectTag}>
                                        {testQuestions[currentQIndex].subject}
                                    </Text>
                                    <Text style={[styles.testQuestionText, { fontFamily: typography.fontFamily.reading }]}>
                                        {testQuestions[currentQIndex].question}
                                    </Text>
                                </View>

                                {/* Options */}
                                <View style={{ gap: 10, marginTop: 14 }}>
                                    {testQuestions[currentQIndex].options.map((opt, oIdx) => {
                                        const isSelected = userAnswers[currentQIndex] === opt;
                                        return (
                                            <AnimatedPressable
                                                key={oIdx}
                                                style={[
                                                    styles.testOptionCard,
                                                    isSelected && { borderColor: tabAccent, backgroundColor: colors.secondaryMuted },
                                                    shadows.subtle,
                                                ]}
                                                onPress={() => handleSelectOption(opt)}
                                            >
                                                <View
                                                    style={[
                                                        styles.testAlphaCircle,
                                                        isSelected && { backgroundColor: tabAccent, borderColor: tabAccent },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.testAlphaText,
                                                            { color: isSelected ? '#FFFFFF' : colors.textMuted },
                                                        ]}
                                                    >
                                                        {String.fromCharCode(65 + oIdx)}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.testOptionText, isSelected && { color: tabAccent, fontWeight: '700' }]}>
                                                    {opt}
                                                </Text>
                                            </AnimatedPressable>
                                        );
                                    })}
                                </View>
                            </ScrollView>

                            {/* Bottom Navigation Toolbar */}
                            <View style={[styles.testNavToolbar, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
                                <AnimatedPressable
                                    style={[styles.testNavBtn, { backgroundColor: colors.surfaceRaised }]}
                                    onPress={() => {
                                        triggerHaptic('selection');
                                        if (currentQIndex > 0) setCurrentQIndex(currentQIndex - 1);
                                    }}
                                    disabled={currentQIndex === 0}
                                >
                                    <ArrowLeft size={16} color={colors.text} strokeWidth={2} />
                                    <Text style={styles.testNavBtnText}>Previous</Text>
                                </AnimatedPressable>

                                {currentQIndex < testQuestions.length - 1 ? (
                                    <AnimatedPressable
                                        style={[styles.testNavBtn, { backgroundColor: tabAccent }]}
                                        onPress={() => {
                                            triggerHaptic('selection');
                                            setCurrentQIndex(currentQIndex + 1);
                                        }}
                                    >
                                        <Text style={[styles.testNavBtnText, { color: '#FFFFFF' }]}>Next</Text>
                                        <ArrowRight size={16} color="#FFFFFF" strokeWidth={2} />
                                    </AnimatedPressable>
                                ) : (
                                    <AnimatedPressable
                                        style={[styles.testNavBtn, { backgroundColor: colors.success }]}
                                        onPress={handleFinishTest}
                                    >
                                        <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                                        <Text style={[styles.testNavBtnText, { color: '#FFFFFF' }]}>Submit Test</Text>
                                    </AnimatedPressable>
                                )}
                            </View>
                        </View>
                    ) : null}
                </View>
            )}

            {/* ── STEP 4: RESULTS & REVIEW SCREEN ── */}
            {wizardStep === 'results' && activeResult && (
                <ScrollView
                    style={styles.landingScroll}
                    contentContainerStyle={{ paddingBottom: 110, paddingTop: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Confetti celebration burst for scores >= 80% */}
                    {activeResult.scorePct >= 80 && <ConfettiBurst />}

                    {/* Results Hero Card */}
                    <View style={[styles.resultsHeroCard, shadows.elevated]}>
                        <Text style={styles.resultsBadgeText}>Examination Summary</Text>
                        <Text style={styles.resultsCourseTitle}>{activeResult.courseTitle}</Text>

                        <View style={{ marginVertical: 18 }}>
                            <ProgressRing
                                percentage={activeResult.scorePct}
                                size={110}
                                strokeWidth={9}
                                showLabel={true}
                                gradientColors={
                                    activeResult.scorePct >= 80
                                        ? gradients.tealToBlue[isDark ? 'dark' : 'light']
                                        : gradients.coralToYellow[isDark ? 'dark' : 'light']
                                }
                            />
                        </View>

                        <Text style={styles.resultsScoreSummary}>
                            {activeResult.totalCorrect} of {activeResult.totalQuestions} Questions Correct ({activeResult.scorePct}%)
                        </Text>
                    </View>

                    {/* Per-Subject Breakdown */}
                    <Text style={[styles.sectionHeader, { marginTop: 18 }]}>Subject Breakdown</Text>
                    <View style={{ gap: 8 }}>
                        {activeResult.subjectBreakdown.map((sb, idx) => {
                            const pct = Math.round((sb.correct / (sb.total || 1)) * 100);
                            return (
                                <View key={idx} style={[styles.subBreakdownCard, shadows.subtle]}>
                                    <View style={styles.subBreakdownHeader}>
                                        <Text style={styles.subBreakdownTitle}>{sb.subject}</Text>
                                        <Text style={styles.subBreakdownScore}>{sb.correct}/{sb.total} ({pct}%)</Text>
                                    </View>
                                    <View style={[styles.subProgressTrack, { backgroundColor: colors.surfaceRaised }]}>
                                        <View
                                            style={[
                                                styles.subProgressFill,
                                                {
                                                    width: `${pct}%`,
                                                    backgroundColor: pct >= 70 ? colors.success : tabAccent,
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Review Filter Bar */}
                    <Text style={[styles.sectionHeader, { marginTop: 22 }]}>Detailed Answers Review</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        {(['all', 'missed', 'flagged'] as const).map((rf) => (
                            <TouchableOpacity
                                key={rf}
                                style={[
                                    styles.filterPill,
                                    reviewFilter === rf && { backgroundColor: tabAccent },
                                ]}
                                onPress={() => setReviewFilter(rf)}
                            >
                                <Text
                                    style={[
                                        styles.filterPillText,
                                        { color: reviewFilter === rf ? '#FFFFFF' : colors.textMuted },
                                    ]}
                                >
                                    {rf === 'all' ? 'All Questions' : rf === 'missed' ? 'Missed Only' : 'Flagged'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Review Question Cards */}
                    <View style={{ gap: 12 }}>
                        {filteredReviewQuestions.map((q, qIdx) => {
                            const userAns = userAnswers[qIdx];
                            const isCorrect = userAns === q.correct_answer;

                            return (
                                <View key={q.id} style={[styles.reviewCard, shadows.card]}>
                                    <View style={styles.reviewHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            {isCorrect ? (
                                                <CheckCircle2 size={18} color={colors.success} strokeWidth={2} style={{ marginRight: 6 }} />
                                            ) : (
                                                <XCircle size={18} color={colors.danger} strokeWidth={2} style={{ marginRight: 6 }} />
                                            )}
                                            <Text style={styles.reviewQuestionNum}>Q{qIdx + 1}</Text>
                                        </View>
                                        <Text style={styles.reviewSubjectBadge}>{q.subject}</Text>
                                    </View>

                                    <Text style={[styles.reviewQuestionText, { fontFamily: typography.fontFamily.reading }]}>
                                        {q.question}
                                    </Text>

                                    <View style={[styles.reviewAnswerBox, { backgroundColor: isCorrect ? colors.successMuted : colors.dangerMuted }]}>
                                        <Text style={[styles.reviewAnswerLabel, { color: isCorrect ? colors.success : colors.danger }]}>
                                            Your Answer: {userAns || 'Unanswered'}
                                        </Text>
                                        {!isCorrect && (
                                            <Text style={[styles.reviewAnswerLabel, { color: colors.success, marginTop: 4 }]}>
                                                Correct: {q.correct_answer}
                                            </Text>
                                        )}
                                    </View>

                                    <Text style={[styles.reviewExplanation, { fontFamily: typography.fontFamily.reading }]}>
                                        {q.explanation}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    <AnimatedPressable
                        style={[styles.exitReviewBtn, { backgroundColor: tabAccent }, shadows.glowAccent]}
                        onPress={() => setWizardStep('landing')}
                    >
                        <Text style={styles.exitReviewBtnText}>Back to Exam Dashboard</Text>
                    </AnimatedPressable>
                </ScrollView>
            )}

            {/* Question Palette Bottom Sheet Modal */}
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
                        <Text style={styles.paletteModalTitle}>Question Navigator</Text>
                        <View style={styles.paletteGrid}>
                            {testQuestions.map((_, idx) => {
                                const isAnswered = userAnswers[idx] !== undefined;
                                const isFlagged = !!flaggedQuestions[idx];
                                const isCurrent = currentQIndex === idx;

                                return (
                                    <AnimatedPressable
                                        key={idx}
                                        style={[
                                            styles.paletteItem,
                                            isAnswered && { backgroundColor: tabAccent },
                                            isFlagged && { borderColor: colors.warning, borderWidth: 2 },
                                            isCurrent && { borderWidth: 2, borderColor: colors.text },
                                        ]}
                                        onPress={() => {
                                            setCurrentQIndex(idx);
                                            setIsPaletteOpen(false);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.paletteItemText,
                                                { color: isAnswered ? '#FFFFFF' : colors.text },
                                            ]}
                                        >
                                            {idx + 1}
                                        </Text>
                                    </AnimatedPressable>
                                );
                            })}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Leave Test Confirm Dialog */}
            <ConfirmDialog
                visible={isLeaveConfirmOpen}
                title="Leave Active Examination?"
                message="Your current progress is saved, but the timer will pause. You can resume anytime."
                confirmText="Leave Test"
                cancelText="Continue Test"
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

const createStyles = (colors: ThemeColors, shadows: any, tabAccent: string) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        landingScroll: {
            flex: 1,
            paddingHorizontal: 16,
        },
        landingContent: {
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingBottom: 110,
        },
        heroCard: {
            padding: 20,
            marginBottom: 20,
        },
        heroBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
            alignSelf: 'flex-start',
            marginBottom: 8,
        },
        heroBadgeText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            marginLeft: 5,
        },
        heroTitle: {
            fontSize: 22,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.3,
        },
        heroSub: {
            fontSize: typography.sizes.xs + 1,
            color: 'rgba(255, 255, 255, 0.9)',
            marginTop: 4,
            lineHeight: 18,
        },
        heroCtaBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: radii.controls,
            marginTop: 16,
        },
        heroCtaText: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
        },
        sectionHeader: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 10,
        },
        emptyTrendBox: {
            padding: 16,
            borderRadius: radii.cards,
            alignItems: 'center',
        },
        emptyTrendText: {
            fontSize: typography.sizes.xs + 1,
            textAlign: 'center',
        },
        trendCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
        },
        trendCardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: 12,
            marginBottom: 14,
        },
        trendScoreMain: {
            fontSize: 28,
            fontWeight: '800',
            color: tabAccent,
        },
        trendScoreSub: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '600',
        },
        trendMetaText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            color: colors.text,
        },
        trendMetaDate: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        historyBarsRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'flex-end',
            height: 90,
            paddingTop: 10,
        },
        barColumn: {
            alignItems: 'center',
            width: 38,
        },
        barTrack: {
            width: 14,
            height: 65,
            borderRadius: 7,
            justifyContent: 'flex-end',
            overflow: 'hidden',
        },
        barFill: {
            width: '100%',
            borderRadius: 7,
        },
        barLabel: {
            fontSize: 10,
            fontWeight: '700',
            color: colors.textMuted,
            marginTop: 4,
        },
        practiceBtn: {
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
        },
        practiceBtnText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        weakTopicsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        weakChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: radii.full,
            borderWidth: 1,
        },
        weakChipText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        setupContent: {
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingBottom: 110,
        },
        setupHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            gap: 12,
        },
        backBtn: {
            width: 40,
            height: 40,
            borderRadius: radii.controls,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
        },
        setupHeaderTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
        },
        setupSectionLabel: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '800',
            color: colors.text,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
        },
        courseSelectBox: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.controls,
            padding: 14,
        },
        courseSelectText: {
            fontSize: typography.sizes.sm + 1,
            fontWeight: '700',
            color: colors.text,
            flex: 1,
        },
        subjectSelectCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.cards,
            padding: 14,
        },
        checkboxCircle: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        subjectSelectName: {
            fontSize: typography.sizes.sm + 1,
            fontWeight: '700',
            color: colors.text,
        },
        subjectSelectDocsCount: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        configPill: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: radii.controls,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        configPillText: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
        },
        testTopBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingBottom: 10,
        },
        leaveTestBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
        },
        timerPill: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: radii.full,
            borderWidth: 1,
        },
        timerText: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            letterSpacing: 0.5,
        },
        paletteToggleBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: radii.controls,
            backgroundColor: colors.surfaceRaised,
        },
        paletteBtnText: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
        },
        qMetaRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginVertical: 8,
        },
        qCountBadge: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
            color: colors.textMuted,
        },
        flagBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: radii.full,
        },
        flagBtnText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        testQuestionCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
        },
        testSubjectTag: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            color: tabAccent,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
        },
        testQuestionText: {
            fontSize: typography.sizes.md,
            lineHeight: 26,
            color: colors.text,
            fontWeight: '600',
        },
        testOptionCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderRadius: radii.cards,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        testAlphaCircle: {
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
        },
        testAlphaText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        testOptionText: {
            flex: 1,
            fontSize: typography.sizes.sm + 1,
            lineHeight: 20,
            color: colors.text,
        },
        testNavToolbar: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTopWidth: 1,
            paddingVertical: 10,
            paddingHorizontal: 12,
            marginBottom: 75,
            borderRadius: radii.cards,
        },
        testNavBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: radii.controls,
            gap: 6,
        },
        testNavBtnText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            color: colors.text,
        },
        resultsHeroCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            alignItems: 'center',
        },
        resultsBadgeText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: tabAccent,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
        },
        resultsCourseTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
            marginTop: 4,
            textAlign: 'center',
        },
        resultsScoreSummary: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
        },
        subBreakdownCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.controls,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
        },
        subBreakdownHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
        },
        subBreakdownTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            color: colors.text,
        },
        subBreakdownScore: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
        },
        subProgressTrack: {
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
        },
        subProgressFill: {
            height: '100%',
            borderRadius: 3,
        },
        filterPill: {
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceRaised,
        },
        filterPillText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        reviewCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
        },
        reviewHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        reviewQuestionNum: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            color: colors.text,
        },
        reviewSubjectBadge: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
        },
        reviewQuestionText: {
            fontSize: typography.sizes.sm + 1,
            lineHeight: 22,
            color: colors.text,
            fontWeight: '600',
        },
        reviewAnswerBox: {
            padding: 10,
            borderRadius: radii.controls,
            marginVertical: 8,
        },
        reviewAnswerLabel: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
        },
        reviewExplanation: {
            fontSize: typography.sizes.xs + 1,
            lineHeight: 20,
            color: colors.textSecondary,
        },
        exitReviewBtn: {
            paddingVertical: 14,
            borderRadius: radii.controls,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 20,
        },
        exitReviewBtnText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.sm + 1,
            fontWeight: '700',
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
            borderRadius: radii.sheets,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
        },
        paletteModalTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
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
            borderRadius: radii.controls,
            backgroundColor: colors.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
        },
        paletteItemText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        loadingText: {
            marginTop: 12,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
    });

export default ExamPrepScreen;
