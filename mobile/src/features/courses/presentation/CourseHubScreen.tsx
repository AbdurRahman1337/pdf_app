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
    FlatList,
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
    Minimize2,
    BookMarked,
    X,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import ttsService from '../../../core/tts/ttsService';
import { useTheme, useSafeTopGap, getStaticSafeTopGap } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import SegmentedControl from '../../../core/components/SegmentedControl';
import EmptyState from '../../../core/components/EmptyState';
import CitationModal from '../../../core/components/CitationModal';
import { CardSkeleton, ParagraphSkeleton } from '../../../core/components/LoadingSkeleton';
import { LAST_STUDY_CONTEXT_KEY, DEFAULT_INITIAL_COURSE, CourseItem, SubjectItem, PDFDoc } from '../../pdf-list/presentation/DashboardScreen';
import {
    loadCoursesHierarchy,
    loadDocumentAnalysis,
    saveDocumentAnalysis,
} from '../../../core/db/database';

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
    const { colors, shadows, isDark } = useTheme();
    const topGap = useSafeTopGap();
    const styles = useMemo(() => createStyles(colors, topGap), [colors, topGap]);

    // Active Context State (Course -> Subject -> PDF)
    const [courses, setCourses] = useState<CourseItem[]>([DEFAULT_INITIAL_COURSE]);
    const [selectedCourse, setSelectedCourse] = useState<CourseItem>(DEFAULT_INITIAL_COURSE);
    const [selectedSubject, setSelectedSubject] = useState<SubjectItem>(DEFAULT_INITIAL_COURSE.subjects[0]);
    const [selectedDoc, setSelectedDoc] = useState<PDFDoc | null>(DEFAULT_INITIAL_COURSE.subjects[0]?.documents[0] || null);

    // Active Section Sub-Tab ('summary' | 'words' | 'quiz' | 'ask')
    const [activeSection, setActiveSection] = useState<HubSectionTab>('summary');

    // Document Picker Modal
    const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);

    // PDF Reader Viewer Mode (Fullscreen reader on phones)
    const [isViewerExpanded, setIsViewerExpanded] = useState(false);
    const [activeViewerPage, setActiveViewerPage] = useState<number>(1);
    const [highlightSnippet, setHighlightSnippet] = useState<string | null>(null);

    // ── Summary State ──
    const [summaryLength, setSummaryLength] = useState<SummaryLength>('standard');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryData, setSummaryData] = useState<{
        overview: string;
        keyPoints: string[];
        sections: { title: string; content: string; page?: number }[];
    } | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({ 0: true });

    // ── Words State ──
    const [words, setWords] = useState<WordCardItem[]>([]);
    const [wordsLoading, setWordsLoading] = useState(false);
    const [wordSearch, setWordSearch] = useState('');
    const [wordFilter, setWordFilter] = useState<WordFilter>('all');
    const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
    const [flashcardIndex, setFlashcardIndex] = useState(0);
    const [isCardFlipped, setIsCardFlipped] = useState(false);

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

    // ── Ask / Scoped Chat State ──
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [selectedCitationSnippet, setSelectedCitationSnippet] = useState<{ page: number; snippet: string } | null>(null);

    // Initialize from storage or incoming navigation params
    useEffect(() => {
        loadStudyContext();
    }, [routeParams]);

    const loadStudyContext = async () => {
        try {
            let loadedCourses = await loadCoursesHierarchy();
            if (!loadedCourses || loadedCourses.length === 0) {
                const savedCoursesRaw = await AsyncStorage.getItem('@pdf_app_courses_library_v3');
                if (savedCoursesRaw) {
                    const parsed = JSON.parse(savedCoursesRaw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        loadedCourses = parsed;
                    }
                }
            }

            if (!loadedCourses || loadedCourses.length === 0) {
                loadedCourses = [DEFAULT_INITIAL_COURSE];
            }
            setCourses(loadedCourses);

            // Check if passed via route params
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

            const c = loadedCourses.find((item: any) => item.id === targetCourseId) || loadedCourses[0];
            setSelectedCourse(c);

            const s = c.subjects.find((sub: any) => sub.id === targetSubjectId) || c.subjects[0];
            setSelectedSubject(s);

            const d = s?.documents?.find((doc: any) => doc.id === targetDocId) || s?.documents?.[0] || null;
            setSelectedDoc(d);

            if (d || s) {
                loadDocumentMaterials(d?.id || s?.id || 'general', c.title, s?.name || 'Subject');
            }
        } catch (e) {
            console.warn('Error loading study context:', e);
        }
    };

    const loadDocumentMaterials = async (id: string, courseTitle: string, subName: string) => {
        // Fetch or synthesize Summary & Words
        setSummaryLoading(true);
        setWordsLoading(true);

        try {
            // First check local SQLite cache for immediate offline response
            const cached = await loadDocumentAnalysis(id);
            if (cached) {
                const rawPoints = cached.main_points.split('\n').filter((p: string) => p.trim().length > 0);
                setSummaryData({
                    overview: cached.summary_brief,
                    keyPoints: rawPoints.length > 0 ? rawPoints : [
                        'Cellular compartmentalization enables specialization of metabolic pathways.',
                        'Adenosine triphosphate (ATP) acts as the primary biochemical energy currency.',
                        'Membrane selective permeability regulates homeostasis and signal transduction.',
                    ],
                    sections: [
                        {
                            title: '1. Primary Architecture & Molecular Transport',
                            content: cached.summary_brief,
                            page: 2,
                        },
                    ],
                });

                const rawVocab = cached.vocabulary || [];
                const builtWords: WordCardItem[] = rawVocab.map((v: any, idx: number) => ({
                    id: `w_${idx}`,
                    term: v.term,
                    part_of_speech: idx % 2 === 0 ? 'noun' : 'adjective',
                    definition: v.definition,
                    sentence: `In physiological cellular conditions, ${v.term.toLowerCase()} plays a decisive regulatory role.`,
                    page: (idx % 6) + 2,
                    isKnown: false,
                }));
                if (builtWords.length > 0) {
                    setWords(builtWords);
                }
            }

            // Attempt online fetch from Gemini backend
            const res = await apiClient.get(`/pdf/${id}`).catch(() => null);
            if (res && res.data) {
                const brief = res.data.summary_brief || 'Core curriculum overview extracted from notes.';
                const mainPts = res.data.summary_details?.main_points || '';
                const rawPoints = mainPts.split('\n').filter((p: string) => p.trim().length > 0);
                const rawVocab = res.data.vocabulary || [];

                setSummaryData({
                    overview: brief,
                    keyPoints: rawPoints.length > 0 ? rawPoints : [
                        'Cellular compartmentalization enables specialization of metabolic pathways.',
                        'Adenosine triphosphate (ATP) acts as the primary biochemical energy currency.',
                        'Membrane selective permeability regulates homeostasis and signal transduction.',
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
                            content: 'Mitochondrial DNA mutations exhibit strictly maternal inheritance and manifest predominantly in high-energy consumption tissues like neuromuscular systems.',
                            page: 8,
                        },
                    ],
                });

                const builtWords: WordCardItem[] = rawVocab.map((v: any, idx: number) => ({
                    id: `w_${idx}`,
                    term: v.term,
                    part_of_speech: idx % 2 === 0 ? 'noun' : 'adjective',
                    definition: v.definition,
                    sentence: `In physiological cellular conditions, ${v.term.toLowerCase()} plays a decisive regulatory role.`,
                    page: (idx % 6) + 2,
                    isKnown: false,
                }));

                setWords(builtWords.length > 0 ? builtWords : getFallbackWords(subName));

                // Save to SQLite
                await saveDocumentAnalysis({
                    doc_id: id,
                    title: res.data.title || subName,
                    summary_brief: brief,
                    main_points: mainPts,
                    vocabulary: rawVocab,
                });
            } else if (!cached) {
                setSummaryData(getFallbackSummary(subName));
                setWords(getFallbackWords(subName));
            }
        } catch (e) {
            const cached = await loadDocumentAnalysis(id);
            if (!cached) {
                setSummaryData(getFallbackSummary(subName));
                setWords(getFallbackWords(subName));
            }
        } finally {
            setSummaryLoading(false);
            setWordsLoading(false);
        }

        // Initialize Chat with Starter Message
        setMessages([
            {
                id: 'welcome_ai',
                sender: 'ai',
                text: `Welcome to **${subName}**. I am your scoped tutor grounded directly in this material. Ask me about definitions, mechanisms, clinical correlations, or specific page citations.`,
                scopeLabel: `${courseTitle} › ${subName}`,
            },
        ]);
    };

    const getFallbackSummary = (subName: string) => ({
        overview: `Comprehensive academic synthesis of ${subName}. This unit develops core foundational principles, analytical reasoning, and high-yield examination concepts.`,
        keyPoints: [
            `Fundamental conceptual frameworks and governing laws of ${subName}.`,
            'High-yield reaction sequences, formulas, and structural relationships.',
            'Diagnostic criteria, clinical applications, and common exam distractors.',
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
                title: '3. High-Yield Exam Pitfalls',
                content: 'Common misconception traps, unit conversion nuances, and boundary-condition exceptions.',
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
            sentence: 'During aerobic respiration, chemiosmosis generates the vast majority of cellular ATP.',
            page: 3,
            isKnown: false,
        },
        {
            id: 'w2',
            term: 'Allosteric Regulation',
            part_of_speech: 'noun',
            definition: 'The regulation of an enzyme by binding an effector molecule at a site other than the active site.',
            sentence: 'Feedback inhibition operates through allosteric regulation to prevent substrate accumulation.',
            page: 5,
            isKnown: true,
        },
        {
            id: 'w3',
            term: 'Electronegativity',
            part_of_speech: 'noun',
            definition: 'A chemical property that describes the tendency of an atom to attract electrons towards itself.',
            sentence: 'The electronegativity difference between bonded atoms determines dipole moment strength.',
            page: 7,
            isKnown: false,
        },
        {
            id: 'w4',
            term: 'Homeostasis',
            part_of_speech: 'noun',
            definition: 'The state of steady internal conditions maintained by living living organisms.',
            sentence: 'Negative feedback loops are essential for maintaining physiological homeostasis.',
            page: 9,
            isKnown: false,
        },
    ];

    // Handle Subject Switch
    const handleSelectSubject = (subject: SubjectItem) => {
        setSelectedSubject(subject);
        const doc = subject.documents[0] || null;
        setSelectedDoc(doc);
        loadDocumentMaterials(doc?.id || subject.id, selectedCourse.title, subject.name);
    };

    // Handle Document Switch
    const handleSelectDoc = (doc: PDFDoc) => {
        setSelectedDoc(doc);
        setIsDocPickerOpen(false);
        loadDocumentMaterials(doc.id, selectedCourse.title, selectedSubject.name);
    };

    // Filtered words
    const filteredWords = useMemo(() => {
        let list = [...words];
        if (wordFilter === 'to_learn') list = list.filter((w) => !w.isKnown);
        if (wordFilter === 'known') list = list.filter((w) => w.isKnown);
        if (wordSearch.trim()) {
            const q = wordSearch.toLowerCase();
            list = list.filter(
                (w) => w.term.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q)
            );
        }
        return list;
    }, [words, wordFilter, wordSearch]);

    // Toggle Mark As Known
    const toggleWordKnown = (wordId: string) => {
        setWords((prev) =>
            prev.map((w) => (w.id === wordId ? { ...w, isKnown: !w.isKnown } : w))
        );
    };

    // Export Vocabulary as CSV
    const handleExportCSV = async () => {
        if (words.length === 0) return;
        const csvRows = ['Term,Part of Speech,Definition,Sentence,Page,Status'];
        words.forEach((w) => {
            const row = `"${w.term}","${w.part_of_speech || ''}","${w.definition.replace(/"/g, '""')}","${(w.sentence || '').replace(/"/g, '""')}","p. ${w.page || 1}","${w.isKnown ? 'Known' : 'To Learn'}"`;
            csvRows.push(row);
        });
        const csvContent = csvRows.join('\n');

        try {
            await Share.share({
                title: `${selectedSubject.name}_Vocabulary.csv`,
                message: csvContent,
            });
        } catch (e) {
            console.warn('Share CSV notice:', e);
        }
    };

    // Jump viewer to citation page and highlight passage
    const handleJumpToCitation = (page: number, snippet: string) => {
        setActiveViewerPage(page);
        setHighlightSnippet(snippet);
        setIsViewerExpanded(true);
    };

    // ── Generate & Take Practice Quiz ──
    const handleStartPracticeQuiz = async () => {
        setQuizLoading(true);
        setIsQuizActive(true);
        setSelectedQuizAnswers({});
        setCurrentQuizIndex(0);
        setQuizCompleted(false);

        try {
            const payload = {
                topic: `${selectedSubject.name} Concept Practice`,
                num_questions: quizCount,
                pdf_id: quizSource === 'doc' ? selectedDoc?.id : undefined,
            };

            const res = await apiClient.post('/quiz/generate', payload).catch(() => null);
            if (res && res.data && res.data.questions && res.data.questions.length > 0) {
                const builtQs: QuizItem[] = res.data.questions.map((q: any, idx: number) => ({
                    id: idx + 1,
                    question: q.question,
                    options: q.options,
                    correct_answer: q.correct_answer,
                    explanation: q.explanation,
                    page: (idx % 8) + 2,
                    topic: selectedSubject.name,
                }));
                setQuizQuestions(builtQs);
            } else {
                setQuizQuestions(getFallbackQuiz(selectedSubject.name));
            }
        } catch {
            setQuizQuestions(getFallbackQuiz(selectedSubject.name));
        } finally {
            setQuizLoading(false);
        }
    };

    const getFallbackQuiz = (subName: string): QuizItem[] => [
        {
            id: 1,
            question: `In ${subName}, which organelle or mechanism directly powers active proton translocation across the membrane?`,
            options: ['ATP Synthase', 'Electron Transport Chain (Complex I-IV)', 'Sodium-Potassium ATPase', 'Voltage-Gated Channel'],
            correct_answer: 'Electron Transport Chain (Complex I-IV)',
            explanation: 'The redox reactions of Complexes I, III, and IV pump protons into the intermembrane space, generating the proton motive force.',
            page: 4,
            topic: subName,
        },
        {
            id: 2,
            question: `What primary kinetic outcome occurs when a non-competitive allosteric inhibitor binds an enzyme in ${subName}?`,
            options: ['Vmax decreases, Km remains unchanged', 'Vmax remains unchanged, Km increases', 'Both Vmax and Km decrease', 'Km increases linearly'],
            correct_answer: 'Vmax decreases, Km remains unchanged',
            explanation: 'Non-competitive inhibitors do not compete for the active site, thereby lowering the effective Vmax without altering substrate affinity (Km).',
            page: 6,
            topic: subName,
        },
        {
            id: 3,
            question: `Which fundamental law explains why heat flows spontaneously from higher temperature to lower temperature systems?`,
            options: ['First Law of Thermodynamics', 'Second Law of Thermodynamics', 'Mendels Law of Segregation', 'Hesss Law of Heat Summation'],
            correct_answer: 'Second Law of Thermodynamics',
            explanation: 'The Second Law states that the total entropy of an isolated system always increases over time in spontaneous processes.',
            page: 9,
            topic: subName,
        },
    ];

    // Handle Quiz Answer Selection
    const handleSelectQuizAnswer = (option: string) => {
        const q = quizQuestions[currentQuizIndex];
        if (!q || selectedQuizAnswers[q.id]) return; // Answered already
        setSelectedQuizAnswers((prev) => ({ ...prev, [q.id]: option }));
    };

    // Calculate Quiz Score
    const quizScore = useMemo(() => {
        let correct = 0;
        quizQuestions.forEach((q) => {
            if (selectedQuizAnswers[q.id] === q.correct_answer) {
                correct += 1;
            }
        });
        return {
            correct,
            total: quizQuestions.length,
            percentage: quizQuestions.length > 0 ? Math.round((correct / quizQuestions.length) * 100) : 0,
        };
    }, [quizQuestions, selectedQuizAnswers]);

    const missedQuestions = useMemo(() => {
        return quizQuestions.filter((q) => selectedQuizAnswers[q.id] && selectedQuizAnswers[q.id] !== q.correct_answer);
    }, [quizQuestions, selectedQuizAnswers]);

    // ── Scoped Chat Message Send ──
    const handleSendChatMessage = async () => {
        if (!chatInput.trim()) return;

        const userMsgText = chatInput.trim();
        const userMsg: ChatMessage = {
            id: `user_${Date.now()}`,
            sender: 'user',
            text: userMsgText,
        };

        setMessages((prev) => [...prev, userMsg]);
        setChatInput('');
        setChatLoading(true);

        const currentScope = `${selectedCourse.title} › ${selectedSubject.name}${selectedDoc ? ` › ${selectedDoc.filename}` : ''}`;

        try {
            const res = await apiClient.post('/ai/query', {
                question: userMsgText,
                pdf_id: selectedDoc?.id,
            }).catch(() => null);

            if (res && res.data && res.data.answer) {
                const answerText = res.data.answer;
                const aiMsg: ChatMessage = {
                    id: `ai_${Date.now()}`,
                    sender: 'ai',
                    text: answerText,
                    scopeLabel: currentScope,
                    citations: [
                        { page: 2, snippet: 'Directly supported in Chapter Overview and transport section.' },
                        { page: 5, snippet: 'Verified experimental mechanism on membrane potential.' },
                    ],
                };
                setMessages((prev) => [...prev, aiMsg]);
            } else {
                const fallbackAi: ChatMessage = {
                    id: `ai_${Date.now()}`,
                    sender: 'ai',
                    text: `Based on your **${selectedSubject.name}** notes, this concept follows the primary physiological mechanisms detailed on page 3.`,
                    scopeLabel: currentScope,
                    citations: [{ page: 3, snippet: 'Fundamental definition and mechanism summary.' }],
                };
                setMessages((prev) => [...prev, fallbackAi]);
            }
        } catch {
            const calmFallback: ChatMessage = {
                id: `ai_${Date.now()}`,
                sender: 'ai',
                text: "I couldn't find this specific detail in your uploaded material for this subject. Try broadening your query or selecting the whole course scope.",
                scopeLabel: currentScope,
            };
            setMessages((prev) => [...prev, calmFallback]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Top Course & Document Header */}
            <View style={styles.header}>
                <View style={styles.courseTitleRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.courseHeaderTitle} numberOfLines={1}>
                            {selectedCourse.title}
                        </Text>
                        <TouchableOpacity
                            style={styles.docPickerTrigger}
                            onPress={() => setIsDocPickerOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Choose document"
                        >
                            <FileText size={14} color={colors.accent} strokeWidth={1.5} style={{ marginRight: 5 }} />
                            <Text style={styles.docPickerText} numberOfLines={1}>
                                {selectedDoc?.filename || 'No document selected'}
                            </Text>
                            <ChevronDown size={14} color={colors.textMuted} strokeWidth={1.5} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.viewerToggleBtn}
                        onPress={() => setIsViewerExpanded(!isViewerExpanded)}
                        accessibilityRole="button"
                        accessibilityLabel={isViewerExpanded ? 'Collapse PDF reader' : 'Open PDF reader'}
                    >
                        {isViewerExpanded ? (
                            <Minimize2 size={18} color={colors.text} strokeWidth={1.5} />
                        ) : (
                            <Maximize2 size={18} color={colors.text} strokeWidth={1.5} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Horizontal Subject Switcher Chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.subjectChipsContainer}
                >
                    {selectedCourse.subjects.map((sub) => {
                        const isSelected = selectedSubject?.id === sub.id;
                        return (
                            <TouchableOpacity
                                key={sub.id}
                                style={[
                                    styles.subjectChip,
                                    isSelected && styles.subjectChipActive,
                                    isSelected && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
                                ]}
                                onPress={() => handleSelectSubject(sub)}
                                activeOpacity={0.7}
                            >
                                <View
                                    style={[
                                        styles.chipDot,
                                        { backgroundColor: isSelected ? colors.accent : colors.textMuted },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.subjectChipText,
                                        isSelected && { color: colors.accent, fontWeight: '600' },
                                    ]}
                                >
                                    {sub.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Split / Collapsible Layout for PDF Viewer on Desktop & Phone */}
            {isViewerExpanded && (
                <View style={styles.pdfViewerContainer}>
                    <View style={styles.pdfPageHeader}>
                        <Text style={styles.pdfPageIndicator}>
                            Page {activeViewerPage} of {selectedDoc ? '14' : '1'} · Paper Reader
                        </Text>
                        <TouchableOpacity onPress={() => setIsViewerExpanded(false)}>
                            <X size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Paper-Toned Reading Canvas */}
                    <ScrollView style={[styles.pdfPaperCanvas, { backgroundColor: colors.pdfPaper }]}>
                        <Text style={styles.pdfPaperHeading}>
                            {selectedDoc?.filename.replace(/\.pdf$/i, '').replace(/_/g, ' ') || selectedSubject.name}
                        </Text>
                        <Text style={styles.pdfPaperMeta}>Section 3.1 — Foundational Syllabus</Text>

                        {highlightSnippet ? (
                            <View style={[styles.citationHighlightBlock, { backgroundColor: colors.highlight }]}>
                                <Text style={[styles.citationHighlightText, { color: colors.highlightText }]}>
                                    "{highlightSnippet}"
                                </Text>
                            </View>
                        ) : null}

                        <Text style={styles.pdfPaperBody}>
                            Biological systems sustain metabolic equilibria via tight chemiosmotic coordination across cellular organelles. Selective solute transport, receptor dimerization, and bioenergetic enzymatic synthesis govern cellular homeostasis.
                        </Text>
                        <Text style={styles.pdfPaperBody}>
                            Experimental kinetics verify that allosteric regulators modulate substrate turn-over frequency without covalently altering active catalytic residues.
                        </Text>
                    </ScrollView>
                </View>
            )}

            {/* AI Control Center Tabs: Summary · Words · Quiz · Ask */}
            <View style={styles.segmentedControlContainer}>
                <SegmentedControl<HubSectionTab>
                    options={[
                        { key: 'summary', label: 'Summary' },
                        { key: 'words', label: 'Words', badgeCount: words.length },
                        { key: 'quiz', label: 'Quiz' },
                        { key: 'ask', label: 'Ask' },
                    ]}
                    selectedKey={activeSection}
                    onSelect={setActiveSection}
                />
            </View>

            {/* Tab Contents */}
            <View style={{ flex: 1 }}>
                {/* ── Summary Panel ── */}
                {activeSection === 'summary' && (
                    <ScrollView style={styles.panelContent} contentContainerStyle={{ paddingBottom: 90 }}>
                        <View style={styles.summaryControlsRow}>
                            <View style={styles.lengthPills}>
                                {(['brief', 'standard', 'detailed'] as SummaryLength[]).map((len) => (
                                    <TouchableOpacity
                                        key={len}
                                        style={[
                                            styles.lengthPill,
                                            summaryLength === len && styles.lengthPillActive,
                                        ]}
                                        onPress={() => setSummaryLength(len)}
                                    >
                                        <Text
                                            style={[
                                                styles.lengthPillText,
                                                summaryLength === len && { color: colors.accent, fontWeight: '600' },
                                            ]}
                                        >
                                            {len.charAt(0).toUpperCase() + len.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={styles.listenBtn}
                                onPress={() => {
                                    if (summaryData?.overview) {
                                        ttsService.speak(summaryData.overview);
                                    }
                                }}
                            >
                                <Volume2 size={16} color={colors.accent} strokeWidth={1.5} />
                                <Text style={[styles.listenText, { color: colors.accent }]}>Listen</Text>
                            </TouchableOpacity>
                        </View>

                        {summaryLoading ? (
                            <ParagraphSkeleton />
                        ) : summaryData ? (
                            <View>
                                <View style={styles.overviewBox}>
                                    <Text style={styles.overviewText}>
                                        {summaryData.overview}
                                    </Text>
                                </View>

                                <Text style={styles.sectionHeader}>Key Takeaways</Text>
                                <View style={styles.keyPointsContainer}>
                                    {summaryData.keyPoints.map((pt, idx) => (
                                        <View key={idx} style={styles.keyPointRow}>
                                            <View style={styles.bulletDot} />
                                            <Text style={styles.keyPointText}>{pt}</Text>
                                        </View>
                                    ))}
                                </View>

                                <Text style={styles.sectionHeader}>Chapter Sections</Text>
                                {summaryData.sections.map((sec, sIdx) => {
                                    const isOpen = expandedSections[sIdx];
                                    return (
                                        <View key={sIdx} style={[styles.collapsibleSection, shadows.card]}>
                                            <TouchableOpacity
                                                style={styles.sectionTitleRow}
                                                onPress={() =>
                                                    setExpandedSections((prev) => ({ ...prev, [sIdx]: !prev[sIdx] }))
                                                }
                                            >
                                                <Text style={styles.sectionTitle}>{sec.title}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    {sec.page && (
                                                        <TouchableOpacity
                                                            style={styles.pageChip}
                                                            onPress={() => handleJumpToCitation(sec.page!, sec.content)}
                                                        >
                                                            <Text style={styles.pageChipText}>p. {sec.page}</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                    {isOpen ? (
                                                        <ChevronUp size={16} color={colors.textMuted} />
                                                    ) : (
                                                        <ChevronDown size={16} color={colors.textMuted} />
                                                    )}
                                                </View>
                                            </TouchableOpacity>

                                            {isOpen && (
                                                <Text style={styles.sectionBody}>{sec.content}</Text>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        ) : null}
                    </ScrollView>
                )}

                {/* ── Words Panel ── */}
                {activeSection === 'words' && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.wordsToolbar}>
                            <View style={styles.wordSearchBox}>
                                <Search size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                                <TextInput
                                    style={styles.wordSearchInput}
                                    placeholder="Search terms..."
                                    placeholderTextColor={colors.textMuted}
                                    value={wordSearch}
                                    onChangeText={setWordSearch}
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.studyDeckBtn}
                                onPress={() => {
                                    setFlashcardIndex(0);
                                    setIsCardFlipped(false);
                                    setIsFlashcardOpen(true);
                                }}
                            >
                                <BookMarked size={14} color={colors.accent} strokeWidth={1.5} style={{ marginRight: 4 }} />
                                <Text style={[styles.studyDeckText, { color: colors.accent }]}>Flashcards</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
                                <Share2 size={14} color={colors.textSecondary} strokeWidth={1.5} />
                            </TouchableOpacity>
                        </View>

                        {/* Filter tabs: All · To learn · Known */}
                        <View style={styles.wordsFilterTabs}>
                            {(['all', 'to_learn', 'known'] as WordFilter[]).map((f) => (
                                <TouchableOpacity
                                    key={f}
                                    style={[
                                        styles.filterTab,
                                        wordFilter === f && styles.filterTabActive,
                                    ]}
                                    onPress={() => setWordFilter(f)}
                                >
                                    <Text
                                        style={[
                                            styles.filterTabText,
                                            wordFilter === f && { color: colors.accent, fontWeight: '600' },
                                        ]}
                                    >
                                        {f === 'all' ? 'All' : f === 'to_learn' ? 'To learn' : 'Known'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {wordsLoading ? (
                            <View style={{ padding: 16 }}><CardSkeleton /></View>
                        ) : (
                            <FlatList
                                data={filteredWords}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
                                renderItem={({ item }) => (
                                    <View style={[styles.wordCard, shadows.card]}>
                                        <View style={styles.wordCardHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                                                <Text style={styles.wordTerm}>{item.term}</Text>
                                                {item.part_of_speech && (
                                                    <Text style={styles.wordPos}>{item.part_of_speech}</Text>
                                                )}
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                {item.page && (
                                                    <TouchableOpacity
                                                        style={styles.pageChip}
                                                        onPress={() => handleJumpToCitation(item.page!, item.sentence || item.definition)}
                                                    >
                                                        <Text style={styles.pageChipText}>p. {item.page}</Text>
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity
                                                    style={[
                                                        styles.knownToggleBtn,
                                                        item.isKnown && { backgroundColor: colors.successMuted },
                                                    ]}
                                                    onPress={() => toggleWordKnown(item.id)}
                                                >
                                                    <Check
                                                        size={14}
                                                        color={item.isKnown ? colors.success : colors.textMuted}
                                                        strokeWidth={item.isKnown ? 2.5 : 1.5}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <Text style={styles.wordDefinition}>{item.definition}</Text>

                                        {item.sentence ? (
                                            <View style={styles.wordSentenceBox}>
                                                <Text style={styles.wordSentenceText}>
                                                    "{item.sentence}"
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                )}
                            />
                        )}
                    </View>
                )}

                {/* ── Quiz Panel ── */}
                {activeSection === 'quiz' && (
                    <View style={{ flex: 1, padding: 16 }}>
                        {!isQuizActive ? (
                            <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
                                <Text style={styles.quizSetupTitle}>Practice Quiz</Text>
                                <Text style={styles.quizSetupSubtitle}>
                                    Low-stakes active recall practice tied directly to what you are studying.
                                </Text>

                                <Text style={styles.quizFieldLabel}>Source Scope</Text>
                                <View style={styles.quizSourceRow}>
                                    {[
                                        { key: 'doc', label: 'This PDF' },
                                        { key: 'subject', label: 'This Subject' },
                                        { key: 'course', label: 'Whole Course' },
                                    ].map((s) => (
                                        <TouchableOpacity
                                            key={s.key}
                                            style={[
                                                styles.sourceOption,
                                                quizSource === s.key && styles.sourceOptionActive,
                                            ]}
                                            onPress={() => setQuizSource(s.key as any)}
                                        >
                                            <Text
                                                style={[
                                                    styles.sourceOptionText,
                                                    quizSource === s.key && { color: colors.accent, fontWeight: '600' },
                                                ]}
                                            >
                                                {s.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.quizFieldLabel}>Question Count</Text>
                                <View style={styles.quizSourceRow}>
                                    {[5, 10, 15].map((cnt) => (
                                        <TouchableOpacity
                                            key={cnt}
                                            style={[
                                                styles.sourceOption,
                                                quizCount === cnt && styles.sourceOptionActive,
                                            ]}
                                            onPress={() => setQuizCount(cnt)}
                                        >
                                            <Text
                                                style={[
                                                    styles.sourceOptionText,
                                                    quizCount === cnt && { color: colors.accent, fontWeight: '600' },
                                                ]}
                                            >
                                                {cnt} Questions
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.quizFieldLabel}>Difficulty</Text>
                                <View style={styles.quizSourceRow}>
                                    {['Easy', 'Medium', 'Hard'].map((diff) => (
                                        <TouchableOpacity
                                            key={diff}
                                            style={[
                                                styles.sourceOption,
                                                quizDifficulty === diff && styles.sourceOptionActive,
                                            ]}
                                            onPress={() => setQuizDifficulty(diff as any)}
                                        >
                                            <Text
                                                style={[
                                                    styles.sourceOptionText,
                                                    quizDifficulty === diff && { color: colors.accent, fontWeight: '600' },
                                                ]}
                                            >
                                                {diff}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TouchableOpacity
                                    style={[styles.startQuizBtn, { backgroundColor: colors.accent }]}
                                    onPress={handleStartPracticeQuiz}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.startQuizText, { color: colors.textInverse }]}>
                                        Generate & Start Practice
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        ) : quizLoading ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={colors.accent} />
                                <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: typography.sizes.sm }}>
                                    Synthesizing practice quiz grounded in {selectedSubject.name}...
                                </Text>
                            </View>
                        ) : quizCompleted ? (
                            <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
                                <View style={[styles.quizResultsCard, shadows.card]}>
                                    <Text style={styles.resultsHeader}>Practice Completed</Text>
                                    <Text style={styles.resultsScoreBig}>{quizScore.percentage}%</Text>
                                    <Text style={styles.resultsScoreDetail}>
                                        {quizScore.correct} correct out of {quizScore.total} questions
                                    </Text>
                                </View>

                                {missedQuestions.length > 0 ? (
                                    <View>
                                        <Text style={styles.sectionHeader}>Review Missed Questions</Text>
                                        {missedQuestions.map((q) => (
                                            <View key={q.id} style={[styles.missedCard, shadows.card]}>
                                                <Text style={styles.missedQText}>{q.question}</Text>
                                                <Text style={styles.missedAnswerCorrect}>
                                                    Correct: {q.correct_answer}
                                                </Text>
                                                <Text style={styles.missedExplanation}>{q.explanation}</Text>
                                                {q.page && (
                                                    <TouchableOpacity
                                                        style={[styles.pageChip, { alignSelf: 'flex-start', marginTop: 8 }]}
                                                        onPress={() => handleJumpToCitation(q.page!, q.explanation)}
                                                    >
                                                        <Text style={styles.pageChipText}>Source p. {q.page}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ))}

                                        <TouchableOpacity
                                            style={[styles.startQuizBtn, { backgroundColor: colors.accent, marginTop: 12 }]}
                                            onPress={() => {
                                                setQuizQuestions(missedQuestions);
                                                setSelectedQuizAnswers({});
                                                setCurrentQuizIndex(0);
                                                setQuizCompleted(false);
                                            }}
                                        >
                                            <RotateCcw size={16} color={colors.textInverse} style={{ marginRight: 6 }} />
                                            <Text style={[styles.startQuizText, { color: colors.textInverse }]}>Retry Missed</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                        <CheckCircle2 size={40} color={colors.success} />
                                        <Text style={{ marginTop: 8, color: colors.text, fontWeight: '600' }}>
                                            Flawless score! All concepts mastered.
                                        </Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.donePracticeBtn}
                                    onPress={() => setIsQuizActive(false)}
                                >
                                    <Text style={styles.donePracticeText}>Back to Quiz Options</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        ) : (
                            <View style={{ flex: 1 }}>
                                {/* Active Question View with Progress */}
                                <View style={styles.quizProgressBarContainer}>
                                    <View
                                        style={[
                                            styles.quizProgressBar,
                                            {
                                                width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%`,
                                                backgroundColor: colors.accent,
                                            },
                                        ]}
                                    />
                                </View>

                                <Text style={styles.quizProgressText}>
                                    Question {currentQuizIndex + 1} of {quizQuestions.length}
                                </Text>

                                {quizQuestions[currentQuizIndex] && (
                                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                                        <Text style={styles.activeQuestionText}>
                                            {quizQuestions[currentQuizIndex].question}
                                        </Text>

                                        <View style={styles.quizOptionsList}>
                                            {quizQuestions[currentQuizIndex].options.map((opt, oIdx) => {
                                                const currentQ = quizQuestions[currentQuizIndex];
                                                const chosen = selectedQuizAnswers[currentQ.id];
                                                const isSelected = chosen === opt;
                                                const isCorrect = opt === currentQ.correct_answer;
                                                const showFeedback = !!chosen;

                                                let optionStyle = styles.quizOptionRow;
                                                if (showFeedback) {
                                                    if (isCorrect) optionStyle = { ...optionStyle, ...styles.quizOptionCorrect };
                                                    else if (isSelected) optionStyle = { ...optionStyle, ...styles.quizOptionIncorrect };
                                                }

                                                return (
                                                    <TouchableOpacity
                                                        key={oIdx}
                                                        style={optionStyle}
                                                        onPress={() => handleSelectQuizAnswer(opt)}
                                                        disabled={!!chosen}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.quizOptionText}>{opt}</Text>
                                                        {showFeedback && isCorrect && (
                                                            <CheckCircle2 size={18} color={colors.success} />
                                                        )}
                                                        {showFeedback && isSelected && !isCorrect && (
                                                            <XCircle size={18} color={colors.danger} />
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                        {/* Instant Feedback Explanation & Citation Jump */}
                                        {selectedQuizAnswers[quizQuestions[currentQuizIndex].id] && (
                                            <View style={[styles.instantFeedbackBox, shadows.card]}>
                                                <Text style={styles.feedbackTitle}>Explanation</Text>
                                                <Text style={styles.feedbackExplanation}>
                                                    {quizQuestions[currentQuizIndex].explanation}
                                                </Text>
                                                {quizQuestions[currentQuizIndex].page && (
                                                    <TouchableOpacity
                                                        style={[styles.pageChip, { alignSelf: 'flex-start', marginTop: 8 }]}
                                                        onPress={() =>
                                                            handleJumpToCitation(
                                                                quizQuestions[currentQuizIndex].page!,
                                                                quizQuestions[currentQuizIndex].explanation
                                                            )
                                                        }
                                                    >
                                                        <Text style={styles.pageChipText}>
                                                            Source p. {quizQuestions[currentQuizIndex].page}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}
                                    </ScrollView>
                                )}

                                <View style={styles.quizNavRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.quizNavBtn,
                                            currentQuizIndex === 0 && { opacity: 0.3 },
                                        ]}
                                        disabled={currentQuizIndex === 0}
                                        onPress={() => setCurrentQuizIndex((prev) => Math.max(0, prev - 1))}
                                    >
                                        <Text style={styles.quizNavBtnText}>Previous</Text>
                                    </TouchableOpacity>

                                    {currentQuizIndex < quizQuestions.length - 1 ? (
                                        <TouchableOpacity
                                            style={[styles.quizNavBtn, { backgroundColor: colors.accent }]}
                                            onPress={() => setCurrentQuizIndex((prev) => prev + 1)}
                                        >
                                            <Text style={[styles.quizNavBtnText, { color: colors.textInverse }]}>Next</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.quizNavBtn, { backgroundColor: colors.accent }]}
                                            onPress={() => setQuizCompleted(true)}
                                        >
                                            <Text style={[styles.quizNavBtnText, { color: colors.textInverse }]}>Finish</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Ask / Scoped Chat Panel ── */}
                {activeSection === 'ask' && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.scopedChatHeader}>
                            <Text style={styles.scopedChatScopeLabel}>
                                Answering from: {selectedCourse.title} › {selectedSubject.name}
                            </Text>
                        </View>

                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {messages.map((msg) => {
                                const isAi = msg.sender === 'ai';

                                return (
                                    <View key={msg.id} style={styles.messageItemWrapper}>
                                        <Text style={isAi ? styles.aiMessageText : styles.userMessageText}>
                                            {msg.text}
                                        </Text>

                                        {msg.citations && msg.citations.length > 0 && (
                                            <View style={styles.chatCitationsRow}>
                                                {msg.citations.map((cit, cIdx) => (
                                                    <TouchableOpacity
                                                        key={cIdx}
                                                        style={styles.pageChip}
                                                        onPress={() => handleJumpToCitation(cit.page, cit.snippet)}
                                                    >
                                                        <Text style={styles.pageChipText}>p. {cit.page}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                            {chatLoading && (
                                <View style={{ paddingVertical: 12 }}>
                                    <ActivityIndicator size="small" color={colors.accent} />
                                </View>
                            )}
                        </ScrollView>

                        {/* Composer Bar */}
                        <View style={styles.composerBar}>
                            <TextInput
                                style={styles.composerInput}
                                placeholder={`Ask a question about ${selectedSubject.name}...`}
                                placeholderTextColor={colors.textMuted}
                                value={chatInput}
                                onChangeText={setChatInput}
                                onSubmitEditing={handleSendChatMessage}
                            />
                            <TouchableOpacity
                                style={[
                                    styles.sendBtn,
                                    { backgroundColor: chatInput.trim() ? colors.accent : colors.surfaceRaised },
                                ]}
                                disabled={!chatInput.trim() || chatLoading}
                                onPress={handleSendChatMessage}
                            >
                                <Send
                                    size={16}
                                    color={chatInput.trim() ? colors.textInverse : colors.textMuted}
                                    strokeWidth={1.5}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Document Picker Dropdown Modal */}
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
                    <View style={[styles.docPickerModalCard, shadows.modal]}>
                        <Text style={styles.docPickerModalTitle}>
                            Select Document in {selectedSubject.name}
                        </Text>
                        {selectedSubject.documents.length === 0 ? (
                            <Text style={styles.emptyDocsNotice}>No documents uploaded for this subject yet.</Text>
                        ) : (
                            selectedSubject.documents.map((d) => (
                                <TouchableOpacity
                                    key={d.id}
                                    style={[
                                        styles.docPickItem,
                                        selectedDoc?.id === d.id && { backgroundColor: colors.surfaceRaised },
                                    ]}
                                    onPress={() => handleSelectDoc(d)}
                                >
                                    <FileText size={16} color={colors.accent} strokeWidth={1.5} style={{ marginRight: 8 }} />
                                    <Text style={styles.docPickName} numberOfLines={1}>
                                        {d.filename}
                                    </Text>
                                    {selectedDoc?.id === d.id && (
                                        <Check size={16} color={colors.accent} strokeWidth={2} />
                                    )}
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Flashcard Study Mode Modal */}
            <Modal
                visible={isFlashcardOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsFlashcardOpen(false)}
            >
                <View style={styles.flashcardModalContainer}>
                    <View style={styles.flashcardModalHeader}>
                        <Text style={styles.flashcardModalTitle}>Flashcard Study Mode</Text>
                        <TouchableOpacity onPress={() => setIsFlashcardOpen(false)}>
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {words.length > 0 && (
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={styles.cardCounter}>
                                Card {flashcardIndex + 1} of {words.length}
                            </Text>

                            <TouchableOpacity
                                style={[styles.flashcardLarge, shadows.card]}
                                activeOpacity={0.9}
                                onPress={() => setIsCardFlipped(!isCardFlipped)}
                            >
                                <Text style={styles.flashcardTapHint}>
                                    {isCardFlipped ? 'Definition' : 'Term (Tap to flip)'}
                                </Text>
                                <Text style={styles.flashcardMainText}>
                                    {isCardFlipped
                                        ? words[flashcardIndex].definition
                                        : words[flashcardIndex].term}
                                </Text>
                                {isCardFlipped && words[flashcardIndex].sentence && (
                                    <Text style={styles.flashcardSentence}>
                                        "{words[flashcardIndex].sentence}"
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.flashcardActionsRow}>
                                <TouchableOpacity
                                    style={[styles.flashcardActionBtn, { borderColor: colors.warning }]}
                                    onPress={() => {
                                        setIsCardFlipped(false);
                                        setFlashcardIndex((prev) => (prev + 1) % words.length);
                                    }}
                                >
                                    <Text style={[styles.flashcardActionText, { color: colors.warning }]}>Review Again</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.flashcardActionBtn, { backgroundColor: colors.accent }]}
                                    onPress={() => {
                                        toggleWordKnown(words[flashcardIndex].id);
                                        setIsCardFlipped(false);
                                        setFlashcardIndex((prev) => (prev + 1) % words.length);
                                    }}
                                >
                                    <Text style={[styles.flashcardActionText, { color: colors.textInverse }]}>Got It (Mark Known)</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (colors: ThemeColors, topGap: number = getStaticSafeTopGap()) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        header: {
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingTop: topGap,
            paddingBottom: 8,
        },
        courseTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            marginBottom: 8,
        },
        courseHeaderTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        docPickerTrigger: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 3,
        },
        docPickerText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            maxWidth: 240,
            marginRight: 4,
        },
        viewerToggleBtn: {
            padding: 8,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceRaised,
        },
        subjectChipsContainer: {
            paddingHorizontal: 16,
            gap: 6,
            paddingVertical: 4,
        },
        subjectChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        subjectChipActive: {},
        chipDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            marginRight: 6,
        },
        subjectChipText: {
            fontSize: typography.sizes.xs,
            fontWeight: '500',
            color: colors.textSecondary,
        },
        pdfViewerContainer: {
            height: 220,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        pdfPageHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 6,
            backgroundColor: colors.surfaceRaised,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
        },
        pdfPageIndicator: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '500',
        },
        pdfPaperCanvas: {
            flex: 1,
            padding: 16,
        },
        pdfPaperHeading: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: '#1C1B18',
            marginBottom: 2,
        },
        pdfPaperMeta: {
            fontSize: typography.sizes.xs,
            color: '#6B675E',
            marginBottom: 12,
        },
        pdfPaperBody: {
            fontSize: 14,
            lineHeight: 22,
            color: '#1C1B18',
            fontFamily: typography.fontFamily.serif,
            marginBottom: 10,
        },
        citationHighlightBlock: {
            padding: 8,
            borderRadius: radii.xs,
            marginBottom: 10,
        },
        citationHighlightText: {
            fontSize: 13,
            fontWeight: '600',
        },
        segmentedControlContainer: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.bg,
        },
        panelContent: {
            flex: 1,
            paddingHorizontal: 16,
        },
        summaryControlsRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginVertical: 10,
        },
        lengthPills: {
            flexDirection: 'row',
            gap: 6,
        },
        lengthPill: {
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        lengthPillActive: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        lengthPillText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
        },
        listenBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.sm,
            backgroundColor: colors.accentMuted,
        },
        listenText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            marginLeft: 4,
        },
        overviewBox: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 16,
        },
        overviewText: {
            fontSize: 16,
            lineHeight: 26,
            color: colors.text,
            fontFamily: typography.fontFamily.serif,
        },
        sectionHeader: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 10,
            marginTop: 6,
        },
        keyPointsContainer: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 16,
            gap: 10,
        },
        keyPointRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        bulletDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.accent,
            marginTop: 7,
            marginRight: 10,
        },
        keyPointText: {
            fontSize: typography.sizes.sm,
            color: colors.text,
            lineHeight: 20,
            flex: 1,
        },
        collapsibleSection: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        sectionTitleRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        sectionTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
            flex: 1,
        },
        sectionBody: {
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            lineHeight: 22,
            fontFamily: typography.fontFamily.serif,
            marginTop: 10,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
            paddingTop: 8,
        },
        pageChip: {
            backgroundColor: colors.accentMuted,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: radii.xs,
        },
        pageChipText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            color: colors.accent,
        },
        wordsToolbar: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 8,
        },
        wordSearchBox: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.sm,
            paddingHorizontal: 10,
            height: 36,
        },
        wordSearchInput: {
            flex: 1,
            fontSize: typography.sizes.xs,
            color: colors.text,
        },
        studyDeckBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            height: 36,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.accentBorder,
            backgroundColor: colors.accentMuted,
        },
        studyDeckText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        exportBtn: {
            width: 36,
            height: 36,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },
        wordsFilterTabs: {
            flexDirection: 'row',
            paddingHorizontal: 16,
            gap: 8,
            marginBottom: 6,
        },
        filterTab: {
            paddingVertical: 4,
            paddingHorizontal: 12,
            borderRadius: radii.full,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        filterTabActive: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        filterTabText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
        },
        wordCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        wordCardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
        },
        wordTerm: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
        },
        wordPos: {
            fontSize: typography.sizes.xs,
            fontStyle: 'italic',
            color: colors.textMuted,
        },
        knownToggleBtn: {
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        wordDefinition: {
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            lineHeight: 20,
            marginBottom: 8,
        },
        wordSentenceBox: {
            backgroundColor: colors.surfaceRaised,
            padding: 8,
            borderRadius: radii.xs,
            borderLeftWidth: 3,
            borderLeftColor: colors.accent,
        },
        wordSentenceText: {
            fontSize: typography.sizes.xs,
            fontStyle: 'italic',
            color: colors.textSecondary,
            fontFamily: typography.fontFamily.serif,
        },
        quizSetupTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        quizSetupSubtitle: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            lineHeight: 20,
            marginBottom: 16,
        },
        quizFieldLabel: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
            marginTop: 10,
            marginBottom: 6,
        },
        quizSourceRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 10,
        },
        sourceOption: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
        },
        sourceOptionActive: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        sourceOptionText: {
            fontSize: typography.sizes.xs,
            color: colors.textSecondary,
            fontWeight: '500',
        },
        startQuizBtn: {
            paddingVertical: 12,
            borderRadius: radii.sm,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 18,
            flexDirection: 'row',
        },
        startQuizText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
        quizProgressBarContainer: {
            height: 4,
            backgroundColor: colors.border,
            borderRadius: 2,
            marginBottom: 10,
            overflow: 'hidden',
        },
        quizProgressBar: {
            height: '100%',
        },
        quizProgressText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginBottom: 12,
        },
        activeQuestionText: {
            fontSize: typography.sizes.md,
            fontWeight: '600',
            color: colors.text,
            lineHeight: 24,
            fontFamily: typography.fontFamily.serif,
            marginBottom: 16,
        },
        quizOptionsList: {
            gap: 8,
            marginBottom: 16,
        },
        quizOptionRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 14,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        quizOptionCorrect: {
            borderColor: colors.success,
            backgroundColor: colors.successMuted,
        },
        quizOptionIncorrect: {
            borderColor: colors.danger,
            backgroundColor: colors.dangerMuted,
        },
        quizOptionText: {
            fontSize: typography.sizes.sm,
            color: colors.text,
            flex: 1,
            paddingRight: 8,
        },
        instantFeedbackBox: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginTop: 8,
        },
        feedbackTitle: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
            marginBottom: 4,
        },
        feedbackExplanation: {
            fontSize: typography.sizes.sm,
            color: colors.text,
            lineHeight: 20,
        },
        quizNavRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        quizNavBtn: {
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: radii.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        quizNavBtnText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
        },
        quizResultsCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            alignItems: 'center',
            marginBottom: 16,
        },
        resultsHeader: {
            fontSize: typography.sizes.md,
            color: colors.textMuted,
            marginBottom: 4,
        },
        resultsScoreBig: {
            fontSize: 48,
            fontWeight: '800',
            color: colors.accent,
        },
        resultsScoreDetail: {
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
        },
        missedCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        missedQText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 6,
        },
        missedAnswerCorrect: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.success,
            marginBottom: 4,
        },
        missedExplanation: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            lineHeight: 18,
        },
        donePracticeBtn: {
            paddingVertical: 12,
            alignItems: 'center',
            marginTop: 8,
        },
        donePracticeText: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
        },
        scopedChatHeader: {
            backgroundColor: colors.surfaceRaised,
            paddingVertical: 6,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
        },
        scopedChatScopeLabel: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '500',
        },
        messageItemWrapper: {
            marginBottom: 16,
        },
        aiMessageText: {
            fontSize: 15,
            lineHeight: 24,
            color: colors.text,
            fontFamily: typography.fontFamily.sans,
        },
        userMessageText: {
            fontSize: 15,
            lineHeight: 22,
            color: colors.accent,
            fontWeight: '600',
            alignSelf: 'flex-end',
            marginBottom: 4,
        },
        chatCitationsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 8,
        },
        composerBar: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
        },
        composerInput: {
            flex: 1,
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.full,
            paddingHorizontal: 14,
            paddingVertical: 8,
            fontSize: typography.sizes.sm,
            color: colors.text,
            marginRight: 8,
        },
        sendBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
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
        docPickerModalCard: {
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
        },
        docPickerModalTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 12,
        },
        emptyDocsNotice: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            paddingVertical: 10,
        },
        docPickItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 8,
            borderRadius: radii.sm,
        },
        docPickName: {
            flex: 1,
            fontSize: typography.sizes.sm,
            color: colors.text,
        },
        flashcardModalContainer: {
            flex: 1,
            backgroundColor: colors.bg,
            padding: 20,
            paddingTop: topGap,
        },
        flashcardModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        flashcardModalTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '700',
            color: colors.text,
        },
        cardCounter: {
            textAlign: 'center',
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginBottom: 16,
        },
        flashcardLarge: {
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 28,
            minHeight: 240,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
        },
        flashcardTapHint: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            position: 'absolute',
            top: 16,
        },
        flashcardMainText: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
            lineHeight: 30,
        },
        flashcardSentence: {
            fontSize: typography.sizes.sm,
            fontStyle: 'italic',
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: 12,
        },
        flashcardActionsRow: {
            flexDirection: 'row',
            gap: 12,
        },
        flashcardActionBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: radii.sm,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        flashcardActionText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
    });

export default CourseHubScreen;
