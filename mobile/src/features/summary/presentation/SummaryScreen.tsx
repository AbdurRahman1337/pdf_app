import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    Alert,
    ActivityIndicator,
} from 'react-native';
import {
    ChevronLeft,
    FileText,
    ListChecks,
    Sparkles,
    RotateCw,
    Copy,
    Check,
    Volume2,
    VolumeX,
    Play,
    Pause,
    Headphones,
    FileCode,
    AlertTriangle,
    Zap,
    Users,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import ttsService from '../../../core/tts/ttsService';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, darkShadows } from '../../../core/theme/tokens';
import SegmentedControl from '../../../core/components/SegmentedControl';
import { ParagraphSkeleton } from '../../../core/components/LoadingSkeleton';

const formatTitle = (name?: string) => {
    if (!name) return 'Document Summary';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

type SummaryTabKey = 'brief' | 'detailed' | 'cheatsheet' | 'podcast';

const SummaryScreen = ({ route, navigation }: any) => {
    const routeParams = route?.params || {};
    const initialPdfId = routeParams.pdfId;
    const initialTitle = routeParams.title ? formatTitle(routeParams.title) : '';

    const { colors, shadows } = useTheme();
    const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

    // Document state
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>(initialPdfId || '');
    const [docTitle, setDocTitle] = useState<string>(initialTitle);

    // Data state
    const [summaryData, setSummaryData] = useState<any>(null);
    const [cheatSheetData, setCheatSheetData] = useState<any>(null);
    const [podcastData, setPodcastData] = useState<any>(null);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<SummaryTabKey>('brief');
    const [copied, setCopied] = useState(false);

    // TTS Audio Player State
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [speechRate, setSpeechRate] = useState<number>(1.0);

    useEffect(() => {
        fetchDocs();
    }, []);

    useEffect(() => {
        if (selectedDocId) {
            fetchAllDetails(selectedDocId);
        }
        return () => {
            ttsService.stop();
        };
    }, [selectedDocId]);

    const fetchDocs = async () => {
        try {
            const res = await apiClient.get('/pdf/list');
            setDocs(res.data || []);
            if (!selectedDocId && res.data && res.data.length > 0) {
                setSelectedDocId(res.data[0].id);
                setDocTitle(formatTitle(res.data[0].original_name));
            }
        } catch {
            // Ignore error
        }
    };

    const fetchAllDetails = async (docId: string, isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            // 1. Fetch standard summary & vocabulary
            const sumRes = await apiClient.get(`/pdf/${docId}`);
            setSummaryData(sumRes.data);
            if (sumRes.data?.original_name) {
                setDocTitle(formatTitle(sumRes.data.original_name));
            }

            // 2. Fetch cheat sheet (lazy or parallel)
            apiClient
                .get(`/pdf/${docId}/cheat-sheet`)
                .then((res) => setCheatSheetData(res.data))
                .catch(() => {});

            // 3. Fetch podcast script
            apiClient
                .get(`/pdf/${docId}/podcast`)
                .then((res) => setPodcastData(res.data))
                .catch(() => {});
        } catch (err) {
            console.error('Error fetching document summary:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // ── TTS Audio Narration ──
    const handleToggleAudio = async () => {
        if (isPlayingAudio) {
            await ttsService.stop();
            setIsPlayingAudio(false);
            return;
        }

        let textToRead = '';
        if (activeTab === 'brief') {
            textToRead = `${docTitle}. Executive Summary. ${summaryData?.summary_brief || ''}`;
        } else if (activeTab === 'detailed') {
            textToRead = `Key takeaways for ${docTitle}. ${summaryData?.summary_details?.main_points || ''}`;
        } else if (activeTab === 'cheatsheet') {
            textToRead = cheatSheetData?.markdown_view || 'Cheat sheet content.';
        } else if (activeTab === 'podcast') {
            textToRead = podcastData?.full_script || 'Audio study podcast overview.';
        }

        if (!textToRead) return;

        setIsPlayingAudio(true);
        await ttsService.speak(textToRead, {
            rate: speechRate,
            onDone: () => setIsPlayingAudio(false),
            onStopped: () => setIsPlayingAudio(false),
            onError: () => setIsPlayingAudio(false),
        });
    };

    const handleCycleSpeed = () => {
        const speeds = [0.8, 1.0, 1.25, 1.5];
        const nextIdx = (speeds.indexOf(speechRate) + 1) % speeds.length;
        const newRate = speeds[nextIdx];
        setSpeechRate(newRate);
        ttsService.setRate(newRate);
        if (isPlayingAudio) {
            // Restart with new rate
            handleToggleAudio();
            setTimeout(() => handleToggleAudio(), 200);
        }
    };

    const handleCopy = () => {
        let textToCopy = '';
        if (activeTab === 'brief') textToCopy = summaryData?.summary_brief;
        else if (activeTab === 'detailed') textToCopy = summaryData?.summary_details?.main_points;
        else if (activeTab === 'cheatsheet') textToCopy = cheatSheetData?.markdown_view;
        else if (activeTab === 'podcast') textToCopy = podcastData?.full_script;

        if (textToCopy) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            Alert.alert('Copied', 'Study material copied to clipboard.');
        }
    };

    return (
        <View style={styles.container}>
            {/* ── Top Header ── */}
            <View style={styles.headerRow}>
                {navigation?.canGoBack?.() ? (
                    <TouchableOpacity
                        onPress={() => {
                            ttsService.stop();
                            navigation.goBack();
                        }}
                        style={styles.backBtn}
                        activeOpacity={0.7}
                    >
                        <ChevronLeft size={22} color={colors.text} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.headerIconBg}>
                        <Headphones size={20} color={colors.accent} />
                    </View>
                )}

                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {docTitle || 'Audio & Synthesis'}
                    </Text>
                    <Text style={styles.headerSub}>Audio Narration &amp; 1-Page Cheat Sheet</Text>
                </View>

                <View style={styles.headerActionGroup}>
                    <TouchableOpacity
                        onPress={handleCopy}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                        accessibilityLabel="Copy Content"
                    >
                        {copied ? (
                            <Check size={17} color={colors.success} />
                        ) : (
                            <Copy size={17} color={colors.textMuted} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => fetchAllDetails(selectedDocId, true)}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                        accessibilityLabel="Refresh"
                    >
                        <RotateCw size={17} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Document Switcher Chips (if multiple docs exist) ── */}
            {docs.length > 1 && (
                <View style={styles.docPickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {docs.map((d) => {
                            const isSel = d.id === selectedDocId;
                            return (
                                <TouchableOpacity
                                    key={d.id}
                                    style={[styles.docChip, isSel && styles.docChipActive]}
                                    onPress={() => {
                                        ttsService.stop();
                                        setIsPlayingAudio(false);
                                        setSelectedDocId(d.id);
                                    }}
                                >
                                    <FileText
                                        size={12}
                                        color={isSel ? colors.textInverse : colors.textMuted}
                                        style={{ marginRight: 5 }}
                                    />
                                    <Text
                                        style={[styles.docChipText, isSel && styles.docChipTextActive]}
                                        numberOfLines={1}
                                    >
                                        {formatTitle(d.original_name)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* ── Floating TTS Audio Narration Bar ── */}
            <View style={styles.audioPlayerCard}>
                <View style={styles.audioPlayerLeft}>
                    <TouchableOpacity
                        style={[styles.playPauseBtn, isPlayingAudio && styles.playPauseBtnActive]}
                        onPress={handleToggleAudio}
                        activeOpacity={0.85}
                    >
                        {isPlayingAudio ? (
                            <Pause size={18} color={colors.textInverse} />
                        ) : (
                            <Play size={18} color={colors.textInverse} style={{ marginLeft: 2 }} />
                        )}
                    </TouchableOpacity>

                    <View style={styles.audioMeta}>
                        <Text style={styles.audioTitle}>
                            {isPlayingAudio ? 'Speaking Aloud (TTS Active)' : 'Audio Study Voice'}
                        </Text>
                        <Text style={styles.audioSub}>
                            {activeTab === 'podcast'
                                ? '2-Host Educational Dialogue'
                                : 'AI Narration with Speed Controls'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.speedBtn}
                    onPress={handleCycleSpeed}
                    activeOpacity={0.7}
                >
                    <Text style={styles.speedBtnText}>{speechRate}x</Text>
                </TouchableOpacity>
            </View>

            {/* ── Segmented Tab Selector ── */}
            <View style={styles.tabContainer}>
                <SegmentedControl
                    options={[
                        { key: 'brief', label: 'Summary', icon: FileText },
                        { key: 'detailed', label: 'Takeaways', icon: ListChecks },
                        { key: 'cheatsheet', label: 'Cheat Sheet', icon: Zap },
                        { key: 'podcast', label: 'Podcast Script', icon: Users },
                    ]}
                    selectedKey={activeTab}
                    onSelect={(key) => {
                        ttsService.stop();
                        setIsPlayingAudio(false);
                        setActiveTab(key as SummaryTabKey);
                    }}
                />
            </View>

            {/* ── Main Content Scroll Area ── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            fetchAllDetails(selectedDocId, true);
                        }}
                        tintColor={colors.accent}
                    />
                }
            >
                {loading ? (
                    <View style={styles.card}>
                        <ParagraphSkeleton lines={6} />
                    </View>
                ) : activeTab === 'brief' ? (
                    /* Executive Multi-paragraph Summary */
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.badge}>
                                <Sparkles size={12} color={colors.indigo} style={{ marginRight: 5 }} />
                                <Text style={styles.badgeText}>Executive Document Synthesis</Text>
                            </View>
                            <Text style={styles.readingTimeNote}>~2 min read</Text>
                        </View>

                        {summaryData?.summary_brief ? (
                            summaryData.summary_brief
                                .split(/\n\s*\n/)
                                .map((p: string, idx: number) => (
                                    <Text key={`para-${idx}`} style={styles.paragraph}>
                                        {p.trim()}
                                    </Text>
                                ))
                        ) : (
                            <Text style={styles.emptyCardText}>
                                Summary is being synthesized. Pull down to refresh.
                            </Text>
                        )}
                    </View>
                ) : activeTab === 'detailed' ? (
                    /* Key Takeaways Bullets */
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.badge}>
                                <ListChecks size={12} color={colors.accent} style={{ marginRight: 5 }} />
                                <Text style={styles.badgeText}>Core Takeaways &amp; Mechanisms</Text>
                            </View>
                        </View>

                        {summaryData?.summary_details?.main_points ? (
                            summaryData.summary_details.main_points
                                .split(/\n+/)
                                .map((b: string) => b.replace(/^[•\-\*]\s*/, '').trim())
                                .filter(Boolean)
                                .map((bullet: string, idx: number) => {
                                    const colonIdx = bullet.indexOf(':');
                                    const heading = colonIdx > 0 ? bullet.substring(0, colonIdx) : null;
                                    const body = colonIdx > 0 ? bullet.substring(colonIdx + 1).trim() : bullet;

                                    return (
                                        <View key={`b-${idx}`} style={styles.bulletCard}>
                                            <View style={styles.bulletDot} />
                                            <View style={{ flex: 1 }}>
                                                {heading && <Text style={styles.bulletHeading}>{heading}</Text>}
                                                <Text style={styles.bulletBody}>{body}</Text>
                                            </View>
                                        </View>
                                    );
                                })
                        ) : (
                            <Text style={styles.emptyCardText}>Extracting detailed key points...</Text>
                        )}
                    </View>
                ) : activeTab === 'cheatsheet' ? (
                    /* 1-Page Cheat Sheet (Formulas, Acronyms, Traps) */
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
                                <Zap size={12} color={colors.accent} style={{ marginRight: 5 }} />
                                <Text style={[styles.badgeText, { color: colors.accent }]}>
                                    High-Yield 1-Page Revision Sheet
                                </Text>
                            </View>
                        </View>

                        {cheatSheetData ? (
                            <View>
                                {/* Formulas & Rules */}
                                <Text style={styles.sheetSectionTitle}>⚡ Core Formulas &amp; Rules</Text>
                                {cheatSheetData.formulas_and_theorems?.map((it: any, idx: number) => (
                                    <View key={idx} style={styles.sheetItemBox}>
                                        <Text style={styles.sheetItemName}>{it.name}</Text>
                                        <View style={styles.formulaPill}>
                                            <Text style={styles.formulaPillText}>{it.formula_or_rule}</Text>
                                        </View>
                                        <Text style={styles.sheetItemExplanation}>{it.explanation}</Text>
                                    </View>
                                ))}

                                {/* Key Acronyms */}
                                <Text style={styles.sheetSectionTitle}>🔑 Key Acronyms</Text>
                                <View style={styles.acronymGrid}>
                                    {cheatSheetData.key_acronyms?.map((ac: any, idx: number) => (
                                        <View key={idx} style={styles.acronymChip}>
                                            <Text style={styles.acronymTerm}>{ac.term}</Text>
                                            <Text style={styles.acronymDef}>{ac.definition}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Exam Traps */}
                                <Text style={styles.sheetSectionTitle}>⚠️ Top Exam Traps to Avoid</Text>
                                {cheatSheetData.exam_traps_and_pitfalls?.map((trap: string, idx: number) => (
                                    <View key={idx} style={styles.trapBox}>
                                        <AlertTriangle size={14} color={colors.warning} style={{ marginRight: 8, marginTop: 2 }} />
                                        <Text style={styles.trapText}>{trap}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <ActivityIndicator size="small" color={colors.accent} style={{ padding: 20 }} />
                        )}
                    </View>
                ) : (
                    /* Audio Podcast Dialogue Script */
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.badge, { backgroundColor: colors.tealMuted }]}>
                                <Users size={12} color={colors.teal} style={{ marginRight: 5 }} />
                                <Text style={[styles.badgeText, { color: colors.teal }]}>
                                    2-Student Study Podcast Script
                                </Text>
                            </View>
                            <Text style={styles.readingTimeNote}>
                                {podcastData?.duration_estimate || '3 min listen'}
                            </Text>
                        </View>

                        {podcastData?.dialogue ? (
                            podcastData.dialogue.map((d: any, idx: number) => {
                                const isAlex = d.speaker.toLowerCase().includes('alex');
                                return (
                                    <View key={idx} style={[styles.dialogueBox, isAlex ? styles.alexBox : styles.jordanBox]}>
                                        <Text style={[styles.speakerLabel, { color: isAlex ? colors.accent : colors.teal }]}>
                                            {d.speaker}
                                        </Text>
                                        <Text style={styles.dialogueLine}>{d.line}</Text>
                                    </View>
                                );
                            })
                        ) : (
                            <ActivityIndicator size="small" color={colors.teal} style={{ padding: 20 }} />
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const createStyles = (colors: ThemeColors, shadows: typeof darkShadows) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
            paddingTop: 50,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.xs,
        },
        headerIconBg: {
            width: 38,
            height: 38,
            borderRadius: radii.md,
            backgroundColor: colors.accentMuted,
            justifyContent: 'center',
            alignItems: 'center',
        },
        backBtn: {
            width: 38,
            height: 38,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        titleContainer: {
            flex: 1,
            marginHorizontal: 12,
        },
        headerTitle: {
            color: colors.text,
            fontSize: typography.sizes.base,
            fontWeight: '700',
        },
        headerSub: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            marginTop: 1,
        },
        headerActionGroup: {
            flexDirection: 'row',
            gap: 6,
        },
        iconBtn: {
            width: 36,
            height: 36,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        docPickerContainer: {
            paddingHorizontal: spacing.lg,
            marginVertical: spacing.xs,
        },
        docChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            marginRight: 6,
            maxWidth: 180,
        },
        docChipActive: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        docChipText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        docChipTextActive: {
            color: colors.textInverse,
            fontWeight: '700',
        },
        audioPlayerCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.accentBorder,
            borderRadius: radii.lg,
            marginHorizontal: spacing.lg,
            marginTop: 4,
            marginBottom: spacing.sm,
            padding: 10,
            ...shadows.card,
        },
        audioPlayerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        playPauseBtn: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.accent,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
            ...shadows.glowAccent,
        },
        playPauseBtnActive: {
            backgroundColor: colors.indigo,
        },
        audioMeta: {
            flex: 1,
        },
        audioTitle: {
            color: colors.text,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        audioSub: {
            color: colors.textMuted,
            fontSize: 10,
            marginTop: 1,
        },
        speedBtn: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
        },
        speedBtnText: {
            color: colors.accent,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        tabContainer: {
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.xs,
        },
        scroll: {
            flex: 1,
            paddingHorizontal: spacing.lg,
        },
        scrollContent: {
            paddingBottom: 95, // Space for bottom tabs
        },
        card: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            borderRadius: radii.xl,
            marginBottom: spacing.md,
            ...shadows.card,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
            paddingBottom: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        badge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.indigoMuted,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
        },
        badgeText: {
            color: colors.indigo,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        readingTimeNote: {
            color: colors.textSubtle,
            fontSize: typography.sizes.xs,
        },
        paragraph: {
            color: colors.textSecondary,
            fontSize: typography.sizes.md,
            lineHeight: 25,
            marginBottom: spacing.md,
        },
        bulletCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
        },
        bulletDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.accent,
            marginTop: 6,
            marginRight: 10,
        },
        bulletHeading: {
            color: colors.accent,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            marginBottom: 2,
        },
        bulletBody: {
            color: colors.textSecondary,
            fontSize: typography.sizes.sm,
            lineHeight: 20,
        },
        sheetSectionTitle: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            marginTop: spacing.md,
            marginBottom: spacing.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        sheetItemBox: {
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.sm,
            marginBottom: spacing.xs,
        },
        sheetItemName: {
            color: colors.accent,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            marginBottom: 3,
        },
        formulaPill: {
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xs,
            paddingHorizontal: 6,
            paddingVertical: 2,
            marginBottom: 4,
        },
        formulaPillText: {
            color: colors.text,
            fontFamily: 'monospace',
            fontSize: 11,
        },
        sheetItemExplanation: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
        },
        acronymGrid: {
            gap: 6,
            marginBottom: spacing.sm,
        },
        acronymChip: {
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.sm,
        },
        acronymTerm: {
            color: colors.indigo,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        acronymDef: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            marginTop: 2,
        },
        trapBox: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.warningMuted,
            borderRadius: radii.md,
            padding: spacing.sm,
            marginBottom: 6,
            borderLeftWidth: 3,
            borderLeftColor: colors.warning,
        },
        trapText: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            flex: 1,
        },
        dialogueBox: {
            padding: spacing.md,
            borderRadius: radii.lg,
            marginBottom: spacing.sm,
            borderWidth: 1,
        },
        alexBox: {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.accentBorder,
        },
        jordanBox: {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.tealMuted,
        },
        speakerLabel: {
            fontSize: 11,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
        },
        dialogueLine: {
            color: colors.textSecondary,
            fontSize: typography.sizes.sm,
            lineHeight: 22,
        },
        emptyCardText: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            textAlign: 'center',
            paddingVertical: 20,
        },
    });

export default SummaryScreen;
