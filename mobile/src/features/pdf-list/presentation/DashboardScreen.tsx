import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
    FileText,
    Plus,
    MessageSquare,
    BookOpen,
    Layers,
    LogOut,
    UploadCloud,
    Search,
    X,
    Trash2,
    CheckCircle2,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import authService from '../../../core/auth/authService';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, darkShadows } from '../../../core/theme/tokens';
import StatusChip from '../../../core/components/StatusChip';
import EmptyState from '../../../core/components/EmptyState';
import { CardSkeleton } from '../../../core/components/LoadingSkeleton';

const formatTitle = (name?: string) => {
    if (!name) return 'Untitled Document';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

const formatSize = (bytes?: number) => {
    if (!bytes || isNaN(bytes)) return '1.2 MB';
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Recently';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return 'Recently';
    }
};

const DashboardScreen = ({ navigation }: any) => {
    const { colors, shadows } = useTheme();
    const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

    const [pdfs, setPdfs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Upload & Ingestion Staged Progress State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingName, setUploadingName] = useState('');
    const [uploadStage, setUploadStage] = useState<1 | 2 | 3 | 4>(1);

    const fetchPdfs = async () => {
        try {
            const response = await apiClient.get('/pdf/list');
            setPdfs(response.data || []);
        } catch (err) {
            console.error('Failed to fetch PDFs:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPdfs();
    }, []);

    const filteredPdfs = useMemo(() => {
        if (!searchQuery.trim()) return pdfs;
        const q = searchQuery.toLowerCase();
        return pdfs.filter((p) => {
            const name = formatTitle(p.original_name || p.title || '').toLowerCase();
            return name.includes(q);
        });
    }, [pdfs, searchQuery]);

    const handleUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'text/plain', 'text/markdown'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                const cleanName = formatTitle(file.name);
                setUploadingName(cleanName);
                setIsUploading(true);
                setUploadStage(1);

                // Stage 1 -> Stage 2: Reading pages & extracting
                const stageTimer2 = setTimeout(() => setUploadStage(2), 700);
                const stageTimer3 = setTimeout(() => setUploadStage(3), 1600);

                const formData = new FormData();
                // @ts-ignore
                formData.append('file', {
                    uri: file.uri,
                    name: file.name,
                    type: file.mimeType || 'application/pdf',
                });

                await apiClient.post('/pdf/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                clearTimeout(stageTimer2);
                clearTimeout(stageTimer3);
                setUploadStage(4);

                // Short delay to show "Ready" completion
                setTimeout(async () => {
                    setIsUploading(false);
                    setUploadingName('');
                    await fetchPdfs();
                }, 800);
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            Alert.alert(
                'Upload Issue',
                err?.response?.data?.detail || err?.message || 'Could not upload PDF. Please try again.'
            );
            setIsUploading(false);
            setUploadingName('');
        }
    };

    const handleDelete = (docId: string, title: string) => {
        Alert.alert(
            'Delete Document',
            `Are you sure you want to remove "${formatTitle(title)}" from your study library?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Optimistically remove from list immediately
                        setPdfs((prev) => prev.filter((p) => (p.id || p.doc_id) !== docId));
                        try {
                            await apiClient.delete(`/pdf/${docId}`);
                        } catch (err) {
                            try {
                                await apiClient.delete(`/documents/${docId}`);
                            } catch (e) {
                                console.error('Delete error:', e);
                            }
                        } finally {
                            await fetchPdfs();
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        const cleanName = formatTitle(item.original_name || item.title);
        const isCompleted = item.process_status !== 'FAILED' && item.process_status !== 'ERROR';

        return (
            <View style={styles.card}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                    <View style={styles.docThumbnail}>
                        <FileText size={22} color={colors.accent} />
                        <Text style={styles.docTypeBadge}>PDF</Text>
                    </View>

                    <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                            {cleanName}
                        </Text>
                        <View style={styles.cardMetaRow}>
                            <Text style={styles.cardMeta}>
                                {formatSize(item.size_bytes)} • {formatDate(item.created_at)}
                            </Text>
                            <StatusChip status={item.process_status} size="sm" />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(item.id, cleanName)}
                        activeOpacity={0.7}
                    >
                        <Trash2 size={16} color={colors.textSubtle} />
                    </TouchableOpacity>
                </View>

                {/* Lens Navigation Actions */}
                {isCompleted ? (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.summaryBtn]}
                            onPress={() =>
                                navigation.navigate('Summary', {
                                    pdfId: item.id,
                                    title: item.original_name || item.title,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <Layers size={14} color={colors.indigo} />
                            <Text style={[styles.actionLabel, { color: colors.indigo }]}>Summary</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, styles.vocabBtn]}
                            onPress={() =>
                                navigation.navigate('Vocabulary', {
                                    pdfId: item.id,
                                    title: item.original_name || item.title,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <BookOpen size={14} color={colors.teal} />
                            <Text style={[styles.actionLabel, { color: colors.teal }]}>Vocab</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, styles.quizBtn]}
                            onPress={() =>
                                navigation.navigate('Quizzes', {
                                    pdfId: item.id,
                                    title: item.original_name || item.title,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <Text style={{ fontSize: 13, marginRight: 2 }}>🎓</Text>
                            <Text style={[styles.actionLabel, { color: colors.accent }]}>Quiz</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, styles.chatBtn]}
                            onPress={() =>
                                navigation.navigate('Chat', {
                                    pdfId: item.id,
                                    title: item.original_name || item.title,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <MessageSquare size={14} color={colors.accent} />
                            <Text style={[styles.actionLabel, { color: colors.accent }]}>Tutor</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.processingRow}>
                        <ActivityIndicator size="small" color={colors.warning} />
                        <Text style={styles.processingText}>Indexing document in background...</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* ── Top App Bar ── */}
            <View style={styles.topBar}>
                <View>
                    <Text style={styles.greetingText}>Knowledge Library</Text>
                    <Text style={styles.workspaceTitle}>Study Workspace</Text>
                </View>

                <View style={styles.topBarActions}>
                    <TouchableOpacity
                        style={styles.signOutBtn}
                        onPress={async () => {
                            await authService.signOut();
                            navigation.replace('Auth');
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Sign Out"
                    >
                        <LogOut size={18} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.uploadPrimaryBtn}
                        onPress={handleUpload}
                        disabled={isUploading}
                        activeOpacity={0.85}
                    >
                        <Plus size={18} color={colors.textInverse} style={{ marginRight: 6 }} />
                        <Text style={styles.uploadBtnText}>Upload PDF</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Search Bar ── */}
            <View style={styles.searchWrapper}>
                <Search size={16} color={colors.textSubtle} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search documents by title..."
                    placeholderTextColor={colors.textSubtle}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                        <X size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Document List ── */}
            {loading && !refreshing ? (
                <View style={styles.skeletonContainer}>
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </View>
            ) : (
                <FlatList
                    data={filteredPdfs}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchPdfs();
                            }}
                            tintColor={colors.accent}
                        />
                    }
                    ListEmptyComponent={
                        searchQuery ? (
                            <EmptyState
                                icon={Search}
                                title="No matching documents"
                                description={`No indexed PDFs found matching "${searchQuery}".`}
                                actionLabel="Clear Search"
                                onAction={() => setSearchQuery('')}
                            />
                        ) : (
                            <EmptyState
                                icon={FileText}
                                title="No documents indexed yet"
                                description="Upload a study PDF, research paper, or textbook to generate multi-paragraph summaries, study vocabulary, and chat with AI."
                                actionLabel="Upload First PDF"
                                actionIcon={Plus}
                                onAction={handleUpload}
                            />
                        )
                    }
                />
            )}

            {/* ── Staged Upload Modal ── */}
            <Modal visible={isUploading} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.uploadModalCard}>
                        <View style={styles.uploadIconWrapper}>
                            <UploadCloud size={30} color={colors.accent} />
                        </View>

                        <Text style={styles.uploadModalTitle}>Ingesting Document</Text>
                        <Text style={styles.uploadDocName} numberOfLines={1}>
                            {uploadingName}
                        </Text>

                        {/* Staged Stepper */}
                        <View style={styles.stepperContainer}>
                            {/* Step 1 */}
                            <View style={styles.stepItem}>
                                <View
                                    style={[
                                        styles.stepDot,
                                        uploadStage >= 1 && styles.stepDotActive,
                                        uploadStage > 1 && styles.stepDotDone,
                                    ]}
                                >
                                    {uploadStage > 1 ? (
                                        <CheckCircle2 size={12} color={colors.textInverse} />
                                    ) : (
                                        <Text style={styles.stepNum}>1</Text>
                                    )}
                                </View>
                                <Text style={[styles.stepText, uploadStage >= 1 && styles.stepTextActive]}>
                                    Uploading PDF
                                </Text>
                            </View>

                            {/* Step 2 */}
                            <View style={styles.stepItem}>
                                <View
                                    style={[
                                        styles.stepDot,
                                        uploadStage >= 2 && styles.stepDotActive,
                                        uploadStage > 2 && styles.stepDotDone,
                                    ]}
                                >
                                    {uploadStage > 2 ? (
                                        <CheckCircle2 size={12} color={colors.textInverse} />
                                    ) : (
                                        <Text style={styles.stepNum}>2</Text>
                                    )}
                                </View>
                                <Text style={[styles.stepText, uploadStage >= 2 && styles.stepTextActive]}>
                                    Reading & Chunking Pages
                                </Text>
                            </View>

                            {/* Step 3 */}
                            <View style={styles.stepItem}>
                                <View
                                    style={[
                                        styles.stepDot,
                                        uploadStage >= 3 && styles.stepDotActive,
                                        uploadStage > 3 && styles.stepDotDone,
                                    ]}
                                >
                                    {uploadStage > 3 ? (
                                        <CheckCircle2 size={12} color={colors.textInverse} />
                                    ) : (
                                        <Text style={styles.stepNum}>3</Text>
                                    )}
                                </View>
                                <Text style={[styles.stepText, uploadStage >= 3 && styles.stepTextActive]}>
                                    Building Vector Index
                                </Text>
                            </View>

                            {/* Step 4 */}
                            <View style={styles.stepItem}>
                                <View
                                    style={[
                                        styles.stepDot,
                                        uploadStage === 4 && styles.stepDotDone,
                                    ]}
                                >
                                    {uploadStage === 4 ? (
                                        <CheckCircle2 size={12} color={colors.textInverse} />
                                    ) : (
                                        <Text style={styles.stepNum}>4</Text>
                                    )}
                                </View>
                                <Text style={[styles.stepText, uploadStage === 4 && styles.stepTextActive]}>
                                    AI Knowledge Ready
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.uploadModalDesc}>
                            Extracting text chunks, generating vector embeddings, and creating your AI study workspace.
                        </Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (colors: ThemeColors, shadows: typeof darkShadows) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: 50,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    greetingText: {
        color: colors.textMuted,
        fontSize: typography.sizes.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    workspaceTitle: {
        color: colors.text,
        fontSize: typography.sizes.xl,
        fontWeight: '700',
        marginTop: 2,
    },
    topBarActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    signOutBtn: {
        width: 38,
        height: 38,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.xs,
    },
    uploadPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.accent,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radii.md,
        ...shadows.glowAccent,
    },
    uploadBtnText: {
        color: colors.textInverse,
        fontSize: typography.sizes.sm,
        fontWeight: '700',
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.md,
        marginHorizontal: spacing.lg,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        marginBottom: spacing.md,
    },
    searchInput: {
        flex: 1,
        color: colors.text,
        fontSize: typography.sizes.sm,
        padding: 0,
    },
    skeletonContainer: {
        paddingHorizontal: spacing.lg,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 95,
    },
    card: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    docThumbnail: {
        width: 44,
        height: 48,
        borderRadius: radii.sm,
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    docTypeBadge: {
        position: 'absolute',
        bottom: 2,
        fontSize: 8,
        fontWeight: '800',
        color: colors.accent,
        letterSpacing: 0.5,
    },
    cardInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 6,
    },
    cardTitle: {
        color: colors.text,
        fontWeight: '700',
        fontSize: typography.sizes.base,
        lineHeight: 20,
    },
    cardMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    cardMeta: {
        color: colors.textMuted,
        fontSize: typography.sizes.xs,
    },
    deleteBtn: {
        padding: 6,
        borderRadius: radii.sm,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: spacing.xs,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: radii.sm,
        borderWidth: 1,
    },
    summaryBtn: {
        backgroundColor: colors.indigoMuted,
        borderColor: colors.indigo,
    },
    vocabBtn: {
        backgroundColor: colors.tealMuted,
        borderColor: colors.teal,
    },
    quizBtn: {
        backgroundColor: colors.accentMuted,
        borderColor: colors.accent,
    },
    chatBtn: {
        backgroundColor: colors.surfaceSubtle,
        borderColor: colors.borderLight,
    },
    actionLabel: {
        fontSize: typography.sizes.xs,
        fontWeight: '700',
        marginLeft: 4,
    },
    processingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        marginTop: spacing.xs,
    },
    processingText: {
        color: colors.warning,
        marginLeft: 8,
        fontSize: typography.sizes.xs,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    uploadModalCard: {
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderRadius: radii.xl,
        padding: spacing.xl,
        alignItems: 'center',
        width: '100%',
        maxWidth: 360,
        ...shadows.modal,
    },
    uploadIconWrapper: {
        width: 56,
        height: 56,
        borderRadius: radii.full,
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    uploadModalTitle: {
        color: colors.text,
        fontSize: typography.sizes.lg,
        fontWeight: '700',
        textAlign: 'center',
    },
    uploadDocName: {
        color: colors.accent,
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'center',
    },
    stepperContainer: {
        width: '100%',
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    stepDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    stepDotActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    stepDotDone: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    stepNum: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textMuted,
    },
    stepText: {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        fontWeight: '500',
    },
    stepTextActive: {
        color: colors.text,
        fontWeight: '700',
    },
    uploadModalDesc: {
        color: colors.textSubtle,
        fontSize: typography.sizes.xs,
        lineHeight: 18,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
});

export default DashboardScreen;
