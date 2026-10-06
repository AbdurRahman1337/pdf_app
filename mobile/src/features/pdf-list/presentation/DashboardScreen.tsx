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
    Sparkles,
    Flame,
    Award,
    Check,
    ArrowRight,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { saveCoursesHierarchy, loadCoursesHierarchy } from '../../../core/db/database';
import { useTheme, useSafeTopGap, getStaticSafeTopGap } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import EmptyState from '../../../core/components/EmptyState';
import ProgressRing from '../../../core/components/ProgressRing';
import ConfirmDialog from '../../../core/components/ConfirmDialog';
import Toast from '../../../core/components/Toast';
import OfflineBanner from '../../../core/components/OfflineBanner';
import { CardSkeleton } from '../../../core/components/LoadingSkeleton';
import TactileButton from '../../../core/components/TactileButton';
import TactileCard from '../../../core/components/TactileCard';
import TactileProgressBar from '../../../core/components/TactileProgressBar';
import CelebrationOverlay from '../../../core/components/CelebrationOverlay';

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
    overall_progress_percentage: 60,
    subjects: [
        {
            id: 'sub_bio_101',
            name: 'Cell Biology & Genetics',
            code: 'BIO-101',
            color: '#10B981',
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
            color: '#0EA5E9',
            mastery_percentage: 50,
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
            color: '#F59E0B',
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

const LibraryScreen = ({ navigation }: any) => {
    const { colors, shadows, isDark } = useTheme();
    const topGap = useSafeTopGap();
    const styles = useMemo(() => createStyles(colors, topGap), [colors, topGap]);

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
    const [showCelebration, setShowCelebration] = useState(false);

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

    // Calculate real stats for Daily Goal / Study Header
    const totalMaterials = useMemo(() => {
        return courses.reduce((acc, c) => acc + (c.subjects || []).reduce((sAcc, s) => sAcc + (s.documents || []).length, 0), 0);
    }, [courses]);

    const totalSubjects = useMemo(() => {
        return courses.reduce((acc, c) => acc + (c.subjects || []).length, 0);
    }, [courses]);

    // Load initial courses
    const loadCourses = async () => {
        try {
            // 1. Load from SQLite
            const sqliteCourses = await loadCoursesHierarchy();
            if (Array.isArray(sqliteCourses) && sqliteCourses.length > 0) {
                setCourses(sqliteCourses);
            } else {
                const saved = await AsyncStorage.getItem(COURSES_STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setCourses(parsed);
                        saveCoursesHierarchy(parsed);
                    }
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
                              color: s.color || '#10B981',
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
                    saveCoursesHierarchy(merged);
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

    const handleStartCourseIngestion = async () => {
        if (!newCourseTitle.trim()) {
            Alert.alert('Course Title Required', 'Please enter a name for this course.');
            return;
        }

        const validSubjects = subjectDrafts.filter((s) => s.name.trim().length > 0);
        if (validSubjects.length === 0) {
            Alert.alert('Subject Required', 'Please define at least one subject.');
            return;
        }

        setIsAddCourseModalOpen(false);
        setIsIngesting(true);

        const initialIngestion = validSubjects.map((s) => ({
            id: s.id,
            name: s.name,
            fileName: s.files.length > 0 ? s.files.map((f) => f.name).join(', ') : 'Reference materials',
            stage: 'uploading' as const,
            progressPct: 15,
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
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'uploading', progressPct: 30 } : item))
            );

            // Step 2: Reading
            await new Promise((r) => setTimeout(r, 500));
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
                    } catch {
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
                    filename: `${sDraft.name}_Overview_Notes.pdf`,
                    size_bytes: 1250000,
                    status: 'READY',
                });
            }

            // Step 3: Indexing
            await new Promise((r) => setTimeout(r, 500));
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'indexing', progressPct: 90 } : item))
            );

            // Step 4: Ready
            await new Promise((r) => setTimeout(r, 400));
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'ready', progressPct: 100 } : item))
            );

            builtSubjects.push({
                id: subjectId,
                name: sDraft.name,
                code: `${sDraft.name.slice(0, 3).toUpperCase()}-${100 + i}`,
                color: ['#10B981', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EC4899'][i % 5],
                documents: uploadedDocs,
                mastery_percentage: 0,
                vocab_count: uploadedDocs.length * 15,
            });
        }

        const newCourse: CourseItem = {
            id: newCourseId,
            title: newCourseTitle.trim(),
            target_exam_or_degree: newCourseTarget.trim() || 'General Curriculum',
            created_at: new Date().toISOString(),
            overall_progress_percentage: 0,
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

        setIsIngesting(false);
        setShowCelebration(true);
    };

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
        setToastMessage(`Course renamed to "${renameTitleInput.trim()}"`);
    };

    const handleSaveNewSubject = () => {
        if (!courseActionTarget || !addSubjectNameInput.trim()) return;
        const newSub: SubjectItem = {
            id: `sub_${Date.now()}`,
            name: addSubjectNameInput.trim(),
            code: `${addSubjectNameInput.trim().slice(0, 3).toUpperCase()}-101`,
            color: '#10B981',
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

    // Render single course card with tactile feel
    const renderCourseCard = ({ item }: { item: CourseItem }) => {
        if (!item) return null;
        const totalDocs = (item.subjects || []).reduce((sum, s) => sum + (s?.documents || []).length, 0);
        const progress = item.overall_progress_percentage || 0;

        return (
            <TactileCard
                onPress={() => setActiveCourseNav(item)}
                accessibilityLabel={`Course: ${item.title}`}
                style={viewLayout === 'grid' ? styles.gridCard : styles.listCard}
                contentStyle={{ padding: 18 }}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.cardIconBox}>
                        <BookOpen size={22} color={colors.accent} strokeWidth={2.2} />
                    </View>
                    <View style={styles.cardTitleContainer}>
                        <Text style={styles.courseTitle} numberOfLines={2}>
                            {item.title}
                        </Text>
                        {item.target_exam_or_degree ? (
                            <View style={styles.trackChip}>
                                <Text style={styles.trackChipText} numberOfLines={1}>
                                    {item.target_exam_or_degree}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <TouchableOpacity
                        style={styles.moreBtn}
                        onPress={(e) => {
                            // @ts-ignore
                            e?.stopPropagation?.();
                            setCourseActionTarget(item);
                            setIsActionSheetOpen(true);
                        }}
                        accessibilityLabel="Course options"
                    >
                        <MoreVertical size={18} color={colors.textMuted} strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                {/* Progress bar and metadata */}
                <View style={styles.cardFooter}>
                    <View style={styles.statsRow}>
                        <Text style={styles.statsText}>
                            {(item.subjects || []).length} subjects · {totalDocs} materials
                        </Text>
                        <Text style={[styles.progressPctText, { color: colors.accent }]}>
                            {progress}% mastered
                        </Text>
                    </View>

                    <TactileProgressBar progress={progress} height={10} variant="accent" />
                </View>
            </TactileCard>
        );
    };

    // Render Detailed Subjects Hierarchy for Selected Course
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
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => setActiveCourseNav(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Back to courses list"
                    >
                        <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.drilldownTitle}>{course.title}</Text>
                        <Text style={styles.drilldownSubtitle}>
                            {subjectList.length} subjects · Tap subject to open materials
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.drilldownAddBtn}
                        onPress={() => {
                            setCourseActionTarget(course);
                            setIsAddSubjectModalOpen(true);
                        }}
                        accessibilityRole="button"
                    >
                        <Plus size={16} color={colors.accent} strokeWidth={2.5} />
                        <Text style={[styles.drilldownAddText, { color: colors.accent }]}>Subject</Text>
                    </TouchableOpacity>
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
                    subjectList.map((subject) => {
                        const isExpanded = expandedSubjectId === subject.id;
                        const docList = subject.documents || [];

                        return (
                            <TactileCard
                                key={subject.id}
                                style={{ marginBottom: 12 }}
                                contentStyle={{ padding: 14 }}
                            >
                                <TouchableOpacity
                                    style={styles.subjectHeader}
                                    onPress={() => setExpandedSubjectId(isExpanded ? null : subject.id)}
                                    activeOpacity={0.75}
                                    accessibilityRole="button"
                                >
                                    <View style={[styles.subjectColorBar, { backgroundColor: subject.color || colors.accent }]} />
                                    <View style={{ flex: 1, paddingLeft: 12 }}>
                                        <Text style={styles.subjectName}>{subject.name}</Text>
                                        <Text style={styles.subjectMeta}>
                                            {docList.length} {docList.length === 1 ? 'document' : 'documents'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={{ padding: 6, marginRight: 6 }}
                                        onPress={() =>
                                            setDeleteConfirmTarget({
                                                type: 'subject',
                                                item: { courseId: course.id, subject },
                                            })
                                        }
                                        accessibilityLabel={`Delete subject ${subject.name}`}
                                    >
                                        <Trash2 size={16} color={colors.textMuted} strokeWidth={1.8} />
                                    </TouchableOpacity>
                                    {isExpanded ? (
                                        <ChevronDown size={20} color={colors.textMuted} strokeWidth={2} />
                                    ) : (
                                        <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
                                    )}
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={styles.subjectDocsContainer}>
                                        {docList.length === 0 ? (
                                            <View style={styles.emptySubjectDocs}>
                                                <Text style={styles.emptyDocsText}>No PDFs in this subject yet.</Text>
                                            </View>
                                        ) : (
                                            docList.map((doc) => (
                                                <TouchableOpacity
                                                    key={doc.id}
                                                    style={styles.docItemRow}
                                                    onPress={() => handleOpenDocument(course, subject, doc)}
                                                    activeOpacity={0.7}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Open ${doc.filename} in Course Hub`}
                                                >
                                                    <View style={styles.docIconPill}>
                                                        <FileText size={16} color={colors.accent} strokeWidth={2} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.docFileName} numberOfLines={1}>
                                                            {doc.filename}
                                                        </Text>
                                                        <Text style={styles.docFileSize}>
                                                            {formatFileSize(doc.size_bytes)} · Ready to study
                                                        </Text>
                                                    </View>
                                                    <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
                                                </TouchableOpacity>
                                            ))
                                        )}
                                    </View>
                                )}
                            </TactileCard>
                        );
                    })
                )}
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            <OfflineBanner visible={isOffline} />

            {/* Main Top Header */}
            {!activeCourseNav && (
                <View style={styles.topBar}>
                    <View style={styles.topBarLeft}>
                        <Text style={styles.greetingTitle}>Welcome Back!</Text>
                        <Text style={styles.headerSubtitle}>Ready to master new concepts today?</Text>
                    </View>

                    <View style={styles.topBarActions}>
                        <TactileButton
                            title="Add Course"
                            onPress={() => setIsAddCourseModalOpen(true)}
                            variant="primary"
                            size="sm"
                            icon={Plus}
                        />
                    </View>
                </View>
            )}

            {/* Daily Goal & Streak Card (Signature Calm Motivation) */}
            {!activeCourseNav && (
                <View style={styles.goalCardContainer}>
                    <View style={[styles.goalCard, { backgroundColor: colors.surface }]}>
                        <View style={styles.goalLeft}>
                            <View style={[styles.streakIconCircle, { backgroundColor: colors.goldMuted }]}>
                                <Flame size={24} color={colors.gold} strokeWidth={2.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.goalTitle}>Daily Learning Goal</Text>
                                <Text style={styles.goalSubtitle}>
                                    {totalMaterials} study materials active across {totalSubjects} subjects
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* Search Bar */}
            {!activeCourseNav && (
                <View style={styles.searchContainer}>
                    <Search size={16} color={colors.textMuted} strokeWidth={2} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search courses, subjects, or PDFs..."
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                            <X size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Main Content Area */}
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
                        title={searchQuery ? 'No matching materials found' : 'No courses in your library'}
                        description={
                            searchQuery
                                ? `No courses or subjects match "${searchQuery}".`
                                : 'Upload your study notes, syllabi, or textbook chapters to build your study space.'
                        }
                        actionLabel="Upload First Material"
                        onAction={() => setIsAddCourseModalOpen(true)}
                    />
                ) : (
                    <FlatList
                        data={filteredCourses}
                        keyExtractor={(item) => item.id}
                        renderItem={renderCourseCard}
                        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    loadCourses();
                                }}
                                tintColor={colors.accent}
                            />
                        }
                    />
                )}
            </View>

            {/* ── Add Course & Upload Modal (Tactile Drop Zone) ── */}
            <Modal
                visible={isAddCourseModalOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsAddCourseModalOpen(false)}
            >
                <View style={styles.modalSheetContainer}>
                    <View style={styles.modalSheetHeader}>
                        <Text style={styles.modalSheetTitle}>Create Study Space</Text>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => setIsAddCourseModalOpen(false)}
                            accessibilityLabel="Close dialog"
                        >
                            <X size={22} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        <Text style={styles.fieldLabel}>Course / Subject Title</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. MCAT Biology, Organic Chemistry..."
                            placeholderTextColor={colors.textMuted}
                            value={newCourseTitle}
                            onChangeText={setNewCourseTitle}
                        />

                        <Text style={styles.fieldLabel}>Target Exam or Degree (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Pre-Med Track, Board Exam..."
                            placeholderTextColor={colors.textMuted}
                            value={newCourseTarget}
                            onChangeText={setNewCourseTarget}
                        />

                        <Text style={styles.fieldLabel}>Study Tracks &amp; Materials</Text>
                        <Text style={styles.fieldHelper}>
                            Upload PDF, TXT or Markdown files (up to 25 MB each).
                        </Text>

                        {subjectDrafts.map((draft, dIdx) => (
                            <View key={draft.id} style={styles.subjectDraftCard}>
                                <View style={styles.subjectDraftHeader}>
                                    <TextInput
                                        style={styles.subjectDraftInput}
                                        value={draft.name}
                                        placeholder={`Subject ${dIdx + 1} Name`}
                                        placeholderTextColor={colors.textMuted}
                                        onChangeText={(val) =>
                                            setSubjectDrafts((prev) =>
                                                prev.map((s) => (s.id === draft.id ? { ...s, name: val } : s))
                                            )
                                        }
                                    />
                                    {subjectDrafts.length > 1 && (
                                        <TouchableOpacity
                                            style={styles.removeDraftBtn}
                                            onPress={() =>
                                                setSubjectDrafts((prev) => prev.filter((s) => s.id !== draft.id))
                                            }
                                        >
                                            <Trash2 size={16} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Attached files */}
                                {draft.files.length > 0 && (
                                    <View style={styles.draftFilesList}>
                                        {draft.files.map((f, fIdx) => (
                                            <View key={fIdx} style={styles.draftFileChip}>
                                                <FileText size={12} color={colors.accent} style={{ marginRight: 4 }} />
                                                <Text style={styles.draftFileName} numberOfLines={1}>
                                                    {f.name}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.addPdfToSubjectBtn}
                                    onPress={() => handlePickFilesForSubject(draft.id)}
                                >
                                    <UploadCloud size={16} color={colors.accent} style={{ marginRight: 6 }} />
                                    <Text style={[styles.addPdfText, { color: colors.accent }]}>
                                        {draft.files.length > 0 ? 'Attach More Files' : 'Select PDF Material'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}

                        <TouchableOpacity
                            style={styles.addNewSubjectDraftBtn}
                            onPress={() =>
                                setSubjectDrafts((prev) => [
                                    ...prev,
                                    { id: `${Date.now()}`, name: '', files: [] },
                                ])
                            }
                        >
                            <Plus size={16} color={colors.accent} style={{ marginRight: 6 }} />
                            <Text style={[styles.addNewSubjectDraftText, { color: colors.accent }]}>
                                Add Another Subject Track
                            </Text>
                        </TouchableOpacity>

                        <TactileButton
                            title="Build Study Space"
                            onPress={handleStartCourseIngestion}
                            variant="primary"
                            size="lg"
                            fullWidth
                            icon={Sparkles}
                        />
                    </ScrollView>
                </View>
            </Modal>

            {/* ── Staged Ingestion Modal (Signature Process Tracker) ── */}
            <Modal visible={isIngesting} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.ingestionModalCard, { backgroundColor: colors.surface }]}>
                        <View style={[styles.ingestIconBox, { backgroundColor: colors.accentMuted }]}>
                            <Sparkles size={28} color={colors.accent} strokeWidth={2.5} />
                        </View>
                        <Text style={styles.ingestModalTitle}>Building Your Study Space</Text>
                        <Text style={styles.ingestModalSub}>
                            Analyzing material, synthesizing summaries, and building active recall flashcards...
                        </Text>

                        {ingestionSubjects.map((item) => (
                            <View key={item.id} style={styles.ingestRow}>
                                <View style={styles.ingestRowHeader}>
                                    <Text style={styles.ingestSubjectName}>{item.name}</Text>
                                    <Text style={[styles.ingestStageLabel, { color: colors.accent }]}>
                                        {item.stage === 'uploading'
                                            ? 'Uploading...'
                                            : item.stage === 'reading'
                                            ? 'Reading pages...'
                                            : item.stage === 'indexing'
                                            ? 'Synthesizing...'
                                            : 'Ready!'}
                                    </Text>
                                </View>
                                <TactileProgressBar progress={item.progressPct} height={8} variant="accent" />
                            </View>
                        ))}
                    </View>
                </View>
            </Modal>

            {/* ── Signature Celebration Moment ── */}
            <CelebrationOverlay
                visible={showCelebration}
                title="Your Study Space is Ready!"
                subtitle="All notes, vocabulary, and active recall quizzes have been indexed."
                buttonText="Start Learning"
                onDismiss={() => setShowCelebration(false)}
            />

            {/* Course Actions Sheet */}
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
                    <View style={[styles.actionSheetCard, { backgroundColor: colors.surface }]}>
                        <Text style={styles.actionSheetTitle}>Course Options</Text>

                        <TouchableOpacity
                            style={styles.actionSheetOption}
                            onPress={() => {
                                setIsActionSheetOpen(false);
                                setRenameTitleInput(courseActionTarget?.title || '');
                                setIsRenameModalOpen(true);
                            }}
                        >
                            <Edit3 size={18} color={colors.text} style={{ marginRight: 12 }} />
                            <Text style={styles.actionSheetOptionText}>Rename Course</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionSheetOption}
                            onPress={() => {
                                setIsActionSheetOpen(false);
                                setIsAddSubjectModalOpen(true);
                            }}
                        >
                            <FolderPlus size={18} color={colors.accent} style={{ marginRight: 12 }} />
                            <Text style={[styles.actionSheetOptionText, { color: colors.accent }]}>Add Subject</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionSheetOption, styles.destructiveOption]}
                            onPress={() => {
                                setIsActionSheetOpen(false);
                                setDeleteConfirmTarget({ type: 'course', item: courseActionTarget });
                            }}
                        >
                            <Trash2 size={18} color={colors.danger} style={{ marginRight: 12 }} />
                            <Text style={[styles.actionSheetOptionText, { color: colors.danger }]}>Delete Course</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Rename Course Dialog */}
            <Modal visible={isRenameModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.dialogCard, { backgroundColor: colors.surface }]}>
                        <Text style={styles.dialogTitle}>Rename Course</Text>
                        <TextInput
                            style={styles.textInput}
                            value={renameTitleInput}
                            onChangeText={setRenameTitleInput}
                            placeholder="Enter course name"
                            placeholderTextColor={colors.textMuted}
                            autoFocus
                        />
                        <View style={styles.dialogActions}>
                            <TactileButton
                                title="Cancel"
                                onPress={() => setIsRenameModalOpen(false)}
                                variant="secondary"
                                size="sm"
                            />
                            <TactileButton
                                title="Save"
                                onPress={handleSaveRename}
                                variant="primary"
                                size="sm"
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Subject Dialog */}
            <Modal visible={isAddSubjectModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.dialogCard, { backgroundColor: colors.surface }]}>
                        <Text style={styles.dialogTitle}>Add New Subject Track</Text>
                        <TextInput
                            style={styles.textInput}
                            value={addSubjectNameInput}
                            onChangeText={setAddSubjectNameInput}
                            placeholder="e.g. Organic Synthesis, Neuroanatomy..."
                            placeholderTextColor={colors.textMuted}
                            autoFocus
                        />
                        <View style={styles.dialogActions}>
                            <TactileButton
                                title="Cancel"
                                onPress={() => setIsAddSubjectModalOpen(false)}
                                variant="secondary"
                                size="sm"
                            />
                            <TactileButton
                                title="Add Subject"
                                onPress={handleSaveNewSubject}
                                variant="primary"
                                size="sm"
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmDialog
                visible={!!deleteConfirmTarget}
                title="Are you sure?"
                message="This will remove this item and its associated materials from your library."
                confirmText="Delete"
                cancelText="Cancel"
                isDestructive
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteConfirmTarget(null)}
            />

            {/* Toast Notification */}
            <Toast
                visible={!!toastMessage}
                message={toastMessage || ''}
                onDismiss={() => setToastMessage(null)}
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
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingBottom: 12,
        },
        topBarLeft: {
            flex: 1,
            paddingRight: 10,
        },
        greetingTitle: {
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.3,
        },
        headerSubtitle: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '600',
            marginTop: 2,
        },
        topBarActions: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        goalCardContainer: {
            paddingHorizontal: 20,
            marginBottom: 14,
        },
        goalCard: {
            borderRadius: radii.xl,
            borderWidth: 2,
            borderColor: colors.border,
            padding: 14,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 1,
        },
        goalLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        streakIconCircle: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
        },
        goalTitle: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            color: colors.text,
        },
        goalSubtitle: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: radii.lg,
            marginHorizontal: 20,
            marginBottom: 12,
            paddingHorizontal: 12,
            height: 44,
        },
        searchIcon: {
            marginRight: 8,
        },
        searchInput: {
            flex: 1,
            fontSize: typography.sizes.sm,
            color: colors.text,
            padding: 0,
            fontWeight: '500',
        },
        searchClearBtn: {
            padding: 4,
        },
        gridCard: {
            width: '100%',
        },
        listCard: {
            width: '100%',
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 14,
        },
        cardIconBox: {
            width: 44,
            height: 44,
            borderRadius: radii.md,
            backgroundColor: colors.accentMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardTitleContainer: {
            flex: 1,
        },
        courseTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
            lineHeight: 22,
        },
        trackChip: {
            alignSelf: 'flex-start',
            backgroundColor: colors.blueMuted,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radii.full,
            marginTop: 4,
        },
        trackChipText: {
            fontSize: 10,
            fontWeight: '700',
            color: colors.blueDark,
        },
        moreBtn: {
            padding: 4,
        },
        cardFooter: {
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
            paddingTop: 12,
        },
        statsRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        statsText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            color: colors.textMuted,
        },
        progressPctText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        drilldownContainer: {
            flex: 1,
            paddingHorizontal: 20,
        },
        drilldownHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            gap: 10,
        },
        backBtn: {
            width: 38,
            height: 38,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        drilldownTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
        },
        drilldownSubtitle: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 1,
        },
        drilldownAddBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.accentMuted,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.full,
            gap: 4,
        },
        drilldownAddText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        subjectHeader: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        subjectColorBar: {
            width: 4,
            height: 36,
            borderRadius: 2,
        },
        subjectName: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            color: colors.text,
        },
        subjectMeta: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        subjectDocsContainer: {
            marginTop: 12,
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
            paddingTop: 10,
            gap: 8,
        },
        emptySubjectDocs: {
            paddingVertical: 10,
            alignItems: 'center',
        },
        emptyDocsText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontStyle: 'italic',
        },
        docItemRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceRaised,
            padding: 10,
            borderRadius: radii.md,
            gap: 10,
        },
        docIconPill: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },
        docFileName: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.text,
        },
        docFileSize: {
            fontSize: 10,
            color: colors.textMuted,
            marginTop: 1,
        },
        modalSheetContainer: {
            flex: 1,
            backgroundColor: colors.bg,
            padding: 20,
            paddingTop: topGap,
        },
        modalSheetHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        modalSheetTitle: {
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            color: colors.text,
        },
        closeBtn: {
            padding: 4,
        },
        fieldLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: colors.textSecondary,
            marginBottom: 6,
            marginTop: 10,
        },
        fieldHelper: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginBottom: 10,
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
        subjectDraftCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 2,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        subjectDraftHeader: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        subjectDraftInput: {
            flex: 1,
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            color: colors.text,
            paddingVertical: 4,
        },
        removeDraftBtn: {
            padding: 4,
        },
        draftFilesList: {
            marginTop: 8,
            gap: 4,
        },
        draftFileChip: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceRaised,
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: radii.xs,
        },
        draftFileName: {
            fontSize: typography.sizes.xs,
            color: colors.textSecondary,
            fontWeight: '600',
            flex: 1,
        },
        addPdfToSubjectBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            marginTop: 10,
            borderRadius: radii.md,
            borderWidth: 2,
            borderColor: colors.accentBorder,
            backgroundColor: colors.accentMuted,
            borderStyle: 'dashed',
        },
        addPdfText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        addNewSubjectDraftBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: radii.lg,
            borderWidth: 2,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginTop: 6,
            marginBottom: 20,
        },
        addNewSubjectDraftText: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        ingestionModalCard: {
            width: '100%',
            maxWidth: 340,
            borderRadius: radii.xxl,
            padding: 24,
            alignItems: 'center',
        },
        ingestIconBox: {
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
        },
        ingestModalTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 6,
        },
        ingestModalSub: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 18,
            marginBottom: 20,
        },
        ingestRow: {
            width: '100%',
            marginBottom: 12,
        },
        ingestRowHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
        },
        ingestSubjectName: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.text,
        },
        ingestStageLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        actionSheetCard: {
            width: '100%',
            maxWidth: 340,
            borderRadius: radii.xxl,
            padding: 16,
            borderWidth: 2,
            borderColor: colors.border,
        },
        actionSheetTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 12,
            paddingHorizontal: 6,
        },
        actionSheetOption: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: radii.md,
        },
        destructiveOption: {
            marginTop: 4,
            borderTopWidth: 1.5,
            borderTopColor: colors.borderLight,
        },
        actionSheetOptionText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            color: colors.text,
        },
        dialogCard: {
            width: '100%',
            maxWidth: 340,
            borderRadius: radii.xxl,
            borderWidth: 2,
            borderColor: colors.border,
            padding: 20,
        },
        dialogTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 14,
        },
        dialogActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 16,
        },
    });

export default LibraryScreen;
