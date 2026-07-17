import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, FileText, ListChecks } from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const SummaryScreen = ({ route, navigation }: any) => {
    const { pdfId } = route.params;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('brief');

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await apiClient.get(`/pdf/${pdfId}`);
                setData(response.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [pdfId]);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#38BDF8" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {data?.original_name}
                </Text>
            </View>

            <View style={styles.tabRow}>
                <TouchableOpacity
                    onPress={() => setActiveTab('brief')}
                    style={[styles.tab, activeTab === 'brief' ? styles.tabActive : styles.tabInactive]}
                >
                    <FileText size={18} color={activeTab === 'brief' ? 'black' : 'white'} />
                    <Text style={[styles.tabText, { color: activeTab === 'brief' ? 'black' : 'white' }]}>Brief</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('detailed')}
                    style={[styles.tab, activeTab === 'detailed' ? styles.tabActive : styles.tabInactive]}
                >
                    <ListChecks size={18} color={activeTab === 'detailed' ? 'black' : 'white'} />
                    <Text style={[styles.tabText, { color: activeTab === 'detailed' ? 'black' : 'white' }]}>Details</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>
                        {activeTab === 'brief' ? 'Executive Summary' : 'Granular Analysis'}
                    </Text>
                    <Text style={styles.cardBody}>
                        {activeTab === 'brief'
                            ? data?.summary_brief
                            : data?.summary_details?.main_points}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', paddingTop: 48 },
    centered: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
    backBtn: { padding: 8, backgroundColor: '#0F172A', borderRadius: 999 },
    headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginLeft: 16, flex: 1 },
    tabRow: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 24 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
    tabActive: { backgroundColor: '#38BDF8', marginRight: 4 },
    tabInactive: { backgroundColor: '#0F172A', marginLeft: 4 },
    tabText: { marginLeft: 8, fontWeight: 'bold' },
    scroll: { flex: 1, paddingHorizontal: 24 },
    card: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', padding: 24, borderRadius: 24, marginBottom: 32 },
    cardLabel: { color: '#38BDF8', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 },
    cardBody: { color: '#ffffff', fontSize: 17, lineHeight: 28 },
});

export default SummaryScreen;
