import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    Modal,
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
    Sparkles,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import authService from '../../../core/auth/authService';

const formatTitle = (name?: string) => {
    if (!name) return 'Untitled Document';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

const DashboardScreen = ({ navigation }: any) => {
    const [pdfs, setPdfs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingName, setUploadingName] = useState('');

    const fetchPdfs = async () => {
        try {
            const response = await apiClient.get('/pdf/list');
            setPdfs(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPdfs();
    }, []);

    const handleUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                const cleanName = formatTitle(file.name);
                setUploadingName(cleanName);
                setIsUploading(true);

                const formData = new FormData();
                // @ts-ignore
                formData.append('file', {
                    uri: file.uri,
                    name: file.name,
                    type: 'application/pdf',
                });

                await apiClient.post('/pdf/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                await fetchPdfs();
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            alert('Upload failed: ' + (err?.response?.data?.detail || err?.message || 'Could not upload PDF'));
        } finally {
            setIsUploading(false);
            setUploadingName('');
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const cleanName = formatTitle(item.original_name);
        const isCompleted = item.process_status === 'COMPLETED';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View
                        style={[
                            styles.iconBg,
                            {
                                backgroundColor: isCompleted
                                    ? 'rgba(56,189,248,0.12)'
                                    : 'rgba(234,179,8,0.12)',
                            },
                        ]}
                    >
                        <FileText
                            size={24}
                            color={isCompleted ? '#38BDF8' : '#EAB308'}
                        />
                    </View>
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                            {cleanName}
                        </Text>
                        <Text style={styles.cardMeta}>
                            {item.process_status} • {(item.size_bytes / 1024).toFixed(1)} KB
                        </Text>
                    </View>
                </View>

                {isCompleted ? (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() =>
                                navigation.navigate('Summary', {
                                    pdfId: item.id,
                                    title: item.original_name,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <Layers size={19} color="#818CF8" />
                            <Text style={styles.actionLabel}>Summary</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() =>
                                navigation.navigate('Vocabulary', {
                                    pdfId: item.id,
                                    title: item.original_name,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <BookOpen size={19} color="#2DD4BF" />
                            <Text style={styles.actionLabel}>Vocab</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() =>
                                navigation.navigate('Chat', {
                                    pdfId: item.id,
                                    title: item.original_name,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <MessageSquare size={19} color="#38BDF8" />
                            <Text style={styles.actionLabel}>RAG Chat</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.processingRow}>
                        <ActivityIndicator size="small" color="#EAB308" />
                        <Text style={styles.processingText}>Processing document...</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* ── Top App Bar ── */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>Welcome Back</Text>
                    <Text style={styles.workspaceText}>PDF Knowledge Base</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        style={[styles.uploadBtn, { backgroundColor: '#1E293B', marginRight: 10 }]}
                        onPress={async () => {
                            await authService.signOut();
                            navigation.replace('Auth');
                        }}
                        activeOpacity={0.7}
                    >
                        <LogOut size={18} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={handleUpload}
                        disabled={isUploading}
                        activeOpacity={0.8}
                    >
                        <Plus size={22} color="#020617" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── PDF List / Loading ── */}
            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#38BDF8" />
                </View>
            ) : (
                <FlatList
                    data={pdfs}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchPdfs();
                            }}
                            tintColor="#38BDF8"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconBg}>
                                <FileText size={48} color="rgba(56,189,248,0.4)" />
                            </View>
                            <Text style={styles.emptyText}>No documents indexed yet</Text>
                            <Text style={styles.emptySub}>
                                Upload your study notes, books, or papers to generate summaries and start AI chat.
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyBtn}
                                onPress={handleUpload}
                                disabled={isUploading}
                                activeOpacity={0.8}
                            >
                                <Plus size={18} color="#020617" style={{ marginRight: 6 }} />
                                <Text style={styles.emptyBtnText}>Upload First PDF</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* ── Upload Buffering Overlay ── */}
            <Modal visible={isUploading} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.uploadModalCard}>
                        <View style={styles.uploadIconWrapper}>
                            <UploadCloud size={32} color="#38BDF8" />
                        </View>
                        <ActivityIndicator size="large" color="#38BDF8" style={{ marginVertical: 16 }} />
                        <Text style={styles.uploadModalTitle}>Uploading & Indexing PDF</Text>
                        <Text style={styles.uploadDocName} numberOfLines={1}>
                            {uploadingName}
                        </Text>
                        <Text style={styles.uploadModalDesc}>
                            Extracting text chunks, generating vector embeddings, and creating your AI study hub...
                        </Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
        paddingHorizontal: 20,
        paddingTop: 48,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    welcomeText: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '500',
    },
    workspaceText: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 2,
    },
    uploadBtn: {
        backgroundColor: '#38BDF8',
        padding: 11,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: 18,
        borderRadius: 20,
        marginBottom: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    iconBg: {
        padding: 12,
        borderRadius: 14,
    },
    cardInfo: {
        flex: 1,
        marginLeft: 14,
    },
    cardTitle: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    cardMeta: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 3,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
        paddingTop: 12,
    },
    actionBtn: {
        alignItems: 'center',
        flex: 1,
        paddingVertical: 4,
    },
    actionLabel: {
        color: '#94a3b8',
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
    },
    processingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    processingText: {
        color: '#EAB308',
        marginLeft: 8,
        fontSize: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 20,
    },
    emptyIconBg: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(56,189,248,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
    },
    emptyText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    emptySub: {
        color: '#64748B',
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#38BDF8',
        paddingVertical: 13,
        paddingHorizontal: 24,
        borderRadius: 999,
    },
    emptyBtnText: {
        color: '#020617',
        fontWeight: 'bold',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.82)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    uploadModalCard: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
    },
    uploadIconWrapper: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(56,189,248,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadModalTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    uploadDocName: {
        color: '#38BDF8',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 6,
        textAlign: 'center',
    },
    uploadModalDesc: {
        color: '#94A3B8',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
        marginTop: 10,
    },
});

export default DashboardScreen;
