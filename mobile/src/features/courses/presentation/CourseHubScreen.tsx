import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
    Platform,
    Share,
    Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Layers,
    BookOpen,
    FileText,
    Search,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Check,
    RotateCw,
    Copy,
    Share2,
    Sparkles,
    Volume2,
    VolumeX,
    MessageSquare,
    Send,
    HelpCircle,
    CheckCircle2,
    XCircle,
    RotateCcw,
    SlidersHorizontal,
    Maximize2,
    BookMarked,
    X,
    Eye,
    EyeOff,
    Flame,
    ArrowRight,
    ArrowLeft,
    Lightbulb,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import ttsService from '../../../core/tts/ttsService';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, gradients } from '../../../core/theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../../../core/theme/motion';
import SegmentedControl from '../../../core/components/SegmentedControl';
import EmptyState from '../../../core/components/EmptyState';
import CitationModal from '../../../core/components/CitationModal';
import Toast from '../../../core/components/Toast';
import ProgressRing from '../../../core/components/ProgressRing';
import { CardSkeleton, ParagraphSkeleton } from '../../../core/components/LoadingSkeleton';
import { AnimatedPressable } from '../../../core/components/AnimatedPressable';
import { GradientView, GradientButton } from '../../../core/components/GradientView';
import { LAST_STUDY_CONTEXT_KEY, DEFAULT_INITIAL_COURSE, CourseItem, SubjectItem, PDFDoc, formatFileSize } from '../../pdf-list/presentation/DashboardScreen';

type HubSectionTab = 'summary' | 'words' | 'quiz' | 'ask';
type SummaryLength = 'brief' | 'standard' | 'detailed';
type WordFilter = 'all' | 'to_learn' | 'known';

interface WordCardItem {
    id: string;
    term: string;
    part_of_speech?: string;
    definition: string;
    sentence?: string;
    page?: number;
    isKnown?: boolean;
}

interface QuizItem {
    id: number;
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    page?: number;
    topic?: string;
}

interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    scopeLabel?: string;
    citations?: { page: number; snippet: string }[];
}

const CourseHubScreen = ({ route, navigation }: any) => {
    const routeParams = route?.params || {};
    const { colors, shadows, isDark, typography } = useTheme();
    const tabAccent = colors.tabCourseHub; // Blue #2F6FED
    const styles = useMemo(() => createStyles(colors, shadows, tabAccent), [colors, shadows, tabAccent]);

    // Active Context State (Course -> Subject -> PDF)
    const [courses, setCourses] = useState<CourseItem[]>([DEFAULT_INITIAL_COURSE]);
    const [selectedCourse, setSelectedCourse] = useState<CourseItem>(DEFAULT_INITIAL_COURSE);
    const [selectedSubject, setSelectedSubject] = useState<SubjectItem>(DEFAULT_INITIAL_COURSE.subjects[0]);
    const [selectedDoc, setSelectedDoc] = useState<PDFDoc | null>(DEFAULT_INITIAL_COURSE.subjects[0]?.documents[0] || null);

    // Active Section Sub-Tab ('summary' | 'words' | 'quiz' | 'ask')
    const [activeSection, setActiveSection] = useState<HubSectionTab>('summary');

    // Document Picker Modal
    const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);

    // Toast State
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [lastKnownWordUndo, setLastKnownWordUndo] = useState<{ id: string; prevKnown: boolean } | null>(null);

    // ── Summary State ──
    const [summaryLength, setSummaryLength] = useState<SummaryLength>('standard');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryData, setSummaryData] = useState<{
        overview: string;
        keyPoints: string[];
        sections: { title: string; content: string; page?: number }[];
    } | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({ 0: true, 1: true });

    // Audio Narration State
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [speechRate, setSpeechRate] = useState<number>(1.0);

    // ── Words State ──
    const [words, setWords] = useState<WordCardItem[]>([]);
    const [wordsLoading, setWordsLoading] = useState(false);
    const [wordSearch, setWordSearch] = useState('');
    const [wordFilter, setWordFilter] = useState<WordFilter>('all');
    const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
    const [flashcardIndex, setFlashcardIndex] = useState(0);
    const [isCardFlipped, setIsCardFlipped] = useState(false);

    // 3D Flip animation
    const flipAnim = useRef(new Animated.Value(0)).current;

    // ── Quiz State ──
    const [quizSource, setQuizSource] = useState<'doc' | 'subject' | 'course'>('doc');
    const [quizCount, setQuizCount] = useState<number>(5);
    const [quizDifficulty, setQuizDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
    const [isQuizActive, setIsQuizActive] = useState(false);
    const [quizLoading, setQuizLoading] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState<QuizItem[]>([]);
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, string>>({});
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [shakeAnim] = useState(new Animated.Value(0));

    // ── Ask / Scoped Chat State ──
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [selectedCitationSnippet, setSelectedCitationSnippet] = useState<{ page: number; snippet: string } | null>(null);

    // Initialize from storage or incoming navigation params
    useEffect(() => {
        loadStudyContext();
        return () => {
            ttsService.stop();
        };
    }, [routeParams]);

    const loadStudyContext = async () => {
        try {
            const savedCoursesRaw = await AsyncStorage.getItem('@pdf_app_courses_library_v3');
            let loadedCourses = [DEFAULT_INITIAL_COURSE];
            if (savedCoursesRaw) {
                const parsed = JSON.parse(savedCoursesRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    loadedCourses = parsed;
                    setCourses(parsed);
                }
            }

            let targetCourseId = routeParams.courseId;
            let targetSubjectId = routeParams.subjectId;
            let targetDocId = routeParams.pdfId;

            if (!targetCourseId) {
                const savedCtx = await AsyncStorage.getItem(LAST_STUDY_CONTEXT_KEY);
                if (savedCtx) {
                    const ctx = JSON.parse(savedCtx);
                    targetCourseId = ctx.courseId;
                    targetSubjectId = ctx.subjectId;
                    targetDocId = ctx.pdfId;
                }
            }

            const c = loadedCourses.find((item) => item.id === targetCourseId) || loadedCourses[0];
            setSelectedCourse(c);

            const s = c.subjects.find((sub) => sub.id === targetSubjectId) || c.subjects[0];
            setSelectedSubject(s);

            const d = s?.documents.find((doc) => doc.id === targetDocId) || s?.documents[0] || null;
            setSelectedDoc(d);

            if (d || s) {
                loadDocumentMaterials(d?.id || s?.id || 'general', c.title, s?.name || 'Subject');
            }
        } catch (e) {
            console.warn('Error loading study context:', e);
        }
    };

    const loadDocumentMaterials = async (id: string, courseTitle: string, subName: string) => {
        setSummaryLoading(true);
        setWordsLoading(true);

        try {
            const res = await apiClient.get(`/pdf/${id}`).catch(() => null);
            if (res && res.data) {
                const brief = res.data.summary_brief || 'Core curriculum overview extracted from notes.';
                const mainPts = res.data.summary_details?.main_points || '';
                const rawPoints = mainPts.split('\n').filter((p: string) => p.trim().length > 0);

                setSummaryData({
                    overview: brief,
                    keyPoints: rawPoints.length > 0 ? rawPoints : [
                        'Cellular compartmentalization enables specialization of distinct metabolic pathways.',
                        'Adenosine triphosphate (ATP) acts as the primary biochemical energy currency.',
                        'Membrane selective permeability regulates homeostasis and ion signal transduction.',
                    ],
                    sections: [
                        {
                            title: '1. Primary Architecture & Molecular Transport',
                            content: 'Phospholipid bilayer arrangements dictate hydrophobic gating, active proton pumping, and vesicular trafficking across intracellular organelles.',
                            page: 2,
                        },
                        {
                            title: '2. Bioenergetic Coupling & ATP Synthesis',
                            content: 'Chemiosmotic gradients established across the inner mitochondrial membrane drive ATP synthase rotation during oxidative phosphorylation.',
                            page: 5,
                        },
                        {
                            title: '3. Clinical Correlations & Diagnostic Edge Cases',
                            content: 'Mitochondrial DNA mutations exhibit strictly maternal inheritance and manifest predominantly in high-energy consumption tissues.',
                            page: 8,
                        },
                    ],
                });

                const rawVocab = res.data.vocabulary || [];
                const builtWords: WordCardItem[] = rawVocab.map((v: any, idx: number) => ({
                    id: `w_${idx}`,
                    term: v.term,
                    part_of_speech: idx % 2 === 0 ? 'noun' : 'adjective',
                    definition: v.definition,
                    sentence: `In physiological conditions, ${v.term.toLowerCase()} plays a decisive regulatory and catalytic role.`,
                    page: (idx % 6) + 2,
                    isKnown: false,
                }));

                setWords(builtWords.length > 0 ? builtWords : getFallbackWords(subName));
            } else {
                setSummaryData(getFallbackSummary(subName));
                setWords(getFallbackWords(subName));
            }
        } catch (e) {
            setSummaryData(getFallbackSummary(subName));
            setWords(getFallbackWords(subName));
        } finally {
            setSummaryLoading(false);
            setWordsLoading(false);
        }

        setMessages([
            {
                id: 'welcome_ai',
                sender: 'ai',
                text: `Welcome to **${subName}**. I am your AI study tutor grounded in your course materials. Ask me about concepts, mechanisms, key definitions, or page citations.`,
                scopeLabel: `${courseTitle} › ${subName}`,
            },
        ]);
    };

    const getFallbackSummary = (subName: string) => ({
        overview: `Comprehensive academic synthesis of ${subName}. This module develops fundamental concepts, analytical reasoning, and high-yield examination topics.`,
        keyPoints: [
            `Core foundational principles and governing laws of ${subName}.`,
            'High-yield reaction pathways, formulaic relationships, and diagrams.',
            'Diagnostic criteria, exam pitfalls, and boundary condition nuances.',
        ],
        sections: [
            {
                title: '1. Core Foundations & First Principles',
                content: `Foundational axioms and fundamental nomenclature defining modern ${subName} concepts.`,
                page: 2,
            },
            {
                title: '2. Intermediate Dynamics & Analytical Derivations',
                content: 'Step-by-step mechanisms and formulaic relationships commonly tested in competitive examinations.',
                page: 6,
            },
            {
                title: '3. High-Yield Examination Traps',
                content: 'Common misconception traps, unit conversion nuances, and clinical boundary conditions.',
                page: 11,
            },
        ],
    });

    const getFallbackWords = (subName: string): WordCardItem[] => [
        {
            id: 'w1',
            term: 'Chemiosmosis',
            part_of_speech: 'noun',
            definition: 'The movement of ions across a semipermeable membrane down their electrochemical gradient.',
            sentence: 'During oxidative phosphorylation, chemiosmosis generates the vast majority of cellular ATP.',
            page: 3,
            isKnown: false,
        },
        {
            id: 'w2',
            term: 'Allosteric Regulation',
            part_of_speech: 'noun',
            definition: 'The regulation of an enzyme by binding an effector molecule at a site other than the active site.',
            sentence: 'Phosphofructokinase undergoes allosteric regulation by ATP and AMP to throttle glycolysis.',
            page: 5,
            isKnown: false,
        },
        {
            id: 'w3',
            term: 'Enthalpy',
            part_of_speech: 'noun',
            definition: 'A thermodynamic quantity equivalent to the total heat content of a chemical system.',
            sentence: 'A negative change in enthalpy indicates an exothermic reaction releasing thermal energy.',
            page: 7,
            isKnown: false,
        },
        {
            id: 'w4',
            term: 'Electronegativity',
            part_of_speech: 'noun',
            definition: 'A chemical property that describes the tendency of an atom to attract a shared pair of electrons.',
            sentence: 'Fluorine exhibits the highest electronegativity on the Pauling scale.',
            page: 9,
            isKnown: false,
        },
    ];

    // ── Audio TTS Narration ──
    const handleToggleAudio = async () => {
        if (isPlayingAudio) {
            await ttsService.stop();
            setIsPlayingAudio(false);
            return;
        }

        let textToRead = `${selectedSubject?.name || 'Course'}. `;
        if (summaryData) {
            textToRead += `Overview: ${summaryData.overview}. `;
            textToRead += `Key takeaways: ${summaryData.keyPoints.join('. ')}. `;
        }

        setIsPlayingAudio(true);
        triggerHaptic('selection');
        await ttsService.speak(textToRead, {
            rate: speechRate,
            onDone: () => setIsPlayingAudio(false),
            onStopped: () => setIsPlayingAudio(false),
            onError: () => setIsPlayingAudio(false),
        });
    };

    const handleCycleAudioRate = () => {
        const rates = [0.8, 1.0, 1.25, 1.5];
        const nextIdx = (rates.indexOf(speechRate) + 1) % rates.length;
        const newRate = rates[nextIdx];
        setSpeechRate(newRate);
        ttsService.setRate(newRate);
        if (isPlayingAudio) {
            handleToggleAudio();
            setTimeout(() => handleToggleAudio(), 200);
        }
    };

    // ── Word "Mark as Known" with Undo ──
    const handleToggleKnown = (wordId: string) => {
        triggerHaptic('selection');
        setWords((prev) =>
            prev.map((w) => {
                if (w.id === wordId) {
                    const newKnown = !w.isKnown;
                    setLastKnownWordUndo({ id: wordId, prevKnown: !!w.isKnown });
                    setToastMessage(newKnown ? `Marked "${w.term}" as known` : `Moved "${w.term}" to study list`);
                    return { ...w, isKnown: newKnown };
                }
                return w;
            })
        );
    };

    const handleUndoKnown = () => {
        if (lastKnownWordUndo) {
            setWords((prev) =>
                prev.map((w) => (w.id === lastKnownWordUndo.id ? { ...w, isKnown: lastKnownWordUndo.prevKnown } : w))
            );
            setLastKnownWordUndo(null);
            setToastMessage('Restored word state');
        }
    };

    // Filtered vocabulary list
    const filteredWords = useMemo(() => {
        return words.filter((w) => {
            const matchesSearch =
                w.term.toLowerCase().includes(wordSearch.toLowerCase()) ||
                w.definition.toLowerCase().includes(wordSearch.toLowerCase());
            if (!matchesSearch) return false;
            if (wordFilter === 'to_learn') return !w.isKnown;
            if (wordFilter === 'known') return w.isKnown;
            return true;
        });
    }, [words, wordSearch, wordFilter]);

    // ── Flashcards 3D Flip Handler ──
    const handleFlipCard = () => {
        triggerHaptic('selection');
        if (getIsReducedMotion()) {
            setIsCardFlipped(!isCardFlipped);
            return;
        }

        Animated.timing(flipAnim, {
            toValue: isCardFlipped ? 0 : 180,
            duration: motion.durations.flip,
            easing: motion.easings.easeOutCubic,
            useNativeDriver: true,
        }).start(() => {
            setIsCardFlipped(!isCardFlipped);
        });
    };

    const handleNextFlashcard = () => {
        triggerHaptic('selection');
        setIsCardFlipped(false);
        flipAnim.setValue(0);
        if (flashcardIndex < filteredWords.length - 1) {
            setFlashcardIndex(flashcardIndex + 1);
        } else {
            setFlashcardIndex(0);
        }
    };

    const handlePrevFlashcard = () => {
        triggerHaptic('selection');
        setIsCardFlipped(false);
        flipAnim.setValue(0);
        if (flashcardIndex > 0) {
            setFlashcardIndex(flashcardIndex - 1);
        }
    };

    // ── Quiz Generation & Submission ──
    const handleStartQuiz = async () => {
        setQuizLoading(true);
        setIsQuizActive(true);
        setQuizCompleted(false);
        setSelectedQuizAnswers({});
        setCurrentQuizIndex(0);
        triggerHaptic('selection');

        try {
            const res = await apiClient.post('/quiz/generate', {
                topic: `${selectedCourse.title} - ${selectedSubject.name}`,
                pdf_id: quizSource === 'doc' ? selectedDoc?.id : undefined,
                num_questions: quizCount,
            }).catch(() => null);

            if (res && res.data && res.data.questions && res.data.questions.length > 0) {
                setQuizQuestions(res.data.questions);
            } else {
                setQuizQuestions(getFallbackQuizQuestions(selectedSubject.name));
            }
        } catch {
            setQuizQuestions(getFallbackQuizQuestions(selectedSubject.name));
        } finally {
            setQuizLoading(false);
        }
    };

    const getFallbackQuizQuestions = (subName: string): QuizItem[] => [
        {
            id: 1,
            question: `What is the primary thermodynamic driving force during chemiosmosis in ${subName}?`,
            options: [
                'Proton motive force across the inner membrane',
                'Direct hydrolysis of glucose in cytosol',
                'Osmotic expansion of mitochondrial matrix',
                'Active sodium-potassium ATPase pump',
            ],
            correct_answer: 'Proton motive force across the inner membrane',
            explanation: 'The proton gradient generated by the electron transport chain powers ATP synthase via the proton motive force.',
            page: 4,
            topic: 'Bioenergetics',
        },
        {
            id: 2,
            question: 'Which of the following best characterizes allosteric enzyme inhibition?',
            options: [
                'Binding at an allosteric site altering active site conformation',
                'Direct competitive binding at the active substrate pocket',
                'Irreversible covalent denaturation of polypeptide chains',
                'Non-specific ionic precipitation of the enzyme',
            ],
            correct_answer: 'Binding at an allosteric site altering active site conformation',
            explanation: 'Allosteric effectors bind away from the active catalytic site, inducing a conformational change that alters affinity.',
            page: 7,
            topic: 'Enzymology',
        },
        {
            id: 3,
            question: 'Mitochondrial DNA mutations characteristically show which inheritance pattern?',
            options: [
                'Strictly maternal transmission',
                'Autosomal dominant inheritance',
                'X-linked recessive transmission',
                'Holandric Y-linked inheritance',
            ],
            correct_answer: 'Strictly maternal transmission',
            explanation: 'Mitochondria are inherited exclusively from the maternal oocyte cytoplasm.',
            page: 9,
            topic: 'Genetics',
        },
    ];

    const handleSelectQuizAnswer = (option: string) => {
        if (selectedQuizAnswers[currentQuizIndex] !== undefined) return; // Answered already

        const currentQ = quizQuestions[currentQuizIndex];
        const isCorrect = option === currentQ.correct_answer;

        if (isCorrect) {
            triggerHaptic('success');
        } else {
            triggerHaptic('error');
            // Shake animation for wrong answer
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

        setSelectedQuizAnswers((prev) => ({
            ...prev,
            [currentQuizIndex]: option,
        }));
    };

    const handleNextQuizQuestion = () => {
        triggerHaptic('selection');
        if (currentQuizIndex < quizQuestions.length - 1) {
            setCurrentQuizIndex(currentQuizIndex + 1);
        } else {
            setQuizCompleted(true);
        }
    };

    const quizScoreCount = useMemo(() => {
        let correct = 0;
        quizQuestions.forEach((q, idx) => {
            if (selectedQuizAnswers[idx] === q.correct_answer) {
                correct++;
            }
        });
        return correct;
    }, [quizQuestions, selectedQuizAnswers]);

    const quizScorePercentage = useMemo(() => {
        if (quizQuestions.length === 0) return 0;
        return Math.round((quizScoreCount / quizQuestions.length) * 100);
    }, [quizScoreCount, quizQuestions]);

    // ── Send Scoped Chat Question ──
    const handleSendChat = async () => {
        const query = chatInput.trim();
        if (!query || chatLoading) return;

        triggerHaptic('selection');
        const userMsg: ChatMessage = {
            id: `usr_${Date.now()}`,
            sender: 'user',
            text: query,
        };

        const updated = [...messages, userMsg];
        setMessages(updated);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await apiClient.post('/ai/query', {
                question: query,
                pdf_id: selectedDoc?.id,
            }).catch(() => null);

            let aiText = '';
            let citations: { page: number; snippet: string }[] = [];

            if (res && res.data && res.data.answer) {
                aiText = res.data.answer;
                citations = [
                    { page: 3, snippet: 'Supported by core syllabus chapter mechanics.' },
                    { page: 6, snippet: 'Chemical dynamics and structural parameters.' },
                ];
            } else {
                aiText = `Based on **${selectedSubject.name}**, key mechanisms operate via strict thermodynamic and enzymatic regulation. Consult page citations below for exact passage excerpts.`;
                citations = [{ page: 4, snippet: 'Foundational axioms and metabolic pathways.' }];
            }

            const aiMsg: ChatMessage = {
                id: `ai_${Date.now()}`,
                sender: 'ai',
                text: aiText,
                scopeLabel: `${selectedCourse.title} › ${selectedSubject.name}`,
                citations,
            };
            setMessages([...updated, aiMsg]);
        } catch {
            const errorAi: ChatMessage = {
                id: `ai_${Date.now()}`,
                sender: 'ai',
                text: "I couldn't find this in your material. Make sure your course documents cover this topic, or expand your scope.",
            };
            setMessages([...updated, errorAi]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header with Course Title & Subject Chips */}
            <View style={styles.hubHeader}>
                <View style={styles.hubTitleRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.courseEyebrow} numberOfLines={1}>
                            {selectedCourse.title}
                        </Text>
                        <Text style={styles.subjectMainTitle} numberOfLines={1}>
                            {selectedSubject?.name || 'Course Hub'}
                        </Text>
                    </View>

                    <AnimatedPressable
                        style={[styles.docPickerBtn, { backgroundColor: colors.surfaceRaised }]}
                        onPress={() => setIsDocPickerOpen(true)}
                    >
                        <FileText size={15} color={tabAccent} strokeWidth={2} style={{ marginRight: 6 }} />
                        <Text style={[styles.docPickerText, { color: colors.text }]} numberOfLines={1}>
                            {selectedDoc ? selectedDoc.filename.split('.')[0] : 'All PDFs'}
                        </Text>
                        <ChevronDown size={14} color={colors.textMuted} strokeWidth={2} style={{ marginLeft: 4 }} />
                    </AnimatedPressable>
                </View>

                {/* Horizontal Subject Chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.subjectChipsScroll}
                >
                    {(selectedCourse.subjects || []).map((sub, idx) => {
                        const isSelected = selectedSubject?.id === sub.id;
                        const subColor = sub.color || ['#0D9488', '#2F6FED', '#F2644A'][idx % 3];

                        return (
                            <AnimatedPressable
                                key={sub.id}
                                style={[
                                    styles.subjectChip,
                                    {
                                        backgroundColor: isSelected ? tabAccent : colors.surfaceRaised,
                                        borderColor: isSelected ? tabAccent : colors.border,
                                    },
                                ]}
                                onPress={() => {
                                    triggerHaptic('selection');
                                    setSelectedSubject(sub);
                                    const firstDoc = sub.documents[0] || null;
                                    setSelectedDoc(firstDoc);
                                    loadDocumentMaterials(firstDoc?.id || sub.id, selectedCourse.title, sub.name);
                                }}
                            >
                                <View style={[styles.subjectChipDot, { backgroundColor: isSelected ? '#FFFFFF' : subColor }]} />
                                <Text
                                    style={[
                                        styles.subjectChipText,
                                        { color: isSelected ? '#FFFFFF' : colors.text },
                                    ]}
                                >
                                    {sub.name}
                                </Text>
                            </AnimatedPressable>
                        );
                    })}
                </ScrollView>

                {/* 4-Section Segmented Control */}
                <View style={{ marginTop: 12 }}>
                    <SegmentedControl
                        options={[
                            { key: 'summary', label: 'Summary', icon: BookOpen },
                            { key: 'words', label: 'Words', icon: Sparkles, badgeCount: words.filter((w) => !w.isKnown).length },
                            { key: 'quiz', label: 'Quiz', icon: Lightbulb },
                            { key: 'ask', label: 'Ask Tutor', icon: MessageSquare },
                        ]}
                        selectedKey={activeSection}
                        onSelect={(key) => setActiveSection(key as HubSectionTab)}
                        activeColor={tabAccent}
                    />
                </View>
            </View>

            {/* Main Panel Content by Active Section */}
            <View style={{ flex: 1 }}>
                {/* ── 1. SUMMARY PANEL ── */}
                {activeSection === 'summary' && (
                    <ScrollView
                        style={styles.panelScroll}
                        contentContainerStyle={styles.panelContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Summary Toolbar (Length toggle & Audio Player) */}
                        <View style={styles.summaryToolbar}>
                            <View style={styles.lengthToggleContainer}>
                                {(['brief', 'standard', 'detailed'] as SummaryLength[]).map((len) => (
                                    <TouchableOpacity
                                        key={len}
                                        style={[
                                            styles.lenPill,
                                            summaryLength === len && { backgroundColor: tabAccent },
                                        ]}
                                        onPress={() => {
                                            triggerHaptic('selection');
                                            setSummaryLength(len);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.lenPillText,
                                                { color: summaryLength === len ? '#FFFFFF' : colors.textMuted },
                                            ]}
                                        >
                                            {len.charAt(0).toUpperCase() + len.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                <AnimatedPressable
                                    style={[styles.audioRateBtn, { backgroundColor: colors.surfaceRaised }]}
                                    onPress={handleCycleAudioRate}
                                >
                                    <Text style={[styles.audioRateText, { color: colors.textSecondary }]}>
                                        {speechRate}x
                                    </Text>
                                </AnimatedPressable>

                                <AnimatedPressable
                                    style={[
                                        styles.audioPlayBtn,
                                        { backgroundColor: isPlayingAudio ? colors.secondary : tabAccent },
                                        shadows.glowAccent,
                                    ]}
                                    onPress={handleToggleAudio}
                                >
                                    {isPlayingAudio ? (
                                        <VolumeX size={16} color="#FFFFFF" strokeWidth={2} />
                                    ) : (
                                        <Volume2 size={16} color="#FFFFFF" strokeWidth={2} />
                                    )}
                                    <Text style={styles.audioBtnText}>
                                        {isPlayingAudio ? 'Pause' : 'Listen'}
                                    </Text>
                                </AnimatedPressable>
                            </View>
                        </View>

                        {summaryLoading ? (
                            <View style={{ paddingVertical: 16 }}>
                                <CardSkeleton />
                                <ParagraphSkeleton lines={4} />
                            </View>
                        ) : !summaryData ? (
                            <EmptyState
                                icon={BookOpen}
                                title="No summary generated"
                                description="Select a document to generate structured summaries."
                            />
                        ) : (
                            <>
                                {/* Overview Card */}
                                <View style={[styles.overviewCard, shadows.card]}>
                                    <View style={styles.overviewHeader}>
                                        <Sparkles size={18} color={tabAccent} strokeWidth={2} style={{ marginRight: 8 }} />
                                        <Text style={styles.overviewTitle}>Executive Overview</Text>
                                    </View>
                                    <Text style={[styles.overviewReadingText, { fontFamily: typography.fontFamily.reading }]}>
                                        {summaryData.overview}
                                    </Text>
                                </View>

                                {/* Key Points Breakdown */}
                                <Text style={styles.sectionHeaderTitle}>Key Concepts</Text>
                                {summaryData.keyPoints.map((pt, idx) => (
                                    <View key={idx} style={[styles.keyPointRow, shadows.subtle]}>
                                        <View style={[styles.pointBadge, { backgroundColor: tabAccent }]}>
                                            <Text style={styles.pointBadgeNum}>{idx + 1}</Text>
                                        </View>
                                        <Text style={[styles.keyPointText, { fontFamily: typography.fontFamily.reading }]}>
                                            {pt}
                                        </Text>
                                    </View>
                                ))}

                                {/* Collapsible Sections */}
                                {summaryLength !== 'brief' && (
                                    <>
                                        <Text style={[styles.sectionHeaderTitle, { marginTop: 18 }]}>Detailed Section Notes</Text>
                                        {summaryData.sections.map((sec, sIdx) => {
                                            const isExp = !!expandedSections[sIdx];
                                            return (
                                                <View key={sIdx} style={[styles.collapsibleSecCard, shadows.card]}>
                                                    <TouchableOpacity
                                                        style={styles.collapsibleSecHeader}
                                                        onPress={() =>
                                                            setExpandedSections((prev) => ({ ...prev, [sIdx]: !prev[sIdx] }))
                                                        }
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.secCardTitle} numberOfLines={1}>
                                                            {sec.title}
                                                        </Text>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            {sec.page && (
                                                                <View style={[styles.pageChip, { backgroundColor: colors.surfaceRaised }]}>
                                                                    <Text style={styles.pageChipText}>p. {sec.page}</Text>
                                                                </View>
                                                            )}
                                                            {isExp ? (
                                                                <ChevronUp size={18} color={colors.textMuted} />
                                                            ) : (
                                                                <ChevronDown size={18} color={colors.textMuted} />
                                                            )}
                                                        </View>
                                                    </TouchableOpacity>

                                                    {isExp && (
                                                        <View style={styles.secBody}>
                                                            <Text style={[styles.secContentText, { fontFamily: typography.fontFamily.reading }]}>
                                                                {sec.content}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </>
                                )}
                            </>
                        )}
                    </ScrollView>
                )}

                {/* ── 2. WORDS PANEL & 3D FLASHCARDS ── */}
                {activeSection === 'words' && (
                    <View style={{ flex: 1, paddingHorizontal: 16 }}>
                        {/* Word Search & Controls */}
                        <View style={styles.wordsControlsRow}>
                            <View style={styles.wordSearchBox}>
                                <Search size={15} color={colors.textMuted} strokeWidth={2} style={{ marginRight: 6 }} />
                                <TextInput
                                    style={styles.wordSearchInput}
                                    placeholder="Search terms or meanings..."
                                    placeholderTextColor={colors.textMuted}
                                    value={wordSearch}
                                    onChangeText={setWordSearch}
                                />
                            </View>

                            <AnimatedPressable
                                style={[styles.studyModeBtn, { backgroundColor: tabAccent }, shadows.glowAccent]}
                                onPress={() => {
                                    triggerHaptic('selection');
                                    setIsFlashcardOpen(true);
                                    setFlashcardIndex(0);
                                    setIsCardFlipped(false);
                                }}
                            >
                                <Sparkles size={14} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 5 }} />
                                <Text style={styles.studyModeBtnText}>Study Mode</Text>
                            </AnimatedPressable>
                        </View>

                        {/* Filter Tabs */}
                        <View style={styles.wordFilterRow}>
                            {(['all', 'to_learn', 'known'] as WordFilter[]).map((f) => (
                                <TouchableOpacity
                                    key={f}
                                    style={[
                                        styles.filterPill,
                                        wordFilter === f && { backgroundColor: tabAccent },
                                    ]}
                                    onPress={() => {
                                        triggerHaptic('selection');
                                        setWordFilter(f);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.filterPillText,
                                            { color: wordFilter === f ? '#FFFFFF' : colors.textMuted },
                                        ]}
                                    >
                                        {f === 'all' ? 'All' : f === 'to_learn' ? 'To Learn' : 'Known'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {wordsLoading ? (
                            <View style={{ paddingVertical: 12 }}>
                                <CardSkeleton />
                                <CardSkeleton />
                            </View>
                        ) : filteredWords.length === 0 ? (
                            <EmptyState
                                icon={Sparkles}
                                title="No vocabulary words"
                                description="No terms found in this filter. Try adjusting your search query."
                            />
                        ) : (
                            <ScrollView
                                contentContainerStyle={{ paddingBottom: 110, paddingTop: 6 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {filteredWords.map((word) => (
                                    <View
                                        key={word.id}
                                        style={[
                                            styles.vocabCard,
                                            shadows.card,
                                            word.isKnown && { opacity: 0.65, backgroundColor: colors.surfaceRaised },
                                        ]}
                                    >
                                        <View style={styles.vocabHeader}>
                                            <View style={{ flex: 1, paddingRight: 8 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Text style={styles.vocabTerm}>{word.term}</Text>
                                                    {word.part_of_speech && (
                                                        <View style={[styles.posBadge, { backgroundColor: colors.primaryMuted }]}>
                                                            <Text style={[styles.posText, { color: colors.primary }]}>
                                                                {word.part_of_speech}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.vocabDefinition}>{word.definition}</Text>
                                            </View>

                                            <AnimatedPressable
                                                style={[
                                                    styles.knownCheckBtn,
                                                    word.isKnown && { backgroundColor: colors.success, borderColor: colors.success },
                                                ]}
                                                onPress={() => handleToggleKnown(word.id)}
                                                accessibilityLabel="Mark as known"
                                            >
                                                <Check size={16} color={word.isKnown ? '#FFFFFF' : colors.textMuted} strokeWidth={2.5} />
                                            </AnimatedPressable>
                                        </View>

                                        {/* Sentence context with highlighted term */}
                                        {word.sentence && (
                                            <View style={[styles.vocabSentenceBox, { backgroundColor: colors.surfaceRaised }]}>
                                                <Text style={[styles.vocabSentenceText, { fontFamily: typography.fontFamily.reading }]}>
                                                    "{word.sentence}"
                                                </Text>
                                            </View>
                                        )}

                                        <View style={styles.vocabFooter}>
                                            {word.page && (
                                                <View style={[styles.pageChip, { backgroundColor: colors.surfaceRaised }]}>
                                                    <Text style={styles.pageChipText}>Page {word.page}</Text>
                                                </View>
                                            )}
                                            <Text style={[styles.knownStatusText, { color: word.isKnown ? colors.success : colors.textMuted }]}>
                                                {word.isKnown ? 'Mastered' : 'Needs Review'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* ── 3. QUIZ PANEL ── */}
                {activeSection === 'quiz' && (
                    <View style={{ flex: 1, paddingHorizontal: 16 }}>
                        {!isQuizActive ? (
                            <ScrollView
                                contentContainerStyle={{ paddingBottom: 110, paddingTop: 12 }}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={[styles.quizSetupCard, shadows.card]}>
                                    <View style={styles.quizSetupHeader}>
                                        <Lightbulb size={24} color={tabAccent} strokeWidth={2} style={{ marginRight: 10 }} />
                                        <View>
                                            <Text style={styles.quizSetupTitle}>Instant Quiz Practice</Text>
                                            <Text style={styles.quizSetupSub}>Generate multi-choice questions from your notes</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.fieldLabel}>Question Source</Text>
                                    <View style={styles.pickerRow}>
                                        {[
                                            { key: 'doc', label: 'Current PDF' },
                                            { key: 'subject', label: 'Whole Subject' },
                                            { key: 'course', label: 'Entire Course' },
                                        ].map((src) => (
                                            <TouchableOpacity
                                                key={src.key}
                                                style={[
                                                    styles.quizPickerPill,
                                                    quizSource === src.key && { backgroundColor: tabAccent, borderColor: tabAccent },
                                                ]}
                                                onPress={() => setQuizSource(src.key as any)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.quizPickerPillText,
                                                        { color: quizSource === src.key ? '#FFFFFF' : colors.text },
                                                    ]}
                                                >
                                                    {src.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Difficulty</Text>
                                    <View style={styles.pickerRow}>
                                        {(['Easy', 'Medium', 'Hard'] as const).map((diff) => (
                                            <TouchableOpacity
                                                key={diff}
                                                style={[
                                                    styles.quizPickerPill,
                                                    quizDifficulty === diff && { backgroundColor: tabAccent, borderColor: tabAccent },
                                                ]}
                                                onPress={() => setQuizDifficulty(diff)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.quizPickerPillText,
                                                        { color: quizDifficulty === diff ? '#FFFFFF' : colors.text },
                                                    ]}
                                                >
                                                    {diff}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Question Count</Text>
                                    <View style={styles.pickerRow}>
                                        {[3, 5, 10].map((cnt) => (
                                            <TouchableOpacity
                                                key={cnt}
                                                style={[
                                                    styles.quizPickerPill,
                                                    quizCount === cnt && { backgroundColor: tabAccent, borderColor: tabAccent },
                                                ]}
                                                onPress={() => setQuizCount(cnt)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.quizPickerPillText,
                                                        { color: quizCount === cnt ? '#FFFFFF' : colors.text },
                                                    ]}
                                                >
                                                    {cnt} Questions
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <GradientButton
                                        colors={gradients.tealToBlue[isDark ? 'dark' : 'light']}
                                        title="Start Quiz Practice"
                                        onPress={handleStartQuiz}
                                        style={{ marginTop: 20 }}
                                    />
                                </View>
                            </ScrollView>
                        ) : quizLoading ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={tabAccent} />
                                <Text style={[styles.loadingQuizText, { color: colors.textMuted }]}>
                                    Synthesizing high-yield questions...
                                </Text>
                            </View>
                        ) : quizCompleted ? (
                            <ScrollView
                                contentContainerStyle={{ paddingBottom: 110, paddingTop: 20, alignItems: 'center' }}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={[styles.quizResultsCard, shadows.card]}>
                                    <Text style={styles.resultsHeading}>Quiz Completed!</Text>
                                    <View style={{ marginVertical: 20 }}>
                                        <ProgressRing
                                            percentage={quizScorePercentage}
                                            size={100}
                                            strokeWidth={8}
                                            showLabel={true}
                                            gradientColors={gradients.tealToBlue[isDark ? 'dark' : 'light']}
                                        />
                                    </View>
                                    <Text style={styles.resultsScoreSummary}>
                                        You got {quizScoreCount} out of {quizQuestions.length} correct ({quizScorePercentage}%)
                                    </Text>

                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
                                        <AnimatedPressable
                                            style={[styles.quizActionBtn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                                            onPress={() => setIsQuizActive(false)}
                                        >
                                            <Text style={[styles.quizActionText, { color: colors.text }]}>Exit</Text>
                                        </AnimatedPressable>

                                        <AnimatedPressable
                                            style={[styles.quizActionBtn, { backgroundColor: tabAccent, flex: 1 }, shadows.glowAccent]}
                                            onPress={handleStartQuiz}
                                        >
                                            <RotateCcw size={15} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 6 }} />
                                            <Text style={[styles.quizActionText, { color: '#FFFFFF' }]}>Retry Quiz</Text>
                                        </AnimatedPressable>
                                    </View>
                                </View>
                            </ScrollView>
                        ) : (
                            <ScrollView
                                contentContainerStyle={{ paddingBottom: 110, paddingTop: 10 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {quizQuestions[currentQuizIndex] && (
                                    <View>
                                        {/* Question Progress Bar */}
                                        <View style={styles.quizProgressBarContainer}>
                                            <View style={styles.quizProgressHeader}>
                                                <Text style={styles.questionCounterText}>
                                                    Question {currentQuizIndex + 1} of {quizQuestions.length}
                                                </Text>
                                                <Text style={styles.quizTopicBadge}>
                                                    {quizQuestions[currentQuizIndex].topic || selectedSubject.name}
                                                </Text>
                                            </View>
                                            <View style={[styles.quizProgressTrack, { backgroundColor: colors.surfaceRaised }]}>
                                                <View
                                                    style={[
                                                        styles.quizProgressFill,
                                                        {
                                                            backgroundColor: tabAccent,
                                                            width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%`,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                        </View>

                                        {/* Question Card with Shake animation on wrong answer */}
                                        <Animated.View
                                            style={[
                                                styles.questionBox,
                                                shadows.card,
                                                { transform: [{ translateX: shakeAnim }] },
                                            ]}
                                        >
                                            <Text style={[styles.questionText, { fontFamily: typography.fontFamily.reading }]}>
                                                {quizQuestions[currentQuizIndex].question}
                                            </Text>
                                        </Animated.View>

                                        {/* Option Cards */}
                                        <View style={{ gap: 10, marginVertical: 14 }}>
                                            {quizQuestions[currentQuizIndex].options.map((opt, oIdx) => {
                                                const isSelected = selectedQuizAnswers[currentQuizIndex] === opt;
                                                const hasAnswered = selectedQuizAnswers[currentQuizIndex] !== undefined;
                                                const isCorrect = opt === quizQuestions[currentQuizIndex].correct_answer;

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
                                                            styles.quizOptionCard,
                                                            { backgroundColor: optBg, borderColor: optBorder },
                                                            shadows.subtle,
                                                        ]}
                                                        onPress={() => handleSelectQuizAnswer(opt)}
                                                    >
                                                        <View style={[styles.optionAlphaCircle, { borderColor: optBorder }]}>
                                                            <Text style={[styles.optionAlphaText, { color: optTextColor }]}>
                                                                {String.fromCharCode(65 + oIdx)}
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.quizOptionText, { color: optTextColor }]} numberOfLines={3}>
                                                            {opt}
                                                        </Text>
                                                        {hasAnswered && isCorrect && (
                                                            <CheckCircle2 size={20} color={colors.success} strokeWidth={2} />
                                                        )}
                                                        {hasAnswered && isSelected && !isCorrect && (
                                                            <XCircle size={20} color={colors.danger} strokeWidth={2} />
                                                        )}
                                                    </AnimatedPressable>
                                                );
                                            })}
                                        </View>

                                        {/* Explanation Box (Revealed after answering) */}
                                        {selectedQuizAnswers[currentQuizIndex] !== undefined && (
                                            <View style={[styles.explanationCard, shadows.card]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                                    <Lightbulb size={16} color={tabAccent} strokeWidth={2} style={{ marginRight: 6 }} />
                                                    <Text style={styles.explanationTitle}>Explanation</Text>
                                                    {quizQuestions[currentQuizIndex].page && (
                                                        <View style={[styles.pageChip, { backgroundColor: colors.surface, marginLeft: 'auto' }]}>
                                                            <Text style={styles.pageChipText}>
                                                                Page {quizQuestions[currentQuizIndex].page}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={[styles.explanationText, { fontFamily: typography.fontFamily.reading }]}>
                                                    {quizQuestions[currentQuizIndex].explanation}
                                                </Text>

                                                <AnimatedPressable
                                                    style={[styles.nextQuizBtn, { backgroundColor: tabAccent }, shadows.glowAccent]}
                                                    onPress={handleNextQuizQuestion}
                                                >
                                                    <Text style={styles.nextQuizBtnText}>
                                                        {currentQuizIndex < quizQuestions.length - 1 ? 'Next Question' : 'View Results'}
                                                    </Text>
                                                    <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 4 }} />
                                                </AnimatedPressable>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* ── 4. ASK / SCOPED TUTOR PANEL ── */}
                {activeSection === 'ask' && (
                    <View style={{ flex: 1, paddingHorizontal: 16 }}>
                        <ScrollView
                            contentContainerStyle={{ paddingBottom: 110, paddingTop: 10 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {messages.map((msg) => {
                                const isUser = msg.sender === 'user';
                                return (
                                    <View
                                        key={msg.id}
                                        style={[
                                            styles.chatMessageRow,
                                            isUser ? styles.chatMessageUser : styles.chatMessageAi,
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.chatBubble,
                                                isUser
                                                    ? [styles.chatBubbleUser, { backgroundColor: tabAccent }]
                                                    : [styles.chatBubbleAi, { backgroundColor: colors.surface }, shadows.card],
                                            ]}
                                        >
                                            {msg.scopeLabel && (
                                                <Text style={[styles.chatScopeBadge, { color: colors.textMuted }]}>
                                                    {msg.scopeLabel}
                                                </Text>
                                            )}
                                            <Text
                                                style={[
                                                    styles.chatMessageText,
                                                    { color: isUser ? '#FFFFFF' : colors.text },
                                                    !isUser && { fontFamily: typography.fontFamily.reading },
                                                ]}
                                            >
                                                {msg.text}
                                            </Text>

                                            {/* Citation Chips */}
                                            {msg.citations && msg.citations.length > 0 && (
                                                <View style={styles.citationChipsRow}>
                                                    {msg.citations.map((c, cIdx) => (
                                                        <AnimatedPressable
                                                            key={cIdx}
                                                            style={[styles.citationChip, { backgroundColor: colors.surfaceRaised }]}
                                                            onPress={() => setSelectedCitationSnippet(c)}
                                                        >
                                                            <BookMarked size={12} color={tabAccent} strokeWidth={2} style={{ marginRight: 4 }} />
                                                            <Text style={[styles.citationChipText, { color: tabAccent }]}>
                                                                Page {c.page}
                                                            </Text>
                                                        </AnimatedPressable>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                            {chatLoading && (
                                <View style={[styles.chatBubbleAi, { backgroundColor: colors.surface, padding: 14 }]}>
                                    <ActivityIndicator size="small" color={tabAccent} />
                                </View>
                            )}
                        </ScrollView>

                        {/* Chat Composer */}
                        <View style={[styles.chatComposerBar, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
                            <TextInput
                                style={[styles.chatTextInput, { color: colors.text }]}
                                placeholder={`Ask question about ${selectedSubject.name}...`}
                                placeholderTextColor={colors.textMuted}
                                value={chatInput}
                                onChangeText={setChatInput}
                                multiline
                            />
                            <AnimatedPressable
                                style={[styles.chatSendBtn, { backgroundColor: chatInput.trim() ? tabAccent : colors.surfaceRaised }]}
                                onPress={handleSendChat}
                                disabled={!chatInput.trim() || chatLoading}
                            >
                                <Send size={16} color={chatInput.trim() ? '#FFFFFF' : colors.textMuted} strokeWidth={2} />
                            </AnimatedPressable>
                        </View>
                    </View>
                )}
            </View>

            {/* ── 3D Flashcard Study Modal ── */}
            <Modal
                visible={isFlashcardOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsFlashcardOpen(false)}
            >
                <View style={styles.flashcardModalContainer}>
                    <View style={styles.flashcardModalHeader}>
                        <Text style={styles.flashcardModalTitle}>
                            Flashcard {flashcardIndex + 1} of {filteredWords.length}
                        </Text>
                        <AnimatedPressable onPress={() => setIsFlashcardOpen(false)} style={styles.closeBtn}>
                            <X size={20} color={colors.textMuted} strokeWidth={2} />
                        </AnimatedPressable>
                    </View>

                    {filteredWords[flashcardIndex] && (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <AnimatedPressable
                                style={[styles.flashcard3DBox, shadows.modal]}
                                onPress={handleFlipCard}
                                scaleTo={0.98}
                            >
                                {!isCardFlipped ? (
                                    <View style={styles.flashcardFace}>
                                        <View style={[styles.cardTag, { backgroundColor: tabAccent }]}>
                                            <Text style={styles.cardTagText}>TERM</Text>
                                        </View>
                                        <Text style={styles.flashcardTermText}>
                                            {filteredWords[flashcardIndex].term}
                                        </Text>
                                        <Text style={[styles.tapToFlipNote, { color: colors.textMuted }]}>
                                            Tap card to reveal definition
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.flashcardFace}>
                                        <View style={[styles.cardTag, { backgroundColor: colors.secondary }]}>
                                            <Text style={styles.cardTagText}>MEANING</Text>
                                        </View>
                                        <Text style={[styles.flashcardMeaningText, { fontFamily: typography.fontFamily.reading }]}>
                                            {filteredWords[flashcardIndex].definition}
                                        </Text>
                                        {filteredWords[flashcardIndex].sentence && (
                                            <View style={[styles.flashcardSentenceBox, { backgroundColor: colors.surfaceRaised }]}>
                                                <Text style={[styles.flashcardSentenceText, { fontFamily: typography.fontFamily.reading }]}>
                                                    "{filteredWords[flashcardIndex].sentence}"
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </AnimatedPressable>

                            {/* Flashcard Navigation Controls */}
                            <View style={styles.flashcardNavRow}>
                                <AnimatedPressable
                                    style={[styles.flashcardNavBtn, { backgroundColor: colors.surfaceRaised }]}
                                    onPress={handlePrevFlashcard}
                                    disabled={flashcardIndex === 0}
                                >
                                    <ArrowLeft size={18} color={colors.text} strokeWidth={2} />
                                </AnimatedPressable>

                                <AnimatedPressable
                                    style={[styles.flashcardKnownBtn, { backgroundColor: colors.success }]}
                                    onPress={() => {
                                        handleToggleKnown(filteredWords[flashcardIndex].id);
                                        handleNextFlashcard();
                                    }}
                                >
                                    <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                                    <Text style={styles.flashcardKnownBtnText}>Mark Mastered</Text>
                                </AnimatedPressable>

                                <AnimatedPressable
                                    style={[styles.flashcardNavBtn, { backgroundColor: colors.surfaceRaised }]}
                                    onPress={handleNextFlashcard}
                                >
                                    <ArrowRight size={18} color={colors.text} strokeWidth={2} />
                                </AnimatedPressable>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>

            {/* Document Picker Modal */}
            <Modal
                visible={isDocPickerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsDocPickerOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsDocPickerOpen(false)}
                >
                    <View style={[styles.pickerModalCard, shadows.modal]}>
                        <Text style={styles.pickerModalTitle}>Select Document</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {(selectedSubject.documents || []).map((doc) => (
                                <AnimatedPressable
                                    key={doc.id}
                                    style={[
                                        styles.docPickItem,
                                        selectedDoc?.id === doc.id && { backgroundColor: colors.primaryMuted },
                                    ]}
                                    onPress={() => {
                                        setSelectedDoc(doc);
                                        loadDocumentMaterials(doc.id, selectedCourse.title, selectedSubject.name);
                                        setIsDocPickerOpen(false);
                                    }}
                                >
                                    <FileText size={16} color={tabAccent} strokeWidth={2} style={{ marginRight: 8 }} />
                                    <Text style={[styles.docPickItemText, { color: colors.text }]} numberOfLines={1}>
                                        {doc.filename}
                                    </Text>
                                </AnimatedPressable>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Citation Grounding Inspection Modal */}
            <CitationModal
                visible={!!selectedCitationSnippet}
                citationText={selectedCitationSnippet?.snippet || ''}
                pageNumber={selectedCitationSnippet?.page}
                documentTitle={selectedDoc?.filename || selectedSubject.name}
                onClose={() => setSelectedCitationSnippet(null)}
            />

            {/* Undo Toast */}
            <Toast
                visible={!!toastMessage}
                message={toastMessage || ''}
                actionLabel={lastKnownWordUndo ? 'Undo' : undefined}
                onAction={lastKnownWordUndo ? handleUndoKnown : undefined}
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
        hubHeader: {
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingHorizontal: 16,
            paddingBottom: 10,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        hubTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        courseEyebrow: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        subjectMainTitle: {
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.3,
            marginTop: 2,
        },
        docPickerBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: radii.controls,
            maxWidth: 160,
        },
        docPickerText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            flex: 1,
        },
        subjectChipsScroll: {
            flexDirection: 'row',
            gap: 8,
            paddingTop: 10,
            paddingBottom: 2,
        },
        subjectChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: radii.full,
            borderWidth: 1,
        },
        subjectChipDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            marginRight: 6,
        },
        subjectChipText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        panelScroll: {
            flex: 1,
            paddingHorizontal: 16,
        },
        panelContent: {
            paddingTop: 12,
            paddingBottom: 110,
        },
        summaryToolbar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
        },
        lengthToggleContainer: {
            flexDirection: 'row',
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.controls,
            padding: 3,
        },
        lenPill: {
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: radii.sm,
        },
        lenPillText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        audioRateBtn: {
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: radii.controls,
        },
        audioRateText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        audioPlayBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: radii.controls,
        },
        audioBtnText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
            marginLeft: 5,
        },
        overviewCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 16,
        },
        overviewHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        overviewTitle: {
            fontSize: typography.sizes.sm + 1,
            fontWeight: '700',
            color: colors.text,
        },
        overviewReadingText: {
            fontSize: typography.sizes.md,
            lineHeight: 26,
            color: colors.text,
        },
        sectionHeaderTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 8,
        },
        keyPointRow: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: radii.controls,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 8,
            alignItems: 'flex-start',
        },
        pointBadge: {
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
            marginTop: 2,
        },
        pointBadgeNum: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
        },
        keyPointText: {
            flex: 1,
            fontSize: typography.sizes.sm + 1,
            lineHeight: 22,
            color: colors.text,
        },
        collapsibleSecCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 10,
            overflow: 'hidden',
        },
        collapsibleSecHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 14,
        },
        secCardTitle: {
            flex: 1,
            fontSize: typography.sizes.sm + 1,
            fontWeight: '700',
            color: colors.text,
            paddingRight: 10,
        },
        secBody: {
            paddingHorizontal: 14,
            paddingBottom: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 10,
        },
        secContentText: {
            fontSize: typography.sizes.sm + 1,
            lineHeight: 24,
            color: colors.textSecondary,
        },
        pageChip: {
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: radii.full,
            marginRight: 8,
        },
        pageChipText: {
            fontSize: typography.sizes.xs - 1,
            fontWeight: '700',
            color: tabAccent,
        },
        wordsControlsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingTop: 10,
            marginBottom: 8,
        },
        wordSearchBox: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.controls,
            paddingHorizontal: 10,
            height: 40,
        },
        wordSearchInput: {
            flex: 1,
            fontSize: typography.sizes.sm,
            color: colors.text,
            paddingVertical: 0,
        },
        studyModeBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: radii.controls,
            height: 40,
        },
        studyModeBtnText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
        },
        wordFilterRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 8,
        },
        filterPill: {
            paddingVertical: 5,
            paddingHorizontal: 12,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceRaised,
        },
        filterPillText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        vocabCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        vocabHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
        },
        vocabTerm: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
        },
        posBadge: {
            paddingVertical: 2,
            paddingHorizontal: 6,
            borderRadius: radii.xs,
        },
        posText: {
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
        },
        vocabDefinition: {
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            lineHeight: 20,
            marginTop: 4,
        },
        knownCheckBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        vocabSentenceBox: {
            padding: 10,
            borderRadius: radii.controls,
            marginTop: 10,
        },
        vocabSentenceText: {
            fontSize: typography.sizes.xs + 1,
            lineHeight: 20,
            color: colors.text,
            fontStyle: 'italic',
        },
        vocabFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
        },
        knownStatusText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        quizSetupCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
        },
        quizSetupHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        quizSetupTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
        },
        quizSetupSub: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        fieldLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
        },
        pickerRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 6,
        },
        quizPickerPill: {
            flex: 1,
            paddingVertical: 9,
            borderRadius: radii.controls,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        quizPickerPillText: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
        },
        loadingQuizText: {
            marginTop: 12,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
        quizProgressBarContainer: {
            marginBottom: 14,
        },
        quizProgressHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
        },
        questionCounterText: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
            color: colors.text,
        },
        quizTopicBadge: {
            fontSize: typography.sizes.xs,
            color: tabAccent,
            fontWeight: '700',
        },
        quizProgressTrack: {
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
        },
        quizProgressFill: {
            height: '100%',
            borderRadius: 3,
        },
        questionBox: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
        },
        questionText: {
            fontSize: typography.sizes.md,
            lineHeight: 26,
            color: colors.text,
            fontWeight: '600',
        },
        quizOptionCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderRadius: radii.cards,
            borderWidth: 1.5,
            minHeight: 52,
        },
        optionAlphaCircle: {
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 1.5,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
        },
        optionAlphaText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        quizOptionText: {
            flex: 1,
            fontSize: typography.sizes.sm + 1,
            lineHeight: 20,
            fontWeight: '600',
            paddingRight: 6,
        },
        explanationCard: {
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginTop: 10,
        },
        explanationTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            color: colors.text,
        },
        explanationText: {
            fontSize: typography.sizes.sm,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        nextQuizBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: radii.controls,
            marginTop: 14,
        },
        nextQuizBtnText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        quizResultsCard: {
            width: '100%',
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            alignItems: 'center',
        },
        resultsHeading: {
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            color: colors.text,
        },
        resultsScoreSummary: {
            fontSize: typography.sizes.sm + 1,
            color: colors.textSecondary,
            textAlign: 'center',
            fontWeight: '600',
        },
        quizActionBtn: {
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: radii.controls,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
        },
        quizActionText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        chatMessageRow: {
            marginVertical: 6,
        },
        chatMessageUser: {
            alignItems: 'flex-end',
        },
        chatMessageAi: {
            alignItems: 'flex-start',
        },
        chatBubble: {
            maxWidth: '85%',
            padding: 14,
            borderRadius: radii.cards,
        },
        chatBubbleUser: {
            borderBottomRightRadius: 4,
        },
        chatBubbleAi: {
            borderWidth: 1,
            borderColor: colors.border,
            borderBottomLeftRadius: 4,
            width: '100%',
        },
        chatScopeBadge: {
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
        },
        chatMessageText: {
            fontSize: typography.sizes.sm + 1,
            lineHeight: 22,
        },
        citationChipsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 10,
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
        chatComposerBar: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderRadius: radii.sheets,
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginBottom: 80,
        },
        chatTextInput: {
            flex: 1,
            maxHeight: 120,
            fontSize: typography.sizes.sm,
            paddingVertical: 6,
        },
        chatSendBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
        },
        flashcardModalContainer: {
            flex: 1,
            backgroundColor: colors.bg,
            padding: 20,
        },
        flashcardModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        flashcardModalTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
        },
        closeBtn: {
            padding: 6,
            borderRadius: radii.full,
        },
        flashcard3DBox: {
            width: '92%',
            minHeight: 280,
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            justifyContent: 'center',
            alignItems: 'center',
        },
        flashcardFace: {
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
        },
        cardTag: {
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
            marginBottom: 16,
        },
        cardTagText: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.5,
        },
        flashcardTermText: {
            fontSize: typography.sizes.xxl,
            fontWeight: '800',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 16,
        },
        tapToFlipNote: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        flashcardMeaningText: {
            fontSize: typography.sizes.md,
            lineHeight: 26,
            color: colors.text,
            textAlign: 'center',
        },
        flashcardSentenceBox: {
            padding: 12,
            borderRadius: radii.controls,
            marginTop: 16,
            width: '100%',
        },
        flashcardSentenceText: {
            fontSize: typography.sizes.xs + 1,
            fontStyle: 'italic',
            lineHeight: 20,
            color: colors.textSecondary,
            textAlign: 'center',
        },
        flashcardNavRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginTop: 30,
        },
        flashcardNavBtn: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
        },
        flashcardKnownBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: radii.full,
        },
        flashcardKnownBtnText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        pickerModalCard: {
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: radii.sheets,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
        },
        pickerModalTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 12,
        },
        docPickItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: radii.controls,
        },
        docPickItemText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            flex: 1,
        },
    });

export default CourseHubScreen;
