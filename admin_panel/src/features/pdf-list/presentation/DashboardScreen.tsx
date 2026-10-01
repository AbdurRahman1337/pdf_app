import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FileText, Plus, MessageSquare, BookOpen, Layers } from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const DashboardScreen = ({ navigation }: any) => {
    const [pdfs, setPdfs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
        const result = await DocumentPicker.getDocumentAsync({
            type: 'application/pdf',
        });

        if (!result.canceled) {
            const file = result.assets[0];
            const formData = new FormData();
            // @ts-ignore
            formData.append('file', {
                uri: file.uri,
                name: file.name,
                type: 'application/pdf',
            });

            try {
                await apiClient.post('/pdf/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                fetchPdfs();
            } catch (err) {
                alert('Upload failed');
            }
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: item.process_status === 'COMPLETED' ? 'rgba(56,189,248,0.1)' : 'rgba(234,179,8,0.1)' }]}>
                    <FileText size={24} color={item.process_status === 'COMPLETED' ? '#38BDF8' : '#EAB308'} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.original_name}</Text>
                    <Text style={styles.cardMeta}>
                        {item.process_status} • {(item.size_bytes / 1024).toFixed(1)} KB
                    </Text>
                </View>
            </View>

            {item.process_status === 'COMPLETED' ? (
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Summary', { pdfId: item.id })}>
                        <Layers size={20} color="#818CF8" />
                        <Text style={styles.actionLabel}>Summary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Vocabulary', { pdfId: item.id })}>
                        <BookOpen size={20} color="#2DD4BF" />
                        <Text style={styles.actionLabel}>Vocab</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Chat', { pdfId: item.id })}>
                        <MessageSquare size={20} color="#38BDF8" />
                        <Text style={styles.actionLabel}>RAG Chat</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.processingRow}>
                    <ActivityIndicator size="small" color="#EAB308" />
                    <Text style={styles.processingText}>Processing...</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>Welcome Back</Text>
                    <Text style={styles.workspaceText}>Workspace</Text>
                </View>
                <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
                    <Plus size={24} color="black" />
                </TouchableOpacity>
            </View>

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
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchPdfs(); }}
                            tintColor="#38BDF8"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No documents yet</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={handleUpload}>
                                <Text style={styles.emptyBtnText}>Upload First PDF</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', paddingHorizontal: 24, paddingTop: 48 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    welcomeText: { color: '#94a3b8' },
    workspaceText: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
    uploadBtn: { backgroundColor: '#38BDF8', padding: 12, borderRadius: 999 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', padding: 16, borderRadius: 20, marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconBg: { padding: 12, borderRadius: 999 },
    cardInfo: { flex: 1, marginLeft: 16 },
    cardTitle: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
    cardMeta: { color: '#94a3b8', fontSize: 12 },
    actions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 16 },
    actionBtn: { alignItems: 'center', flex: 1 },
    actionLabel: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
    processingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    processingText: { color: '#EAB308', marginLeft: 8, fontSize: 12 },
    emptyContainer: { alignItems: 'center', marginTop: 80 },
    emptyText: { color: '#64748b', fontSize: 18 },
    emptyBtn: { marginTop: 16, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 999 },
    emptyBtnText: { color: '#38BDF8', fontWeight: 'bold' },
});

export default DashboardScreen;
