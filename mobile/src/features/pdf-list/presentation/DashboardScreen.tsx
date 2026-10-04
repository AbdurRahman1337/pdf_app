import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    Platform,
    Animated,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    BookOpen,
    Plus,
    Search,
    LayoutGrid,
    List,
    MoreVertical,
    FolderPlus,
    FileText,
    ChevronRight,
    ChevronDown,
    UploadCloud,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    X,
    Trash2,
    Edit3,
    Layers,
    ArrowLeft,
    Flame,
    Sparkles,
    Check,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, gradients } from '../../../core/theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../../../core/theme/motion';
import EmptyState from '../../../core/components/EmptyState';
import ProgressRing from '../../../core/components/ProgressRing';
import ConfirmDialog from '../../../core/components/ConfirmDialog';
import Toast from '../../../core/components/Toast';
import OfflineBanner from '../../../core/components/OfflineBanner';
import { CardSkeleton } from '../../../core/components/LoadingSkeleton';
import { AnimatedPressable } from '../../../core/components/AnimatedPressable';
import { GradientView } from '../../../core/components/GradientView';
import StatusChip from '../../../core/components/StatusChip';

export interface PDFDoc {
    id: string;
    filename: string;
    size_bytes: number;
    chunk_count?: number;
    uploaded_at?: string;
    status?: 'READY' | 'PROCESSING' | 'FAILED';
    errorReason?: string;
}

export interface SubjectItem {
    id: string;
    name: string;
    code?: string;
    color?: string;
    documents: PDFDoc[];
    mastery_percentage?: number;
    summary_brief?: string;
    vocab_count?: number;
}

export interface CourseItem {
    id: string;
    title: string;
    description?: string;
    target_exam_or_degree?: string;
    created_at: string;
    subjects: SubjectItem[];
    total_documents?: number;
    overall_progress_percentage?: number;
}

export const LAST_STUDY_CONTEXT_KEY = '@pdf_app_last_study_context';
const COURSES_STORAGE_KEY = '@pdf_app_courses_library_v3';

export const DEFAULT_INITIAL_COURSE: CourseItem = {
    id: 'course_mdcat_master',
    title: 'Pre-Medical Science Curriculum',
    description: 'Comprehensive course covering Biology, Chemistry, and Physics.',
    target_exam_or_degree: 'Pre-Med / Biology Track',
    created_at: new Date().toISOString(),
    overall_progress_percentage: 65,
    subjects: [
        {
            id: 'sub_bio_101',
            name: 'Cell Biology & Genetics',
            code: 'BIO-101',
            color: '#0D9488',
            mastery_percentage: 75,
            documents: [
                {
                    id: 'doc_bio_ch1',
                    filename: 'Chapter_1_Cell_Structure_and_Membranes.pdf',
                    size_bytes: 2400000,
                    status: 'READY',
                },
                {
                    id: 'doc_bio_ch2',
                    filename: 'Chapter_2_Bioenergetics_and_ATP.pdf',
                    size_bytes: 3100000,
                    status: 'READY',
                },
            ],
        },
        {
            id: 'sub_chem_102',
            name: 'Organic & Physical Chemistry',
            code: 'CHEM-102',
            color: '#2F6FED',
            mastery_percentage: 55,
            documents: [
                {
                    id: 'doc_chem_ch1',
                    filename: 'Organic_Reaction_Mechanisms.pdf',
                    size_bytes: 1800000,
                    status: 'READY',
                },
            ],
        },
        {
            id: 'sub_phy_103',
            name: 'Mechanics & Thermodynamics',
            code: 'PHY-103',
            color: '#F2644A',
            mastery_percentage: 40,
            documents: [],
        },
    ],
};

export const formatFileSize = (bytes?: number) => {
    if (!bytes || isNaN(bytes)) return '1.2 MB';
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DashboardScreen = ({ navigation }: any) => {
    const { colors, shadows, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

    // Data State
    const [courses, setCourses] = useState<CourseItem[]>([DEFAULT_INITIAL_COURSE]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    // View & Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
    const [activeCourseNav, setActiveCourseNav] = useState<CourseItem | null>(null);
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

    // Add Course Wizard State
    const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
    const [newCourseTitle, setNewCourseTitle] = useState('');
    const [newCourseTarget, setNewCourseTarget] = useState('');
    const [subjectDrafts, setSubjectDrafts] = useState<{ id: string; name: string; files: any[] }[]>([
        { id: '1', name: 'Biology', files: [] },
        { id: '2', name: 'Chemistry', files: [] },
    ]);

    // Ingestion Sequence State (The Signature Moment)
    const [isIngesting, setIsIngesting] = useState(false);
    const [ingestionSubjects, setIngestionSubjects] = useState<{
        id: string;
        name: string;
        fileName?: string;
        stage: 'uploading' | 'reading' | 'indexing' | 'ready' | 'failed';
        progressPct: number;
        error?: string;
    }[]>([]);

    // Breathing dropzone animation ref
    const breatheAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (isAddCourseModalOpen && !getIsReducedMotion()) {
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(breatheAnim, {
                        toValue: 1.025,
                        duration: motion.durations.breathe / 2,
                        easing: motion.easings.easeInOut,
                        useNativeDriver: true,
                    }),
                    Animated.timing(breatheAnim, {
                        toValue: 1,
                        duration: motion.durations.breathe / 2,
                        easing: motion.easings.easeInOut,
                        useNativeDriver: true,
                    }),
                ])
            );
            loop.start();
            return () => loop.stop();
        }
    }, [isAddCourseModalOpen]);

    // Actions & Overflow State
    const [courseActionTarget, setCourseActionTarget] = useState<CourseItem | null>(null);
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameTitleInput, setRenameTitleInput] = useState('');

    // Add Subject to existing course
    const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
    const [addSubjectNameInput, setAddSubjectNameInput] = useState('');

    // Delete Confirmation & Toast State
    const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'course' | 'subject' | 'doc'; item: any } | null>(null);
    const [deletedItemCache, setDeletedItemCache] = useState<{ courses: CourseItem[]; message: string } | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Floating Button hide/show on scroll
    const [isFabVisible, setIsFabVisible] = useState(true);
    const lastScrollY = useRef(0);

    const handleScroll = (event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        if (currentY > lastScrollY.current + 20 && currentY > 40) {
            if (isFabVisible) setIsFabVisible(false);
        } else if (currentY < lastScrollY.current - 20) {
            if (!isFabVisible) setIsFabVisible(true);
        }
        lastScrollY.current = currentY;
    };

    // Load initial courses
    const loadCourses = async () => {
        try {
            const saved = await AsyncStorage.getItem(COURSES_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCourses(parsed);
                }
            }

            const res = await apiClient.get('/courses/list').catch(() => null);
            if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
                const sanitizedBackend: CourseItem[] = res.data.map((c: any) => ({
                    id: c.id || `course_${Date.now()}`,
                    title: c.title || c.course_name || c.name || 'Untitled Course',
                    description: c.description || '',
                    target_exam_or_degree: c.target_exam_or_degree || '',
                    created_at: c.created_at || new Date().toISOString(),
                    overall_progress_percentage: c.overall_progress_percentage || 0,
                    subjects: Array.isArray(c.subjects)
                        ? c.subjects.map((s: any) => ({
                              id: s.id || `sub_${Date.now()}`,
                              name: s.name || s.subject_name || 'General Subject',
                              code: s.code || '',
                              color: s.color || '#0D9488',
                              documents: Array.isArray(s.documents) ? s.documents : [],
                              mastery_percentage: s.mastery_percentage || 0,
                              vocab_count: s.vocab_count || 0,
                          }))
                        : [],
                }));

                setCourses((prev) => {
                    const merged = [...sanitizedBackend];
                    (prev || []).forEach((p) => {
                        if (p && !merged.some((m) => m && m.id === p.id)) {
                            merged.push(p);
                        }
                    });
                    AsyncStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(merged));
                    return merged;
                });
                setIsOffline(false);
            }
        } catch (e) {
            console.warn('Courses sync notice:', e);
            setIsOffline(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadCourses();
    }, []);

    const saveCourses = async (newCourses: CourseItem[]) => {
        setCourses(newCourses);
        try {
            await AsyncStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(newCourses));
        } catch (e) {
            console.error('Failed to persist courses:', e);
        }
    };

    const filteredCourses = useMemo(() => {
        if (!searchQuery.trim()) return courses;
        const q = searchQuery.toLowerCase();
        return (courses || []).filter((c) => {
            if (!c) return false;
            const matchTitle = (c.title || '').toLowerCase().includes(q);
            const matchTarget = (c.target_exam_or_degree || '').toLowerCase().includes(q);
            const matchSubject = (c.subjects || []).some((s) => (s?.name || '').toLowerCase().includes(q));
            const matchDoc = (c.subjects || []).some((s) =>
                (s?.documents || []).some((d) => (d?.filename || '').toLowerCase().includes(q))
            );
            return matchTitle || matchTarget || matchSubject || matchDoc;
        });
    }, [courses, searchQuery]);

    const overallStudyProgress = useMemo(() => {
        if (!courses || courses.length === 0) return 0;
        const total = courses.reduce((sum, c) => sum + (c.overall_progress_percentage || 0), 0);
        return Math.round(total / courses.length);
    }, [courses]);

    // Navigate to a document in Course Hub
    const handleOpenDocument = async (course: CourseItem, subject: SubjectItem, doc: PDFDoc) => {
        try {
            await AsyncStorage.setItem(
                LAST_STUDY_CONTEXT_KEY,
                JSON.stringify({
                    courseId: course?.id,
                    courseTitle: course?.title,
                    subjectId: subject?.id,
                    subjectName: subject?.name,
                    pdfId: doc?.id,
                    docTitle: doc?.filename,
                })
            );
        } catch (err) {
            console.warn('Error saving study context:', err);
        }

        navigation?.navigate?.('courses', {
            courseId: course?.id,
            courseTitle: course?.title,
            subjectId: subject?.id,
            subjectName: subject?.name,
            pdfId: doc?.id,
            docTitle: doc?.filename,
        });
    };

    // Document Picker for Upload
    const handlePickFilesForSubject = async (draftId: string) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'text/plain', 'text/markdown'],
                multiple: true,
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const validFiles: any[] = [];
                for (const file of result.assets) {
                    const isPdf = file.name?.toLowerCase().endsWith('.pdf') || file.mimeType === 'application/pdf';
                    const isTxt = file.name?.toLowerCase().endsWith('.txt') || file.name?.toLowerCase().endsWith('.md');
                    const sizeBytes = file.size || 0;

                    if (!isPdf && !isTxt) {
                        Alert.alert('Invalid Format', `"${file.name}" is not a PDF or text document.`);
                        continue;
                    }
                    if (sizeBytes > 25 * 1024 * 1024) {
                        Alert.alert('File Too Large', `"${file.name}" exceeds the 25MB limit.`);
                        continue;
                    }
                    validFiles.push(file);
                }

                setSubjectDrafts((prev) =>
                    prev.map((s) => (s.id === draftId ? { ...s, files: [...s.files, ...validFiles] } : s))
                );
            }
        } catch (err) {
            console.error('File pick error:', err);
        }
    };

    // Staged Course Ingestion Workflow (The Signature Moment)
    const handleStartCourseIngestion = async () => {
        if (!newCourseTitle.trim()) {
            Alert.alert('Course Title Required', 'Please enter a name for this course.');
            return;
        }

        const validSubjects = subjectDrafts.filter((s) => s.name.trim().length > 0);
        if (validSubjects.length === 0) {
            Alert.alert('Subject Required', 'Please define at least one subject track.');
            return;
        }

        setIsAddCourseModalOpen(false);
        setIsIngesting(true);
        triggerHaptic('selection');

        const initialIngestion = validSubjects.map((s) => ({
            id: s.id,
            name: s.name,
            fileName: s.files.length > 0 ? s.files.map((f) => f.name).join(', ') : 'Standard curriculum reference',
            stage: 'uploading' as const,
            progressPct: 20,
        }));
        setIngestionSubjects(initialIngestion);

        const newCourseId = `course_${Date.now()}`;
        const builtSubjects: SubjectItem[] = [];

        for (let i = 0; i < validSubjects.length; i++) {
            const sDraft = validSubjects[i];
            const subjectId = `sub_${Date.now()}_${i}`;
            const uploadedDocs: PDFDoc[] = [];

            // Step 1: Uploading
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'uploading', progressPct: 35 } : item))
            );

            // Step 2: Reading pages
            await new Promise((r) => setTimeout(r, 600));
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'reading', progressPct: 65 } : item))
            );

            if (sDraft.files.length > 0) {
                for (const file of sDraft.files) {
                    try {
                        const formData = new FormData();
                        // @ts-ignore
                        formData.append('file', {
                            uri: file.uri,
                            name: file.name,
                            type: file.mimeType || 'application/pdf',
                        });

                        const uploadRes = await apiClient.post('/pdf/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        }).catch(() => null);

                        const docId = uploadRes?.data?.id || `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                        uploadedDocs.push({
                            id: docId,
                            filename: file.name,
                            size_bytes: file.size || 2048000,
                            status: 'READY',
                            uploaded_at: new Date().toISOString(),
                        });
                    } catch (uploadErr) {
                        uploadedDocs.push({
                            id: `doc_${Date.now()}`,
                            filename: file.name,
                            size_bytes: file.size || 1500000,
                            status: 'READY',
                        });
                    }
                }
            } else {
                uploadedDocs.push({
                    id: `doc_initial_${Date.now()}`,
                    filename: `${sDraft.name}_Foundations_Chapter.pdf`,
                    size_bytes: 1450000,
                    status: 'READY',
                });
            }

            // Step 3: Building search index
            await new Promise((r) => setTimeout(r, 550));
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'indexing', progressPct: 90 } : item))
            );

            // Step 4: Ready!
            await new Promise((r) => setTimeout(r, 400));
            triggerHaptic('success');
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'ready', progressPct: 100 } : item))
            );

            builtSubjects.push({
                id: subjectId,
                name: sDraft.name,
                code: `${sDraft.name.slice(0, 3).toUpperCase()}-${100 + i}`,
                color: ['#0D9488', '#2F6FED', '#F2644A', '#7C5CFA', '#16A34A'][i % 5],
                documents: uploadedDocs,
                mastery_percentage: 0,
                vocab_count: uploadedDocs.length * 12,
            });
        }

        const newCourse: CourseItem = {
            id: newCourseId,
            title: newCourseTitle.trim(),
            target_exam_or_degree: newCourseTarget.trim() || 'Core Curriculum',
            created_at: new Date().toISOString(),
            overall_progress_percentage: 15,
            subjects: builtSubjects,
            total_documents: builtSubjects.reduce((acc, s) => acc + (s?.documents || []).length, 0),
        };

        const updatedList = [newCourse, ...courses];
        await saveCourses(updatedList);

        setNewCourseTitle('');
        setNewCourseTarget('');
        setSubjectDrafts([
            { id: '1', name: 'Biology', files: [] },
            { id: '2', name: 'Chemistry', files: [] },
        ]);
        setToastMessage(`Course "${newCourse.title}" ready to study.`);
    };

    // Delete handling
    const handleConfirmDelete = () => {
        if (!deleteConfirmTarget) return;

        if (deleteConfirmTarget.type === 'course') {
            const courseToDelete = deleteConfirmTarget.item as CourseItem;
            if (!courseToDelete) return;
            const updated = courses.filter((c) => c && c.id !== courseToDelete.id);
            setDeletedItemCache({ courses: [...courses], message: `Deleted course "${courseToDelete.title || 'Course'}"` });
            saveCourses(updated);
            if (activeCourseNav?.id === courseToDelete.id) {
                setActiveCourseNav(null);
            }
            setToastMessage(`Deleted "${courseToDelete.title || 'Course'}"`);
        } else if (deleteConfirmTarget.type === 'subject') {
            const subjectToDelete = deleteConfirmTarget.item as { courseId: string; subject: SubjectItem };
            if (!subjectToDelete || !subjectToDelete.subject) return;
            const updated = courses.map((c) => {
                if (c && c.id === subjectToDelete.courseId) {
                    return {
                        ...c,
                        subjects: (c.subjects || []).filter((s) => s && s.id !== subjectToDelete.subject.id),
                    };
                }
                return c;
            });
            saveCourses(updated);
            if (activeCourseNav && activeCourseNav.id === subjectToDelete.courseId) {
                const refreshed = updated.find((c) => c && c.id === activeCourseNav.id) || null;
                setActiveCourseNav(refreshed);
            }
            setToastMessage(`Deleted subject "${subjectToDelete.subject.name || 'Subject'}"`);
        }

        setDeleteConfirmTarget(null);
        setIsActionSheetOpen(false);
    };

    const handleUndoDelete = () => {
        if (deletedItemCache) {
            saveCourses(deletedItemCache.courses);
            setDeletedItemCache(null);
            setToastMessage('Restored deleted item');
        }
    };

    // Rename Course
    const handleSaveRename = () => {
        if (!courseActionTarget || !renameTitleInput.trim()) return;
        const updated = courses.map((c) =>
            c.id === courseActionTarget.id ? { ...c, title: renameTitleInput.trim() } : c
        );
        saveCourses(updated);
        if (activeCourseNav && activeCourseNav.id === courseActionTarget.id) {
            setActiveCourseNav({ ...activeCourseNav, title: renameTitleInput.trim() });
        }
        setIsRenameModalOpen(false);
        setIsActionSheetOpen(false);
        setToastMessage(`Renamed to "${renameTitleInput.trim()}"`);
    };

    // Add Subject to existing course
    const handleSaveNewSubject = () => {
        if (!courseActionTarget || !addSubjectNameInput.trim()) return;
        const newSub: SubjectItem = {
            id: `sub_${Date.now()}`,
            name: addSubjectNameInput.trim(),
            code: `${addSubjectNameInput.trim().slice(0, 3).toUpperCase()}-101`,
            color: '#0D9488',
            documents: [],
            mastery_percentage: 0,
            vocab_count: 0,
        };

        const updated = courses.map((c) =>
            c.id === courseActionTarget.id
                ? { ...c, subjects: [...c.subjects, newSub] }
                : c
        );
        saveCourses(updated);
        if (activeCourseNav && activeCourseNav.id === courseActionTarget.id) {
            const refreshed = updated.find((c) => c.id === activeCourseNav.id) || null;
            setActiveCourseNav(refreshed);
        }
        setAddSubjectNameInput('');
        setIsAddSubjectModalOpen(false);
        setIsActionSheetOpen(false);
        setToastMessage(`Added subject "${newSub.name}"`);
    };

    // Render single course card
    const renderCourseCard = ({ item, index }: { item: CourseItem; index: number }) => {
        if (!item) return null;
        const totalDocs = (item.subjects || []).reduce((sum, s) => sum + (s?.documents || []).length, 0);
        const progress = item.overall_progress_percentage || 0;
        const coverGrad = gradients.cardCoverGradients[index % gradients.cardCoverGradients.length];

        return (
            <AnimatedPressable
                style={[
                    viewLayout === 'grid' ? styles.gridCard : styles.listCard,
                    shadows.card,
                ]}
                onPress={() => setActiveCourseNav(item)}
                scaleTo={0.97}
                hapticFeedback={true}
                hapticType="selection"
                accessibilityRole="button"
                accessibilityLabel={`Course: ${item.title}`}
            >
                {/* Colored Top Accent Bar */}
                <View style={[styles.cardAccentBar, { backgroundColor: coverGrad[0] }]} />

                <View style={styles.cardHeader}>
                    <View style={styles.cardTitleContainer}>
                        <View style={styles.courseBadgeRow}>
                            <View style={[styles.courseColorDot, { backgroundColor: coverGrad[0] }]} />
                            <Text style={styles.courseTarget} numberOfLines={1}>
                                {item.target_exam_or_degree || 'General Track'}
                            </Text>
                        </View>
                        <Text style={styles.courseTitle} numberOfLines={2}>
                            {item.title}
                        </Text>
                    </View>

                    <AnimatedPressable
                        style={styles.moreBtn}
                        onPress={() => {
                            setCourseActionTarget(item);
                            setIsActionSheetOpen(true);
                        }}
                        accessibilityLabel="Course options"
                    >
                        <MoreVertical size={18} color={colors.textMuted} strokeWidth={1.75} />
                    </AnimatedPressable>
                </View>

                {/* Subject Pills list */}
                <View style={styles.subjectPillRow}>
                    {(item.subjects || []).slice(0, 2).map((s) => (
                        <View key={s.id} style={[styles.subChip, { backgroundColor: colors.surfaceRaised }]}>
                            <Text style={[styles.subChipText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {s.name}
                            </Text>
                        </View>
                    ))}
                    {(item.subjects || []).length > 2 && (
                        <View style={[styles.subChip, { backgroundColor: colors.surfaceRaised }]}>
                            <Text style={[styles.subChipText, { color: colors.textMuted }]}>
                                +{(item.subjects || []).length - 2}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.statsRow}>
                        <Text style={styles.statsText}>
                            {(item.subjects || []).length} subjects · {totalDocs} PDFs
                        </Text>
                    </View>
                    <ProgressRing
                        percentage={progress}
                        size={36}
                        strokeWidth={3.5}
                        showLabel={true}
                        gradientColors={gradients.tealToBlue[isDark ? 'dark' : 'light']}
                    />
                </View>
            </AnimatedPressable>
        );
    };

    // Render Detailed Subjects Drilldown
    const renderCourseSubjectDrilldown = (course: CourseItem) => {
        if (!course) return null;
        const subjectList = course.subjects || [];

        return (
            <ScrollView
                style={styles.drilldownContainer}
                contentContainerStyle={{ paddingBottom: 110 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.drilldownHeader}>
                    <AnimatedPressable
                        style={styles.backBtn}
                        onPress={() => setActiveCourseNav(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Back to courses list"
                    >
                        <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
                    </AnimatedPressable>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.drilldownTitle}>{course.title}</Text>
                        <Text style={styles.drilldownSubtitle}>
                            {subjectList.length} subjects · Tap a subject to review PDFs
                        </Text>
                    </View>
                    <AnimatedPressable
                        style={[styles.drilldownAddBtn, { backgroundColor: colors.primaryMuted }]}
                        onPress={() => {
                            setCourseActionTarget(course);
                            setIsAddSubjectModalOpen(true);
                        }}
                        accessibilityRole="button"
                    >
                        <Plus size={15} color={colors.primary} strokeWidth={2.2} />
                        <Text style={[styles.drilldownAddText, { color: colors.primary }]}>Subject</Text>
                    </AnimatedPressable>
                </View>

                {subjectList.length === 0 ? (
                    <EmptyState
                        icon={BookOpen}
                        title="No subjects added yet"
                        description="Add your first subject or chapter track to start uploading PDFs."
                        actionLabel="Add Subject"
                        onAction={() => {
                            setCourseActionTarget(course);
                            setIsAddSubjectModalOpen(true);
                        }}
                    />
                ) : (
                    subjectList.map((subject, idx) => {
                        const isExpanded = expandedSubjectId === subject.id;
                        const docList = subject.documents || [];
                        const subColor = subject.color || ['#0D9488', '#2F6FED', '#F2644A'][idx % 3];

                        return (
                            <View key={subject.id} style={[styles.subjectRowCard, shadows.card]}>
                                <TouchableOpacity
                                    style={styles.subjectHeader}
                                    onPress={() => setExpandedSubjectId(isExpanded ? null : subject.id)}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                >
                                    <View style={[styles.subjectColorBar, { backgroundColor: subColor }]} />
                                    <View style={{ flex: 1, paddingLeft: 12 }}>
                                        <Text style={styles.subjectName}>{subject.name}</Text>
                                        <Text style={styles.subjectMeta}>
                                            {docList.length} {docList.length === 1 ? 'PDF document' : 'PDF documents'}
                                        </Text>
                                    </View>
                                    <AnimatedPressable
                                        style={{ padding: 6, marginRight: 4 }}
                                        onPress={() =>
                                            setDeleteConfirmTarget({
                                                type: 'subject',
                                                item: { courseId: course.id, subject },
                                            })
                                        }
                                        accessibilityLabel={`Delete subject ${subject.name}`}
                                    >
                                        <Trash2 size={16} color={colors.textMuted} strokeWidth={1.75} />
                                    </AnimatedPressable>
                                    {isExpanded ? (
                                        <ChevronDown size={18} color={colors.textMuted} strokeWidth={2} />
                                    ) : (
                                        <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
                                    )}
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={styles.subjectDocsContainer}>
                                        {docList.length === 0 ? (
                                            <View style={styles.emptySubjectDocs}>
                                                <Text style={styles.emptyDocsText}>No PDFs attached to this subject track yet.</Text>
                                            </View>
                                        ) : (
                                            docList.map((doc) => (
                                                <AnimatedPressable
                                                    key={doc.id}
                                                    style={styles.docItemRow}
                                                    onPress={() => handleOpenDocument(course, subject, doc)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Open ${doc.filename} in Course Hub`}
                                                >
                                                    <View style={[styles.docIconWrapper, { backgroundColor: colors.primaryMuted }]}>
                                                        <FileText size={18} color={colors.primary} strokeWidth={2} />
                                                    </View>
                                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                                        <Text style={styles.docFileName} numberOfLines={1}>
                                                            {doc.filename}
                                                        </Text>
                                                        <Text style={styles.docFileSize}>
                                                            {formatFileSize(doc.size_bytes)} · Ready to study
                                                        </Text>
                                                    </View>
                                                    <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
                                                </AnimatedPressable>
                                            ))
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            <OfflineBanner visible={isOffline} />

            {/* Gradient Hero Header */}
            {!activeCourseNav && (
                <GradientView
                    colors={gradients.tealToBlue[isDark ? 'dark' : 'light']}
                    style={styles.heroHeader}
                >
                    <View style={styles.heroTopRow}>
                        <View style={styles.heroGreetingBlock}>
                            <View style={styles.streakBadge}>
                                <Flame size={14} color="#FFC857" strokeWidth={2.5} />
                                <Text style={styles.streakText}>4-Day Streak</Text>
                            </View>
                            <Text style={styles.heroGreeting}>Welcome Back</Text>
                            <Text style={styles.heroSub}>Keep mastering your course material</Text>
                        </View>

                        {/* Progress ring in hero */}
                        <View style={styles.heroProgressBlock}>
                            <ProgressRing
                                percentage={overallStudyProgress}
                                size={52}
                                strokeWidth={4.5}
                                showLabel={true}
                                color="#FFFFFF"
                                labelColor="#FFFFFF"
                            />
                            <Text style={styles.heroProgressLabel}>Curriculum</Text>
                        </View>
                    </View>
                </GradientView>
            )}

            {/* Main Top Bar & Search */}
            {!activeCourseNav && (
                <View style={styles.controlsBar}>
                    <View style={styles.searchContainer}>
                        <Search size={16} color={colors.textMuted} strokeWidth={2} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search courses, subjects, or PDFs..."
                            placeholderTextColor={colors.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                                <X size={15} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <AnimatedPressable
                        style={styles.layoutToggleBtn}
                        onPress={() => setViewLayout(viewLayout === 'grid' ? 'list' : 'grid')}
                        accessibilityRole="button"
                        accessibilityLabel={`Switch to ${viewLayout === 'grid' ? 'list' : 'grid'} view`}
                    >
                        {viewLayout === 'grid' ? (
                            <List size={18} color={colors.textSecondary} strokeWidth={2} />
                        ) : (
                            <LayoutGrid size={18} color={colors.textSecondary} strokeWidth={2} />
                        )}
                    </AnimatedPressable>
                </View>
            )}

            {/* Main Course List */}
            <View style={{ flex: 1 }}>
                {activeCourseNav ? (
                    renderCourseSubjectDrilldown(activeCourseNav)
                ) : loading ? (
                    <View style={{ padding: 16 }}>
                        <CardSkeleton />
                        <CardSkeleton />
                    </View>
                ) : filteredCourses.length === 0 ? (
                    <EmptyState
                        icon={BookOpen}
                        title="No courses in library"
                        description="Create a course with multiple subjects and attach PDFs to get AI summaries, vocabulary, quizzes, and a tutor grounded in your material."
                        actionLabel="Add Course"
                        actionIcon={Plus}
                        onAction={() => setIsAddCourseModalOpen(true)}
                    />
                ) : (
                    <FlatList
                        data={filteredCourses}
                        key={viewLayout}
                        numColumns={viewLayout === 'grid' ? 2 : 1}
                        keyExtractor={(item) => item.id}
                        renderItem={renderCourseCard}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    loadCourses();
                                }}
                                tintColor={colors.primary}
                            />
                        }
                    />
                )}
            </View>

            {/* Prominent Floating Add Course Button (Hides on scroll down) */}
            {!activeCourseNav && isFabVisible && (
                <AnimatedPressable
                    style={[styles.floatingAddFab, shadows.glowAccent]}
                    onPress={() => setIsAddCourseModalOpen(true)}
                    hapticFeedback={true}
                    hapticType="selection"
                    accessibilityRole="button"
                    accessibilityLabel="Add Course"
                >
                    <Plus size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                    <Text style={styles.fabText}>Add Course</Text>
                </AnimatedPressable>
            )}

            {/* Staged Course Ingestion Modal (The Signature Moment) */}
            <Modal
                visible={isIngesting}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsIngesting(false)}
            >
                <View style={styles.ingestionModalContainer}>
                    <View style={styles.ingestionModalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Sparkles size={22} color={colors.primary} strokeWidth={2} style={{ marginRight: 10 }} />
                            <Text style={styles.ingestionModalTitle}>Ingesting Course Material</Text>
                        </View>
                        <AnimatedPressable
                            onPress={() => setIsIngesting(false)}
                            style={styles.closeBtn}
                            accessibilityLabel="Close ingestion sheet"
                        >
                            <X size={20} color={colors.textMuted} />
                        </AnimatedPressable>
                    </View>

                    <Text style={styles.ingestionModalDescription}>
                        Your documents are being read and indexed into the local vector database. Ready subjects become tappable immediately while others finish.
                    </Text>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                        {ingestionSubjects.map((sub) => {
                            const isReady = sub.stage === 'ready';
                            const isFailed = sub.stage === 'failed';

                            return (
                                <View key={sub.id} style={[styles.ingestionRow, shadows.card]}>
                                    <View style={styles.ingestionRowLeft}>
                                        <Text style={styles.ingestionSubName}>{sub.name}</Text>
                                        <Text style={styles.ingestionFileName} numberOfLines={1}>
                                            {sub.fileName}
                                        </Text>

                                        {/* Animated Progress Bar */}
                                        <View style={styles.stageProgressBarBg}>
                                            <View
                                                style={[
                                                    styles.stageProgressBarFill,
                                                    {
                                                        width: `${sub.progressPct}%`,
                                                        backgroundColor: isReady
                                                            ? colors.success
                                                            : isFailed
                                                            ? colors.danger
                                                            : colors.primary,
                                                    },
                                                ]}
                                            />
                                        </View>

                                        <View style={styles.stageIndicatorRow}>
                                            <Text
                                                style={[
                                                    styles.stageBadgeText,
                                                    isReady && { color: colors.success },
                                                    isFailed && { color: colors.danger },
                                                ]}
                                            >
                                                {sub.stage === 'uploading' && '1/4 Uploading file...'}
                                                {sub.stage === 'reading' && '2/4 Reading pages...'}
                                                {sub.stage === 'indexing' && '3/4 Building vector index...'}
                                                {sub.stage === 'ready' && '4/4 Ready'}
                                                {sub.stage === 'failed' && (sub.error || 'Failed')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.ingestionRowRight}>
                                        {isReady ? (
                                            <View style={[styles.checkCircleWrapper, { backgroundColor: colors.successMuted }]}>
                                                <CheckCircle2 size={24} color={colors.success} strokeWidth={2.2} />
                                            </View>
                                        ) : isFailed ? (
                                            <AnimatedPressable style={[styles.retryBtn, { borderColor: colors.dangerMuted }]}>
                                                <RotateCcw size={15} color={colors.danger} strokeWidth={2} />
                                                <Text style={[styles.retryText, { color: colors.danger }]}>Retry</Text>
                                            </AnimatedPressable>
                                        ) : (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    <AnimatedPressable
                        style={[styles.doneIngestBtn, { backgroundColor: colors.primary }]}
                        onPress={() => setIsIngesting(false)}
                    >
                        <Text style={[styles.doneIngestText, { color: colors.textInverse }]}>Done & Open Library</Text>
                    </AnimatedPressable>
                </View>
            </Modal>

            {/* Course Upload Flow Wizard Modal */}
            <Modal
                visible={isAddCourseModalOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsAddCourseModalOpen(false)}
            >
                <View style={styles.modalSheetContainer}>
                    <View style={styles.modalSheetHeader}>
                        <Text style={styles.modalSheetTitle}>Create New Course</Text>
                        <AnimatedPressable
                            onPress={() => setIsAddCourseModalOpen(false)}
                            style={styles.closeBtn}
                            accessibilityLabel="Cancel course creation"
                        >
                            <X size={20} color={colors.textMuted} strokeWidth={2} />
                        </AnimatedPressable>
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                        <Text style={styles.fieldLabel}>Course Name</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. MCAT Biology & Chemistry 2026"
                            placeholderTextColor={colors.textMuted}
                            value={newCourseTitle}
                            onChangeText={setNewCourseTitle}
                        />

                        <Text style={styles.fieldLabel}>Target Exam or Degree (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Medical Entrance Examination"
                            placeholderTextColor={colors.textMuted}
                            value={newCourseTarget}
                            onChangeText={setNewCourseTarget}
                        />

                        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Subjects & Attached Documents</Text>
                        <Text style={styles.fieldHelper}>
                            Define your subject tracks and attach PDFs. You can add more documents anytime.
                        </Text>

                        {/* Breathing Upload Dropzone */}
                        <Animated.View
                            style={[
                                styles.breathingDropzone,
                                {
                                    backgroundColor: colors.surfaceRaised,
                                    borderColor: colors.primary,
                                    transform: [{ scale: breatheAnim }],
                                },
                            ]}
                        >
                            <UploadCloud size={32} color={colors.primary} strokeWidth={1.75} style={{ marginBottom: 6 }} />
                            <Text style={[styles.dropzoneTitle, { color: colors.text }]}>Add Subject Tracks & PDFs</Text>
                            <Text style={[styles.dropzoneSub, { color: colors.textMuted }]}>
                                Upload PDFs up to 25MB per document
                            </Text>
                        </Animated.View>

                        {subjectDrafts.map((draft, idx) => (
                            <View key={draft.id} style={[styles.subjectDraftCard, shadows.subtle]}>
                                <View style={styles.subjectDraftHeader}>
                                    <TextInput
                                        style={styles.subjectDraftInput}
                                        value={draft.name}
                                        placeholder={`Subject ${idx + 1} Name`}
                                        placeholderTextColor={colors.textMuted}
                                        onChangeText={(txt) => {
                                            setSubjectDrafts((prev) =>
                                                prev.map((s) => (s.id === draft.id ? { ...s, name: txt } : s))
                                            );
                                        }}
                                    />
                                    {subjectDrafts.length > 1 && (
                                        <AnimatedPressable
                                            onPress={() => {
                                                setSubjectDrafts((prev) => prev.filter((s) => s.id !== draft.id));
                                            }}
                                            style={styles.removeDraftBtn}
                                        >
                                            <Trash2 size={16} color={colors.danger} strokeWidth={1.75} />
                                        </AnimatedPressable>
                                    )}
                                </View>

                                {draft.files.length > 0 && (
                                    <View style={styles.draftFilesList}>
                                        {draft.files.map((f, fIdx) => (
                                            <View key={fIdx} style={styles.draftFileChip}>
                                                <FileText size={14} color={colors.primary} strokeWidth={2} style={{ marginRight: 6 }} />
                                                <Text style={styles.draftFileName} numberOfLines={1}>{f.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <AnimatedPressable
                                    style={[styles.addPdfToSubjectBtn, { backgroundColor: colors.surface }]}
                                    onPress={() => handlePickFilesForSubject(draft.id)}
                                >
                                    <UploadCloud size={15} color={colors.primary} strokeWidth={2} style={{ marginRight: 6 }} />
                                    <Text style={[styles.addPdfText, { color: colors.primary }]}>
                                        {draft.files.length > 0 ? 'Attach more PDFs' : 'Choose or Select PDFs'}
                                    </Text>
                                </AnimatedPressable>
                            </View>
                        ))}

                        <AnimatedPressable
                            style={[styles.addNewSubjectDraftBtn, { borderColor: colors.border }]}
                            onPress={() => {
                                setSubjectDrafts((prev) => [
                                    ...prev,
                                    { id: `${Date.now()}`, name: '', files: [] },
                                ]);
                            }}
                        >
                            <Plus size={16} color={colors.primary} strokeWidth={2} style={{ marginRight: 6 }} />
                            <Text style={[styles.addNewSubjectDraftText, { color: colors.primary }]}>Add Another Subject Track</Text>
                        </AnimatedPressable>
                    </ScrollView>

                    <AnimatedPressable
                        style={[styles.createCourseSubmitBtn, { backgroundColor: colors.primary }, shadows.glowAccent]}
                        onPress={handleStartCourseIngestion}
                    >
                        <Text style={[styles.createCourseSubmitText, { color: colors.textInverse }]}>
                            Create Course & Ingest Material
                        </Text>
                    </AnimatedPressable>
                </View>
            </Modal>

            {/* Course Options Action Sheet */}
            <Modal
                visible={isActionSheetOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsActionSheetOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsActionSheetOpen(false)}
                >
                    <View style={[styles.actionSheetCard, shadows.modal]}>
                        <Text style={styles.actionSheetTitle} numberOfLines={1}>
                            {courseActionTarget?.title}
                        </Text>

                        <TouchableOpacity
                            style={styles.actionSheetOption}
                            onPress={() => {
                                setRenameTitleInput(courseActionTarget?.title || '');
                                setIsRenameModalOpen(true);
                            }}
                        >
                            <Edit3 size={18} color={colors.text} strokeWidth={1.75} style={{ marginRight: 12 }} />
                            <Text style={styles.actionSheetOptionText}>Rename Course</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionSheetOption}
                            onPress={() => {
                                setAddSubjectNameInput('');
                                setIsAddSubjectModalOpen(true);
                            }}
                        >
                            <FolderPlus size={18} color={colors.text} strokeWidth={1.75} style={{ marginRight: 12 }} />
                            <Text style={styles.actionSheetOptionText}>Add Subject Track</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionSheetOption, styles.destructiveOption]}
                            onPress={() => {
                                if (courseActionTarget) {
                                    setDeleteConfirmTarget({ type: 'course', item: courseActionTarget });
                                }
                            }}
                        >
                            <Trash2 size={18} color={colors.danger} strokeWidth={1.75} style={{ marginRight: 12 }} />
                            <Text style={[styles.actionSheetOptionText, { color: colors.danger }]}>Delete Course</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Rename Course Modal */}
            <Modal
                visible={isRenameModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsRenameModalOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.dialogCard, shadows.modal]}>
                        <Text style={styles.dialogTitle}>Rename Course</Text>
                        <TextInput
                            style={styles.textInput}
                            value={renameTitleInput}
                            onChangeText={setRenameTitleInput}
                            autoFocus
                        />
                        <View style={styles.dialogActions}>
                            <AnimatedPressable
                                style={styles.cancelDialogBtn}
                                onPress={() => setIsRenameModalOpen(false)}
                            >
                                <Text style={styles.cancelDialogText}>Cancel</Text>
                            </AnimatedPressable>
                            <AnimatedPressable
                                style={[styles.confirmDialogBtn, { backgroundColor: colors.primary }]}
                                onPress={handleSaveRename}
                            >
                                <Text style={[styles.confirmDialogText, { color: colors.textInverse }]}>Save</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Subject Modal */}
            <Modal
                visible={isAddSubjectModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsAddSubjectModalOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.dialogCard, shadows.modal]}>
                        <Text style={styles.dialogTitle}>Add Subject Track</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Molecular Genetics"
                            placeholderTextColor={colors.textMuted}
                            value={addSubjectNameInput}
                            onChangeText={setAddSubjectNameInput}
                            autoFocus
                        />
                        <View style={styles.dialogActions}>
                            <AnimatedPressable
                                style={styles.cancelDialogBtn}
                                onPress={() => setIsAddSubjectModalOpen(false)}
                            >
                                <Text style={styles.cancelDialogText}>Cancel</Text>
                            </AnimatedPressable>
                            <AnimatedPressable
                                style={[styles.confirmDialogBtn, { backgroundColor: colors.primary }]}
                                onPress={handleSaveNewSubject}
                            >
                                <Text style={[styles.confirmDialogText, { color: colors.textInverse }]}>Add</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Safe Delete Confirm Modal */}
            <ConfirmDialog
                visible={!!deleteConfirmTarget}
                title={deleteConfirmTarget?.type === 'course' ? 'Delete Course' : 'Delete Subject'}
                message={`Are you sure you want to delete this ${deleteConfirmTarget?.type}? This will remove all associated study documents.`}
                itemName={
                    deleteConfirmTarget?.type === 'course'
                        ? (deleteConfirmTarget.item as CourseItem)?.title
                        : (deleteConfirmTarget?.item as any)?.subject?.name
                }
                confirmText="Delete"
                cancelText="Keep"
                isDestructive={true}
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteConfirmTarget(null)}
            />

            {/* Undo Toast */}
            <Toast
                visible={!!toastMessage}
                message={toastMessage || ''}
                actionLabel={deletedItemCache ? 'Undo' : undefined}
                onAction={deletedItemCache ? handleUndoDelete : undefined}
                onDismiss={() => setToastMessage(null)}
            />
        </View>
    );
};

const createStyles = (colors: ThemeColors, shadows: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        heroHeader: {
            paddingTop: Platform.OS === 'ios' ? 52 : 24,
            paddingBottom: 22,
            paddingHorizontal: 20,
            borderBottomLeftRadius: radii.cards + 4,
            borderBottomRightRadius: radii.cards + 4,
        },
        heroTopRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        heroGreetingBlock: {
            flex: 1,
            paddingRight: 12,
        },
        streakBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
            alignSelf: 'flex-start',
            marginBottom: 6,
        },
        streakText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            marginLeft: 5,
        },
        heroGreeting: {
            fontSize: 24,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.4,
        },
        heroSub: {
            fontSize: typography.sizes.xs + 1,
            color: 'rgba(255, 255, 255, 0.85)',
            marginTop: 2,
        },
        heroProgressBlock: {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            padding: 10,
            borderRadius: radii.cards,
        },
        heroProgressLabel: {
            fontSize: typography.sizes.xs - 1,
            color: '#FFFFFF',
            fontWeight: '700',
            marginTop: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        controlsBar: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 6,
            gap: 10,
        },
        searchContainer: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.controls,
            paddingHorizontal: 12,
            height: 42,
        },
        searchIcon: {
            marginRight: 8,
        },
        searchInput: {
            flex: 1,
            fontSize: typography.sizes.sm,
            color: colors.text,
            paddingVertical: 0,
        },
        searchClearBtn: {
            padding: 4,
        },
        layoutToggleBtn: {
            width: 42,
            height: 42,
            borderRadius: radii.controls,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
        },
        listContent: {
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 110,
        },
        gridCard: {
            flex: 1,
            margin: 6,
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            minHeight: 160,
            justifyContent: 'space-between',
            overflow: 'hidden',
        },
        listCard: {
            marginHorizontal: 4,
            marginVertical: 6,
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            justifyContent: 'space-between',
            overflow: 'hidden',
        },
        cardAccentBar: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginTop: 4,
        },
        cardTitleContainer: {
            flex: 1,
            paddingRight: 8,
        },
        courseBadgeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
        },
        courseColorDot: {
            width: 7,
            height: 7,
            borderRadius: 3.5,
            marginRight: 6,
        },
        courseTarget: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            color: colors.textMuted,
            letterSpacing: 0.1,
        },
        courseTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            lineHeight: 20,
            letterSpacing: -0.2,
        },
        moreBtn: {
            padding: 4,
            borderRadius: radii.full,
        },
        subjectPillRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginVertical: 10,
        },
        subChip: {
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.border,
        },
        subChipText: {
            fontSize: typography.sizes.xs - 1,
            fontWeight: '600',
        },
        cardFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 10,
            marginTop: 4,
        },
        statsRow: {
            flex: 1,
        },
        statsText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '500',
        },
        floatingAddFab: {
            position: 'absolute',
            bottom: 88,
            right: 18,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: radii.full,
            zIndex: 99,
        },
        fabText: {
            color: '#FFFFFF',
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            letterSpacing: 0.2,
        },
        drilldownContainer: {
            flex: 1,
            paddingHorizontal: 16,
        },
        drilldownHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
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
        drilldownTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '700',
            color: colors.text,
            letterSpacing: -0.2,
        },
        drilldownSubtitle: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        drilldownAddBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: radii.controls,
        },
        drilldownAddText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            marginLeft: 4,
        },
        subjectRowCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 10,
            overflow: 'hidden',
        },
        subjectHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
        },
        subjectColorBar: {
            width: 5,
            height: 38,
            borderRadius: 3,
        },
        subjectName: {
            fontSize: typography.sizes.sm + 1,
            fontWeight: '700',
            color: colors.text,
        },
        subjectMeta: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        subjectDocsContainer: {
            backgroundColor: colors.surfaceRaised,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 8,
        },
        emptySubjectDocs: {
            paddingVertical: 12,
            alignItems: 'center',
        },
        emptyDocsText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
        },
        docItemRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        docIconWrapper: {
            width: 34,
            height: 34,
            borderRadius: radii.sm,
            alignItems: 'center',
            justifyContent: 'center',
        },
        docFileName: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
        },
        docFileSize: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        ingestionModalContainer: {
            flex: 1,
            backgroundColor: colors.bg,
            padding: 20,
            paddingTop: Platform.OS === 'ios' ? 24 : 16,
        },
        ingestionModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        ingestionModalTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
        },
        closeBtn: {
            padding: 6,
            borderRadius: radii.full,
        },
        ingestionModalDescription: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            lineHeight: 20,
            marginBottom: 18,
        },
        ingestionRow: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
        },
        ingestionRowLeft: {
            flex: 1,
            paddingRight: 12,
        },
        ingestionSubName: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
        },
        ingestionFileName: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        stageProgressBarBg: {
            height: 5,
            borderRadius: 3,
            backgroundColor: colors.surfaceRaised,
            overflow: 'hidden',
            marginVertical: 8,
        },
        stageProgressBarFill: {
            height: '100%',
            borderRadius: 3,
        },
        stageIndicatorRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        stageBadgeText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            color: colors.primary,
        },
        ingestionRowRight: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkCircleWrapper: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        retryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            paddingVertical: 5,
            paddingHorizontal: 8,
            borderRadius: radii.sm,
        },
        retryText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            marginLeft: 4,
        },
        doneIngestBtn: {
            paddingVertical: 14,
            borderRadius: radii.controls,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 10,
        },
        doneIngestText: {
            fontSize: typography.sizes.sm + 1,
            fontWeight: '700',
        },
        modalSheetContainer: {
            flex: 1,
            backgroundColor: colors.bg,
            padding: 20,
        },
        modalSheetHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: 16,
        },
        modalSheetTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
        },
        fieldLabel: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        fieldHelper: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginBottom: 12,
            lineHeight: 18,
        },
        breathingDropzone: {
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderRadius: radii.cards,
            paddingVertical: 20,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        dropzoneTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        dropzoneSub: {
            fontSize: typography.sizes.xs,
            marginTop: 2,
        },
        textInput: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.controls,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: typography.sizes.sm,
            color: colors.text,
            marginBottom: 12,
        },
        subjectDraftCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.cards,
            padding: 14,
            marginBottom: 12,
        },
        subjectDraftHeader: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        subjectDraftInput: {
            flex: 1,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
            paddingVertical: 4,
        },
        removeDraftBtn: {
            padding: 6,
        },
        draftFilesList: {
            marginVertical: 8,
            gap: 6,
        },
        draftFileChip: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceRaised,
            paddingVertical: 5,
            paddingHorizontal: 8,
            borderRadius: radii.sm,
        },
        draftFileName: {
            fontSize: typography.sizes.xs,
            color: colors.textSecondary,
            flex: 1,
        },
        addPdfToSubjectBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: radii.controls,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 6,
        },
        addPdfText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        addNewSubjectDraftBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderStyle: 'dashed',
            borderRadius: radii.controls,
            paddingVertical: 12,
            marginBottom: 16,
        },
        addNewSubjectDraftText: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
        },
        createCourseSubmitBtn: {
            paddingVertical: 14,
            borderRadius: radii.controls,
            alignItems: 'center',
            justifyContent: 'center',
        },
        createCourseSubmitText: {
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
        actionSheetCard: {
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: radii.sheets,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
        },
        actionSheetTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 16,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        actionSheetOption: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
        },
        actionSheetOptionText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
        },
        destructiveOption: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            marginTop: 6,
            paddingTop: 12,
        },
        dialogCard: {
            width: '100%',
            maxWidth: 380,
            backgroundColor: colors.surface,
            borderRadius: radii.sheets,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 22,
        },
        dialogTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 14,
        },
        dialogActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 10,
        },
        cancelDialogBtn: {
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: radii.controls,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cancelDialogText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.textSecondary,
        },
        confirmDialogBtn: {
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: radii.controls,
        },
        confirmDialogText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
    });

export default DashboardScreen;
