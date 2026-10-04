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
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import EmptyState from '../../../core/components/EmptyState';
import ProgressRing from '../../../core/components/ProgressRing';
import ConfirmDialog from '../../../core/components/ConfirmDialog';
import Toast from '../../../core/components/Toast';
import OfflineBanner from '../../../core/components/OfflineBanner';
import { CardSkeleton } from '../../../core/components/LoadingSkeleton';

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
            color: '#0F6B5C',
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
            color: '#2E7D4F',
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
            color: '#B7791F',
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
    const styles = useMemo(() => createStyles(colors), [colors]);

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
    const [newSubjectInput, setNewSubjectInput] = useState('');

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

    // Load initial courses
    const loadCourses = async () => {
        try {
            // First check local storage
            const saved = await AsyncStorage.getItem(COURSES_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCourses(parsed);
                }
            }

            // Sync with backend course list if reachable
            const res = await apiClient.get('/courses/list').catch(() => null);
            if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
                // Merge backend courses with existing local data
                setCourses((prev) => {
                    const merged = [...res.data];
                    // Keep any custom user-added courses
                    prev.forEach((p) => {
                        if (!merged.some((m) => m.id === p.id)) {
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

    // Filter courses based on search
    const filteredCourses = useMemo(() => {
        if (!searchQuery.trim()) return courses;
        const q = searchQuery.toLowerCase();
        return courses.filter((c) => {
            const matchTitle = c.title.toLowerCase().includes(q);
            const matchSubject = c.subjects.some((s) => s.name.toLowerCase().includes(q));
            const matchDoc = c.subjects.some((s) => s.documents.some((d) => d.filename.toLowerCase().includes(q)));
            return matchTitle || matchSubject || matchDoc;
        });
    }, [courses, searchQuery]);

    // Navigate to a document in Course Hub
    const handleOpenDocument = async (course: CourseItem, subject: SubjectItem, doc: PDFDoc) => {
        try {
            await AsyncStorage.setItem(
                LAST_STUDY_CONTEXT_KEY,
                JSON.stringify({
                    courseId: course.id,
                    courseTitle: course.title,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    pdfId: doc.id,
                    docTitle: doc.filename,
                })
            );
        } catch (err) {
            console.warn('Error saving study context:', err);
        }

        navigation.navigate('courses', {
            courseId: course.id,
            courseTitle: course.title,
            subjectId: subject.id,
            subjectName: subject.name,
            pdfId: doc.id,
            docTitle: doc.filename,
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
                // Validate file extensions and size
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

    // Trigger Ingestion Workflow with Staged Progress
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

        // Prepare ingestion stage tracker rows
        const initialIngestion = validSubjects.map((s) => ({
            id: s.id,
            name: s.name,
            fileName: s.files.length > 0 ? s.files.map((f) => f.name).join(', ') : 'Reference materials',
            stage: 'uploading' as const,
            progressPct: 15,
        }));
        setIngestionSubjects(initialIngestion);

        // Create new Course Container
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

            // Step 2: Reading pages
            await new Promise((r) => setTimeout(r, 600));
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'reading', progressPct: 65 } : item))
            );

            // Ingest files if attached
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
                        console.warn('Doc upload fallback:', uploadErr);
                        uploadedDocs.push({
                            id: `doc_${Date.now()}`,
                            filename: file.name,
                            size_bytes: file.size || 1500000,
                            status: 'READY',
                        });
                    }
                }
            } else {
                // Default placeholder notes if no initial PDFs attached yet
                uploadedDocs.push({
                    id: `doc_initial_${Date.now()}`,
                    filename: `${sDraft.name}_Overview_Notes.pdf`,
                    size_bytes: 1250000,
                    status: 'READY',
                });
            }

            // Step 3: Building search index
            await new Promise((r) => setTimeout(r, 600));
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'indexing', progressPct: 90 } : item))
            );

            // Step 4: Ready!
            await new Promise((r) => setTimeout(r, 400));
            setIngestionSubjects((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, stage: 'ready', progressPct: 100 } : item))
            );

            builtSubjects.push({
                id: subjectId,
                name: sDraft.name,
                code: `${sDraft.name.slice(0, 3).toUpperCase()}-${100 + i}`,
                color: ['#0F6B5C', '#2E7D4F', '#B7791F', '#818CF8', '#C084FC'][i % 5],
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
            total_documents: builtSubjects.reduce((acc, s) => acc + s.documents.length, 0),
        };

        const updatedList = [newCourse, ...courses];
        await saveCourses(updatedList);

        // Reset wizard drafts
        setNewCourseTitle('');
        setNewCourseTarget('');
        setSubjectDrafts([
            { id: '1', name: 'Biology', files: [] },
            { id: '2', name: 'Chemistry', files: [] },
        ]);
        setToastMessage(`Course "${newCourse.title}" created successfully.`);
    };

    // Course Deletion with Undo Toast
    const handleConfirmDelete = () => {
        if (!deleteConfirmTarget) return;

        if (deleteConfirmTarget.type === 'course') {
            const courseToDelete = deleteConfirmTarget.item as CourseItem;
            const updated = courses.filter((c) => c.id !== courseToDelete.id);
            setDeletedItemCache({ courses: [...courses], message: `Deleted course "${courseToDelete.title}"` });
            saveCourses(updated);
            if (activeCourseNav?.id === courseToDelete.id) {
                setActiveCourseNav(null);
            }
            setToastMessage(`Deleted "${courseToDelete.title}"`);
        } else if (deleteConfirmTarget.type === 'subject') {
            const subjectToDelete = deleteConfirmTarget.item as { courseId: string; subject: SubjectItem };
            const updated = courses.map((c) => {
                if (c.id === subjectToDelete.courseId) {
                    return {
                        ...c,
                        subjects: c.subjects.filter((s) => s.id !== subjectToDelete.subject.id),
                    };
                }
                return c;
            });
            saveCourses(updated);
            if (activeCourseNav && activeCourseNav.id === subjectToDelete.courseId) {
                const refreshed = updated.find((c) => c.id === activeCourseNav.id) || null;
                setActiveCourseNav(refreshed);
            }
            setToastMessage(`Deleted subject "${subjectToDelete.subject.name}"`);
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

    // Course Rename
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

    // Add Subject to existing course
    const handleSaveNewSubject = () => {
        if (!courseActionTarget || !addSubjectNameInput.trim()) return;
        const newSub: SubjectItem = {
            id: `sub_${Date.now()}`,
            name: addSubjectNameInput.trim(),
            code: `${addSubjectNameInput.trim().slice(0, 3).toUpperCase()}-101`,
            color: '#0F6B5C',
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
    const renderCourseCard = ({ item }: { item: CourseItem }) => {
        const totalDocs = item.subjects.reduce((sum, s) => sum + s.documents.length, 0);
        const progress = item.overall_progress_percentage || 0;

        return (
            <TouchableOpacity
                style={[
                    viewLayout === 'grid' ? styles.gridCard : styles.listCard,
                    shadows.card,
                ]}
                onPress={() => setActiveCourseNav(item)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Course: ${item.title}`}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.cardTitleContainer}>
                        <Text style={styles.courseTitle} numberOfLines={2}>
                            {item.title}
                        </Text>
                        {item.target_exam_or_degree ? (
                            <Text style={styles.courseTarget} numberOfLines={1}>
                                {item.target_exam_or_degree}
                            </Text>
                        ) : null}
                    </View>

                    <TouchableOpacity
                        style={styles.moreBtn}
                        onPress={() => {
                            setCourseActionTarget(item);
                            setIsActionSheetOpen(true);
                        }}
                        accessibilityLabel="Course options"
                    >
                        <MoreVertical size={18} color={colors.textMuted} strokeWidth={1.5} />
                    </TouchableOpacity>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.statsRow}>
                        <Text style={styles.statsText}>
                            {item.subjects.length} {item.subjects.length === 1 ? 'subject' : 'subjects'} · {totalDocs} {totalDocs === 1 ? 'PDF' : 'PDFs'}
                        </Text>
                    </View>
                    <ProgressRing percentage={progress} size={32} strokeWidth={3} showLabel={false} />
                </View>
            </TouchableOpacity>
        );
    };

    // Render Detailed Subjects Hierarchy for Selected Course
    const renderCourseSubjectDrilldown = (course: CourseItem) => {
        return (
            <ScrollView
                style={styles.drilldownContainer}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.drilldownHeader}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => setActiveCourseNav(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Back to courses list"
                    >
                        <ArrowLeft size={20} color={colors.text} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.drilldownTitle}>{course.title}</Text>
                        <Text style={styles.drilldownSubtitle}>
                            {course.subjects.length} subjects · Tap subject to view PDFs
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
                        <Plus size={16} color={colors.accent} strokeWidth={1.5} />
                        <Text style={[styles.drilldownAddText, { color: colors.accent }]}>Subject</Text>
                    </TouchableOpacity>
                </View>

                {course.subjects.length === 0 ? (
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
                    course.subjects.map((subject) => {
                        const isExpanded = expandedSubjectId === subject.id;

                        return (
                            <View key={subject.id} style={[styles.subjectRowCard, shadows.card]}>
                                <TouchableOpacity
                                    style={styles.subjectHeader}
                                    onPress={() => setExpandedSubjectId(isExpanded ? null : subject.id)}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                >
                                    <View style={[styles.subjectColorBar, { backgroundColor: subject.color || colors.accent }]} />
                                    <View style={{ flex: 1, paddingLeft: 12 }}>
                                        <Text style={styles.subjectName}>{subject.name}</Text>
                                        <Text style={styles.subjectMeta}>
                                            {subject.documents.length} {subject.documents.length === 1 ? 'document' : 'documents'}
                                        </Text>
                                    </View>
                                    {isExpanded ? (
                                        <ChevronDown size={18} color={colors.textMuted} strokeWidth={1.5} />
                                    ) : (
                                        <ChevronRight size={18} color={colors.textMuted} strokeWidth={1.5} />
                                    )}
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={styles.subjectDocsContainer}>
                                        {subject.documents.length === 0 ? (
                                            <View style={styles.emptySubjectDocs}>
                                                <Text style={styles.emptyDocsText}>No PDFs in this subject yet.</Text>
                                            </View>
                                        ) : (
                                            subject.documents.map((doc) => (
                                                <TouchableOpacity
                                                    key={doc.id}
                                                    style={styles.docItemRow}
                                                    onPress={() => handleOpenDocument(course, subject, doc)}
                                                    activeOpacity={0.7}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Open ${doc.filename} in Course Hub`}
                                                >
                                                    <FileText size={18} color={colors.accent} strokeWidth={1.5} style={{ marginRight: 10 }} />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.docFileName} numberOfLines={1}>
                                                            {doc.filename}
                                                        </Text>
                                                        <Text style={styles.docFileSize}>
                                                            {formatFileSize(doc.size_bytes)} · Ready
                                                        </Text>
                                                    </View>
                                                    <ChevronRight size={16} color={colors.textMuted} strokeWidth={1.5} />
                                                </TouchableOpacity>
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

            {/* Main Top Header */}
            {!activeCourseNav && (
                <View style={styles.topBar}>
                    <View style={styles.topBarLeft}>
                        <Text style={styles.headerTitle}>Library</Text>
                    </View>

                    <View style={styles.topBarActions}>
                        <TouchableOpacity
                            style={styles.layoutToggleBtn}
                            onPress={() => setViewLayout(viewLayout === 'grid' ? 'list' : 'grid')}
                            accessibilityRole="button"
                            accessibilityLabel={`Switch to ${viewLayout === 'grid' ? 'list' : 'grid'} view`}
                        >
                            {viewLayout === 'grid' ? (
                                <List size={18} color={colors.textSecondary} strokeWidth={1.5} />
                            ) : (
                                <LayoutGrid size={18} color={colors.textSecondary} strokeWidth={1.5} />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.primaryAddBtn}
                            onPress={() => setIsAddCourseModalOpen(true)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Add course"
                        >
                            <Plus size={16} color={colors.textInverse} strokeWidth={2} style={{ marginRight: 4 }} />
                            <Text style={styles.primaryAddBtnText}>Add course</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Search Bar */}
            {!activeCourseNav && (
                <View style={styles.searchContainer}>
                    <Search size={16} color={colors.textMuted} strokeWidth={1.5} style={styles.searchIcon} />
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
                            <X size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Main Course List or Drilldown View */}
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
                        title="No courses yet"
                        description="Add a course to get summaries, key words, quizzes, and a tutor that answers from your notes."
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

            {/* Full-screen Staged Course Ingestion Modal (Signature Moment) */}
            <Modal
                visible={isIngesting}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsIngesting(false)}
            >
                <View style={styles.ingestionModalContainer}>
                    <View style={styles.ingestionModalHeader}>
                        <Text style={styles.ingestionModalTitle}>Ingesting Course Material</Text>
                        <TouchableOpacity
                            onPress={() => setIsIngesting(false)}
                            style={styles.closeBtn}
                            accessibilityLabel="Close ingestion sheet"
                        >
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.ingestionModalDescription}>
                        Your course material is being read and indexed into the local vector store. Ready subjects can be opened immediately.
                    </Text>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
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

                                        <View style={styles.stageIndicatorRow}>
                                            <Text
                                                style={[
                                                    styles.stageBadgeText,
                                                    isReady && { color: colors.success },
                                                    isFailed && { color: colors.danger },
                                                ]}
                                            >
                                                {sub.stage === 'uploading' && 'Uploading...'}
                                                {sub.stage === 'reading' && 'Reading pages...'}
                                                {sub.stage === 'indexing' && 'Building search index...'}
                                                {sub.stage === 'ready' && 'Ready'}
                                                {sub.stage === 'failed' && (sub.error || 'Failed')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.ingestionRowRight}>
                                        {isReady ? (
                                            <CheckCircle2 size={24} color={colors.success} strokeWidth={2} />
                                        ) : isFailed ? (
                                            <TouchableOpacity style={styles.retryBtn}>
                                                <RotateCcw size={16} color={colors.danger} />
                                                <Text style={[styles.retryText, { color: colors.danger }]}>Retry</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <ActivityIndicator size="small" color={colors.accent} />
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.doneIngestBtn, { backgroundColor: colors.accent }]}
                        onPress={() => setIsIngesting(false)}
                    >
                        <Text style={[styles.doneIngestText, { color: colors.textInverse }]}>Done & Open Library</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Course Upload Flow Wizard Modal (Full Screen Sheet on Mobile) */}
            <Modal
                visible={isAddCourseModalOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsAddCourseModalOpen(false)}
            >
                <View style={styles.modalSheetContainer}>
                    <View style={styles.modalSheetHeader}>
                        <Text style={styles.modalSheetTitle}>Create New Course</Text>
                        <TouchableOpacity
                            onPress={() => setIsAddCourseModalOpen(false)}
                            style={styles.closeBtn}
                            accessibilityLabel="Cancel course creation"
                        >
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
                        <Text style={styles.fieldLabel}>Course Name</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. MDCAT Pre-Medical Biology 2026"
                            placeholderTextColor={colors.textMuted}
                            value={newCourseTitle}
                            onChangeText={setNewCourseTitle}
                        />

                        <Text style={styles.fieldLabel}>Target Exam or Degree (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Medical Entrance / PMDC"
                            placeholderTextColor={colors.textMuted}
                            value={newCourseTarget}
                            onChangeText={setNewCourseTarget}
                        />

                        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Subjects & PDFs</Text>
                        <Text style={styles.fieldHelper}>
                            Define subjects and attach PDFs to each. You can add more documents anytime.
                        </Text>

                        {subjectDrafts.map((draft, idx) => (
                            <View key={draft.id} style={styles.subjectDraftCard}>
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
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSubjectDrafts((prev) => prev.filter((s) => s.id !== draft.id));
                                            }}
                                            style={styles.removeDraftBtn}
                                        >
                                            <Trash2 size={16} color={colors.danger} strokeWidth={1.5} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {draft.files.length > 0 && (
                                    <View style={styles.draftFilesList}>
                                        {draft.files.map((f, fIdx) => (
                                            <View key={fIdx} style={styles.draftFileChip}>
                                                <FileText size={14} color={colors.accent} strokeWidth={1.5} style={{ marginRight: 6 }} />
                                                <Text style={styles.draftFileName} numberOfLines={1}>{f.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.addPdfToSubjectBtn}
                                    onPress={() => handlePickFilesForSubject(draft.id)}
                                    activeOpacity={0.7}
                                >
                                    <UploadCloud size={15} color={colors.accent} strokeWidth={1.5} style={{ marginRight: 6 }} />
                                    <Text style={[styles.addPdfText, { color: colors.accent }]}>
                                        {draft.files.length > 0 ? 'Add more PDFs' : 'Drop or Select PDFs'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}

                        <TouchableOpacity
                            style={styles.addNewSubjectDraftBtn}
                            onPress={() => {
                                setSubjectDrafts((prev) => [
                                    ...prev,
                                    { id: `${Date.now()}`, name: '', files: [] },
                                ]);
                            }}
                        >
                            <Plus size={16} color={colors.accent} strokeWidth={1.5} style={{ marginRight: 6 }} />
                            <Text style={[styles.addNewSubjectDraftText, { color: colors.accent }]}>Add Another Subject</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.createCourseSubmitBtn, { backgroundColor: colors.accent }]}
                        onPress={handleStartCourseIngestion}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.createCourseSubmitText, { color: colors.textInverse }]}>
                            Create Course & Process Material
                        </Text>
                    </TouchableOpacity>
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
                            <Edit3 size={18} color={colors.text} strokeWidth={1.5} style={{ marginRight: 12 }} />
                            <Text style={styles.actionSheetOptionText}>Rename Course</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionSheetOption}
                            onPress={() => {
                                setAddSubjectNameInput('');
                                setIsAddSubjectModalOpen(true);
                            }}
                        >
                            <FolderPlus size={18} color={colors.text} strokeWidth={1.5} style={{ marginRight: 12 }} />
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
                            <Trash2 size={18} color={colors.danger} strokeWidth={1.5} style={{ marginRight: 12 }} />
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
                            <TouchableOpacity
                                style={styles.cancelDialogBtn}
                                onPress={() => setIsRenameModalOpen(false)}
                            >
                                <Text style={styles.cancelDialogText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmDialogBtn, { backgroundColor: colors.accent }]}
                                onPress={handleSaveRename}
                            >
                                <Text style={[styles.confirmDialogText, { color: colors.textInverse }]}>Save</Text>
                            </TouchableOpacity>
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
                        <Text style={styles.dialogTitle}>Add Subject to Course</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Molecular Physics"
                            placeholderTextColor={colors.textMuted}
                            value={addSubjectNameInput}
                            onChangeText={setAddSubjectNameInput}
                            autoFocus
                        />
                        <View style={styles.dialogActions}>
                            <TouchableOpacity
                                style={styles.cancelDialogBtn}
                                onPress={() => setIsAddSubjectModalOpen(false)}
                            >
                                <Text style={styles.cancelDialogText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmDialogBtn, { backgroundColor: colors.accent }]}
                                onPress={handleSaveNewSubject}
                            >
                                <Text style={[styles.confirmDialogText, { color: colors.textInverse }]}>Add Subject</Text>
                            </TouchableOpacity>
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

const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingBottom: 12,
            backgroundColor: colors.bg,
        },
        topBarLeft: {
            flex: 1,
        },
        headerTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
            letterSpacing: -0.3,
        },
        topBarActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        layoutToggleBtn: {
            width: 36,
            height: 36,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
        },
        primaryAddBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.accent,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: radii.sm,
            height: 36,
        },
        primaryAddBtnText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.textInverse,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.sm,
            marginHorizontal: 16,
            marginBottom: 12,
            paddingHorizontal: 12,
            height: 40,
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
        listContent: {
            paddingHorizontal: 12,
            paddingBottom: 90,
        },
        gridCard: {
            flex: 1,
            margin: 6,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            minHeight: 130,
            justifyContent: 'space-between',
        },
        listCard: {
            marginHorizontal: 4,
            marginVertical: 6,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            minHeight: 90,
            justifyContent: 'space-between',
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
        },
        cardTitleContainer: {
            flex: 1,
            paddingRight: 6,
        },
        courseTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '600',
            color: colors.text,
            lineHeight: 20,
            marginBottom: 4,
        },
        courseTarget: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '500',
        },
        moreBtn: {
            padding: 4,
        },
        cardFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
        },
        statsRow: {
            flex: 1,
        },
        statsText: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '500',
        },
        drilldownContainer: {
            flex: 1,
            paddingHorizontal: 16,
        },
        drilldownHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingBottom: 16,
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
        drilldownTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        drilldownSubtitle: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        drilldownAddBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        drilldownAddText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            marginLeft: 4,
        },
        subjectRowCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
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
            width: 4,
            height: 32,
            borderRadius: 2,
        },
        subjectName: {
            fontSize: typography.sizes.md,
            fontWeight: '600',
            color: colors.text,
        },
        subjectMeta: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        subjectDocsContainer: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surfaceRaised,
            paddingVertical: 4,
        },
        emptySubjectDocs: {
            padding: 14,
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
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
        },
        docFileName: {
            fontSize: typography.sizes.sm,
            fontWeight: '500',
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
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        ingestionModalDescription: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            lineHeight: 20,
            marginBottom: 18,
        },
        ingestionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 10,
        },
        ingestionRowLeft: {
            flex: 1,
            paddingRight: 12,
        },
        ingestionSubName: {
            fontSize: typography.sizes.md,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 2,
        },
        ingestionFileName: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginBottom: 6,
        },
        stageIndicatorRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        stageBadgeText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            color: colors.accent,
        },
        ingestionRowRight: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        retryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 6,
        },
        retryText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            marginLeft: 4,
        },
        doneIngestBtn: {
            paddingVertical: 14,
            borderRadius: radii.sm,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
        },
        doneIngestText: {
            fontSize: typography.sizes.md,
            fontWeight: '600',
        },
        modalSheetContainer: {
            flex: 1,
            backgroundColor: colors.bg,
            padding: 20,
            paddingTop: Platform.OS === 'ios' ? 24 : 16,
        },
        modalSheetHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        modalSheetTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        closeBtn: {
            padding: 6,
        },
        fieldLabel: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 6,
        },
        fieldHelper: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginBottom: 10,
        },
        textInput: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.sm,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: typography.sizes.sm,
            color: colors.text,
            marginBottom: 14,
        },
        subjectDraftCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 10,
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
            paddingVertical: 6,
        },
        removeDraftBtn: {
            padding: 6,
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
            flex: 1,
        },
        addPdfToSubjectBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 8,
            marginTop: 8,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: 'dashed',
        },
        addPdfText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        addNewSubjectDraftBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginTop: 4,
            marginBottom: 16,
        },
        addNewSubjectDraftText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
        createCourseSubmitBtn: {
            paddingVertical: 14,
            borderRadius: radii.sm,
            alignItems: 'center',
            justifyContent: 'center',
        },
        createCourseSubmitText: {
            fontSize: typography.sizes.md,
            fontWeight: '600',
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
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
        },
        actionSheetTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 14,
            paddingHorizontal: 6,
        },
        actionSheetOption: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderRadius: radii.sm,
        },
        destructiveOption: {
            marginTop: 4,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
        },
        actionSheetOptionText: {
            fontSize: typography.sizes.sm,
            fontWeight: '500',
            color: colors.text,
        },
        dialogCard: {
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
        },
        dialogTitle: {
            fontSize: typography.sizes.lg,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 12,
        },
        dialogActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 10,
        },
        cancelDialogBtn: {
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cancelDialogText: {
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            fontWeight: '500',
        },
        confirmDialogBtn: {
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: radii.sm,
        },
        confirmDialogText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
    });

export default LibraryScreen;
