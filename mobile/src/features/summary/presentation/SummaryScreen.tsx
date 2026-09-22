import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
} from 'react-native';
import {
    ChevronLeft,
    FileText,
    ListChecks,
    MessageSquare,
    BookOpen,
    Sparkles,
    RotateCw,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const formatTitle = (name?: string) => {
    if (!name) return 'Document Summary';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

const SummaryScreen = ({ route, navigation }: any) => {
    const { pdfId } = route.params;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'brief' | 'detailed'>('brief');

    const fetchDetails = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const response = await apiClient.get(`/pdf/${pdfId}`);
            setData(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [pdfId]);

    // ── Render Rich Paragraphs for Executive Summary ──
    const renderBriefContent = (text?: string) => {
        if (!text) {
            return (
                <Text style={styles.emptyCardText}>
                    Summary is being prepared. Pull down to refresh.
                </Text>
            );
        }

        const paragraphs = text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean);

        return (
            <View>
                {paragraphs.map((p, index) => (
                    <Text key={`para-${index}`} style={styles.paragraph}>
                        {p}
                    </Text>
                ))}
            </View>
        );
    };

    // ── Render Structured Bullet Cards for Detailed View ──
    const renderDetailedContent = (pointsText?: string) => {
        if (!pointsText) {
            return (
                <Text style={styles.emptyCardText}>
                    Detailed points not available yet. Pull down to refresh.
                </Text>
            );
        }

        const bullets = pointsText
            .split(/\n+/)
            .map((b) => b.replace(/^[•\-\*]\s*/, '').trim())
            .filter(Boolean);

        return (
            <View style={styles.bulletList}>
                {bullets.map((bullet, index) => {
                    const colonIndex = bullet.indexOf(':');
                    const hasHeading = colonIndex > 0 && colonIndex < 40;
                    const heading = hasHeading ? bullet.substring(0, colonIndex).trim() : null;
                    const body = hasHeading ? bullet.substring(colonIndex + 1).trim() : bullet;

                    return (
                        <View key={`bullet-${index}`} style={styles.bulletCard}>
                            <View style={styles.bulletDot} />
                            <View style={{ flex: 1 }}>
                                {heading ? (
                                    <Text style={styles.bulletHeading}>{heading}</Text>
                                ) : null}
                                <Text style={styles.bulletBody}>{body}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    // ── Loading / Buffering Screen ──
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <View style={styles.loadingCard}>
                    <View style={styles.loadingIconWrapper}>
                        <Sparkles size={36} color="#38BDF8" />
                    </View>
                    <ActivityIndicator size="large" color="#38BDF8" style={{ marginVertical: 18 }} />
                    <Text style={styles.loadingTitle}>Analyzing Document...</Text>
                    <Text style={styles.loadingSubtitle}>
                        Creating a simplified, multi-paragraph overview and extracting key study takeaways.
                    </Text>
                </View>
            </View>
        );
    }

    const title = formatTitle(data?.original_name);

    return (
        <View style={styles.container}>
            {/* ── Top Header ── */}
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <ChevronLeft size={22} color="#ffffff" />
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={styles.headerSub}>AI Knowledge Synthesis</Text>
                </View>
                <TouchableOpacity
                    onPress={() => fetchDetails(true)}
                    style={styles.refreshBtn}
                    activeOpacity={0.7}
                >
                    <RotateCw size={18} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            {/* ── Tab Selector ── */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    onPress={() => setActiveTab('brief')}
                    style={[styles.tab, activeTab === 'brief' ? styles.tabActive : styles.tabInactive]}
                    activeOpacity={0.8}
                >
                    <FileText size={17} color={activeTab === 'brief' ? '#020617' : '#94A3B8'} />
                    <Text style={[styles.tabText, { color: activeTab === 'brief' ? '#020617' : '#94A3B8' }]}>
                        Overview & Scope
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('detailed')}
                    style={[styles.tab, activeTab === 'detailed' ? styles.tabActive : styles.tabInactive]}
                    activeOpacity={0.8}
                >
                    <ListChecks size={17} color={activeTab === 'detailed' ? '#020617' : '#94A3B8'} />
                    <Text style={[styles.tabText, { color: activeTab === 'detailed' ? '#020617' : '#94A3B8' }]}>
                        Core Takeaways
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ── Main Scrollable Content ── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            fetchDetails(true);
                        }}
                        tintColor="#38BDF8"
                    />
                }
            >
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderBadge}>
                            <Sparkles size={14} color="#38BDF8" />
                            <Text style={styles.cardLabel}>
                                {activeTab === 'brief' ? 'Comprehensive Overview' : 'Key Concepts & Breakdown'}
                            </Text>
                        </View>
                    </View>

                    {activeTab === 'brief'
                        ? renderBriefContent(data?.summary_brief)
                        : renderDetailedContent(data?.summary_details?.main_points)}
                </View>

                {/* ── Action Navigation Bar ── */}
                <View style={styles.actionSection}>
                    <Text style={styles.actionSectionTitle}>Explore Next</Text>
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.quickActionBtn, { borderColor: 'rgba(56,189,248,0.25)' }]}
                            onPress={() => navigation.navigate('Chat', { pdfId })}
                            activeOpacity={0.75}
                        >
                            <MessageSquare size={20} color="#38BDF8" />
                            <View style={styles.quickActionTexts}>
                                <Text style={styles.quickActionTitle}>RAG Chat</Text>
                                <Text style={styles.quickActionSub}>Ask questions to book</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.quickActionBtn, { borderColor: 'rgba(45,212,191,0.25)' }]}
                            onPress={() => navigation.navigate('Vocabulary', { pdfId })}
                            activeOpacity={0.75}
                        >
                            <BookOpen size={20} color="#2DD4BF" />
                            <View style={styles.quickActionTexts}>
                                <Text style={styles.quickActionTitle}>Vocab Bank</Text>
                                <Text style={styles.quickActionSub}>Study terms & translate</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
        paddingTop: 48,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#020617',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    loadingCard: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 360,
    },
    loadingIconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(56,189,248,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 4,
        textAlign: 'center',
    },
    loadingSubtitle: {
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 18,
    },
    backBtn: {
        width: 40,
        height: 40,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    refreshBtn: {
        width: 40,
        height: 40,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
        marginHorizontal: 12,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
    },
    headerSub: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    tabRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
    },
    tabActive: {
        backgroundColor: '#38BDF8',
        marginRight: 6,
    },
    tabInactive: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        marginLeft: 6,
    },
    tabText: {
        marginLeft: 8,
        fontWeight: '700',
        fontSize: 13,
    },
    scroll: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: 22,
        borderRadius: 22,
        marginBottom: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    cardHeaderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(56,189,248,0.1)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
    },
    cardLabel: {
        color: '#38BDF8',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginLeft: 6,
    },
    paragraph: {
        color: '#F1F5F9',
        fontSize: 15,
        lineHeight: 25,
        marginBottom: 16,
        letterSpacing: 0.2,
    },
    bulletList: {
        marginTop: 4,
    },
    bulletCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#0B1120',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
    },
    bulletDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#38BDF8',
        marginTop: 6,
        marginRight: 12,
    },
    bulletHeading: {
        color: '#38BDF8',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    bulletBody: {
        color: '#E2E8F0',
        fontSize: 14,
        lineHeight: 22,
    },
    emptyCardText: {
        color: '#94A3B8',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        paddingVertical: 20,
    },
    actionSection: {
        marginTop: 4,
        marginBottom: 16,
    },
    actionSectionTitle: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    quickActionBtn: {
        flex: 1,
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginHorizontal: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    quickActionTexts: {
        marginLeft: 10,
        flex: 1,
    },
    quickActionTitle: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    quickActionSub: {
        color: '#64748B',
        fontSize: 11,
        marginTop: 2,
    },
});

export default SummaryScreen;
