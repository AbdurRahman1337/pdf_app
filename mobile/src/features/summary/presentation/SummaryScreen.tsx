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
    Platform,
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
    Layers,
    ArrowLeft,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import ttsService from '../../../core/tts/ttsService';
import { saveDocumentAnalysis, loadDocumentAnalysis } from '../../../core/db/database';
import { useTheme, useSafeTopGap, getStaticSafeTopGap } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import SegmentedControl from '../../../core/components/SegmentedControl';
import { ParagraphSkeleton } from '../../../core/components/LoadingSkeleton';
import TactileButton from '../../../core/components/TactileButton';
import TactileCard from '../../../core/components/TactileCard';

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

    const { colors, shadows, isDark } = useTheme();
    const topGap = useSafeTopGap();
    const styles = useMemo(() => createStyles(colors, topGap), [colors, topGap]);

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
            // 1. Instant SQLite Cache Load
            const cached = await loadDocumentAnalysis(docId);
            if (cached) {
                setSummaryData(cached);
                if (cached.original_name) {
                    setDocTitle(formatTitle(cached.original_name));
                }
                if (cached.cheatSheet) setCheatSheetData(cached.cheatSheet);
                if (cached.podcast) setPodcastData(cached.podcast);
                setLoading(false);
            }

            // 2. Fetch fresh analysis
            const sumRes = await apiClient.get(`/pdf/${docId}`);
            setSummaryData(sumRes.data);
            if (sumRes.data?.original_name) {
                setDocTitle(formatTitle(sumRes.data.original_name));
            }

            const [cheatSheetRes, podcastRes] = await Promise.allSettled([
                apiClient.get(`/pdf/${docId}/cheat-sheet`),
                apiClient.get(`/pdf/${docId}/podcast`),
            ]);

            const freshCheatSheet = cheatSheetRes.status === 'fulfilled' ? cheatSheetRes.value.data : null;
            const freshPodcast = podcastRes.status === 'fulfilled' ? podcastRes.value.data : null;

            if (freshCheatSheet) setCheatSheetData(freshCheatSheet);
            if (freshPodcast) setPodcastData(freshPodcast);

            // 3. Persist to SQLite
            await saveDocumentAnalysis({
                doc_id: docId,
                title: sumRes.data?.original_name || docTitle,
                summary_brief: sumRes.data?.summary_brief || '',
                main_points: sumRes.data?.summary_details?.main_points || '',
                vocabulary: sumRes.data?.vocabulary || [],
                cheat_sheet: freshCheatSheet,
                podcast: freshPodcast,
            });
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
                <TouchableOpacity
                    onPress={() => {
                        ttsService.stop();
                        navigation?.goBack?.();
                    }}
                    style={styles.backBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Go Back"
                >
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {docTitle || 'Summary & Study Sheet'}
                    </Text>
                    <Text style={styles.headerSub}>Synthesis &amp; Key Takeaways</Text>
                </View>

                <View style={styles.headerActionGroup}>
                    <TouchableOpacity
                        onPress={handleCopy}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                        accessibilityLabel="Copy Content"
                    >
                        {copied ? (
                            <Check size={18} color={colors.success} strokeWidth={2.5} />
                        ) : (
                            <Copy size={18} color={colors.textMuted} strokeWidth={2} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => fetchAllDetails(selectedDocId, true)}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                        accessibilityLabel="Refresh"
                    >
                        <RotateCw size={18} color={colors.textMuted} strokeWidth={2} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Document Switcher Chips ── */}
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
                                        size={13}
                                        color={isSel ? colors.textInverse : colors.textMuted}
                                        style={{ marginRight: 6 }}
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

            {/* ── Tactile TTS Audio Narration Bar ── */}
            <View style={[styles.audioPlayerCard, { backgroundColor: colors.surface }]}>
                <View style={styles.audioPlayerLeft}>
                    <TouchableOpacity
                        style={[
                            styles.playPauseBtn,
                            {
                                backgroundColor: isPlayingAudio ? colors.blue : colors.accent,
                                borderBottomColor: isPlayingAudio ? colors.buttonBlueEdge : colors.buttonEdge,
                            },
                        ]}
                        onPress={handleToggleAudio}
                        activeOpacity={0.85}
                    >
                        {isPlayingAudio ? (
                            <Pause size={18} color={colors.textInverse} strokeWidth={2.5} />
                        ) : (
                            <Play size={18} color={colors.textInverse} strokeWidth={2.5} style={{ marginLeft: 2 }} />
                        )}
                    </TouchableOpacity>

                    <View style={styles.audioMeta}>
                        <Text style={styles.audioTitle}>
                            {isPlayingAudio ? 'Speaking Aloud (Audio Active)' : 'Audio Study Voice'}
                        </Text>
                        <Text style={styles.audioSub}>
                            {activeTab === 'podcast'
                                ? '2-Host Study Dialogue'
                                : 'AI Voice Narration'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.speedBtn}
                    onPress={handleCycleSpeed}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.speedBtnText, { color: colors.accent }]}>{speechRate}x</Text>
                </TouchableOpacity>
            </View>

            {/* ── Segmented Tab Selector ── */}
            <View style={styles.tabContainer}>
                <SegmentedControl
                    options={[
                        { key: 'brief', label: 'Summary', icon: FileText },
                        { key: 'detailed', label: 'Takeaways', icon: ListChecks },
                        { key: 'cheatsheet', label: 'Cheat Sheet', icon: Zap },
                        { key: 'podcast', label: 'Podcast', icon: Users },
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
                    <TactileCard>
                        <ParagraphSkeleton lines={6} />
                    </TactileCard>
                ) : activeTab === 'brief' ? (
                    /* Executive Multi-paragraph Summary */
                    <TactileCard contentStyle={{ padding: 20 }}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
                                <Sparkles size={14} color={colors.accent} style={{ marginRight: 6 }} />
                                <Text style={[styles.badgeText, { color: colors.accent }]}>
                                    Document Synthesis
                                </Text>
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
                    </TactileCard>
                ) : activeTab === 'detailed' ? (
                    /* Key Takeaways Bullets */
                    <TactileCard contentStyle={{ padding: 20 }}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.badge, { backgroundColor: colors.blueMuted }]}>
                                <ListChecks size={14} color={colors.blueDark} style={{ marginRight: 6 }} />
                                <Text style={[styles.badgeText, { color: colors.blueDark }]}>
                                    Core Takeaways &amp; Mechanisms
                                </Text>
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
                                            <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                                            <View style={{ flex: 1 }}>
                                                {heading && <Text style={[styles.bulletHeading, { color: colors.accent }]}>{heading}</Text>}
                                                <Text style={styles.bulletBody}>{body}</Text>
                                            </View>
                                        </View>
                                    );
                                })
                        ) : (
                            <Text style={styles.emptyCardText}>Extracting detailed key points...</Text>
                        )}
                    </TactileCard>
                ) : activeTab === 'cheatsheet' ? (
                    /* 1-Page Cheat Sheet (Formulas, Acronyms, Traps) */
                    <TactileCard contentStyle={{ padding: 20 }}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.badge, { backgroundColor: colors.goldMuted }]}>
                                <Zap size={14} color={colors.goldDark} style={{ marginRight: 6 }} />
                                <Text style={[styles.badgeText, { color: colors.goldDark }]}>
                                    High-Yield 1-Page Revision Sheet
                                </Text>
                            </View>
                        </View>

                        {cheatSheetData ? (
                            <View>
                                <Text style={styles.sheetSectionTitle}>⚡ Core Formulas &amp; Rules</Text>
                                {cheatSheetData.formulas_and_theorems?.map((it: any, idx: number) => (
                                    <View key={idx} style={styles.sheetItemBox}>
                                        <Text style={[styles.sheetItemName, { color: colors.accent }]}>{it.name}</Text>
                                        <View style={styles.formulaPill}>
                                            <Text style={styles.formulaPillText}>{it.formula_or_rule}</Text>
                                        </View>
                                        <Text style={styles.sheetItemExplanation}>{it.explanation}</Text>
                                    </View>
                                ))}

                                <Text style={styles.sheetSectionTitle}>🔑 Key Acronyms</Text>
                                <View style={styles.acronymGrid}>
                                    {cheatSheetData.key_acronyms?.map((ac: any, idx: number) => (
                                        <View key={idx} style={styles.acronymChip}>
                                            <Text style={[styles.acronymTerm, { color: colors.blueDark }]}>{ac.term}</Text>
                                            <Text style={styles.acronymDef}>{ac.definition}</Text>
                                        </View>
                                    ))}
                                </View>

                                <Text style={styles.sheetSectionTitle}>⚠️ Top Exam Traps to Avoid</Text>
                                {cheatSheetData.exam_traps_and_pitfalls?.map((trap: string, idx: number) => (
                                    <View key={idx} style={[styles.trapBox, { borderLeftColor: colors.danger }]}>
                                        <AlertTriangle size={15} color={colors.danger} style={{ marginRight: 8, marginTop: 2 }} />
                                        <Text style={styles.trapText}>{trap}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <ActivityIndicator size="small" color={colors.accent} style={{ padding: 20 }} />
                        )}
                    </TactileCard>
                ) : (
                    /* Audio Podcast Dialogue Script */
                    <TactileCard contentStyle={{ padding: 20 }}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.badge, { backgroundColor: colors.blueMuted }]}>
                                <Users size={14} color={colors.blueDark} style={{ marginRight: 6 }} />
                                <Text style={[styles.badgeText, { color: colors.blueDark }]}>
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
                                        <Text style={[styles.speakerLabel, { color: isAlex ? colors.accent : colors.blueDark }]}>
                                            {d.speaker}
                                        </Text>
                                        <Text style={styles.dialogueLine}>{d.line}</Text>
                                    </View>
                                );
                            })
                        ) : (
                            <ActivityIndicator size="small" color={colors.blue} style={{ padding: 20 }} />
                        )}
                    </TactileCard>
                )}
            </ScrollView>
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
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            marginBottom: 10,
        },
        backBtn: {
            width: 38,
            height: 38,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 2,
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
            fontSize: typography.sizes.md,
            fontWeight: '800',
        },
        headerSub: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '600',
            marginTop: 1,
        },
        headerActionGroup: {
            flexDirection: 'row',
            gap: 8,
        },
        iconBtn: {
            width: 38,
            height: 38,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 2,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        docPickerContainer: {
            paddingHorizontal: 20,
            marginBottom: 10,
        },
        docChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radii.full,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
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
            fontWeight: '700',
        },
        docChipTextActive: {
            color: colors.textInverse,
            fontWeight: '800',
        },
        audioPlayerCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: radii.xl,
            marginHorizontal: 20,
            marginBottom: 12,
            padding: 12,
        },
        audioPlayerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        playPauseBtn: {
            width: 44,
            height: 44,
            borderRadius: 22,
            borderBottomWidth: 3,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        audioMeta: {
            flex: 1,
        },
        audioTitle: {
            color: colors.text,
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        audioSub: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '600',
            marginTop: 1,
        },
        speedBtn: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        speedBtnText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        tabContainer: {
            paddingHorizontal: 20,
            marginBottom: 10,
        },
        scroll: {
            flex: 1,
            paddingHorizontal: 20,
        },
        scrollContent: {
            paddingBottom: 110,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            paddingBottom: 10,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        badge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
        },
        badgeText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        readingTimeNote: {
            color: colors.textSubtle,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        paragraph: {
            color: colors.textSecondary,
            fontSize: typography.sizes.md,
            lineHeight: 25,
            marginBottom: 14,
            fontWeight: '500',
        },
        emptyCardText: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            fontStyle: 'italic',
            textAlign: 'center',
            paddingVertical: 20,
        },
        bulletCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.lg,
            padding: 12,
            marginBottom: 8,
        },
        bulletDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            marginTop: 6,
            marginRight: 10,
        },
        bulletHeading: {
            fontSize: typography.sizes.sm,
            fontWeight: '800',
            marginBottom: 2,
        },
        bulletBody: {
            color: colors.textSecondary,
            fontSize: typography.sizes.sm,
            lineHeight: 20,
            fontWeight: '500',
        },
        sheetSectionTitle: {
            color: colors.text,
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            marginTop: 14,
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        sheetItemBox: {
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.md,
            padding: 10,
            marginBottom: 8,
        },
        sheetItemName: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            marginBottom: 4,
        },
        formulaPill: {
            alignSelf: 'flex-start',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xs,
            paddingHorizontal: 8,
            paddingVertical: 3,
            marginBottom: 6,
        },
        formulaPillText: {
            color: colors.text,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: 11,
            fontWeight: '700',
        },
        sheetItemExplanation: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            fontWeight: '500',
        },
        acronymGrid: {
            gap: 6,
            marginBottom: 10,
        },
        acronymChip: {
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.md,
            padding: 10,
        },
        acronymTerm: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
        },
        acronymDef: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            marginTop: 2,
            fontWeight: '500',
        },
        trapBox: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.md,
            padding: 10,
            marginBottom: 8,
            borderLeftWidth: 3,
        },
        trapText: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            flex: 1,
            fontWeight: '500',
        },
        dialogueBox: {
            padding: 12,
            borderRadius: radii.lg,
            marginBottom: 8,
        },
        alexBox: {
            backgroundColor: colors.accentMuted,
        },
        jordanBox: {
            backgroundColor: colors.blueMuted,
        },
        speakerLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            marginBottom: 2,
        },
        dialogueLine: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            lineHeight: 20,
            fontWeight: '500',
        },
    });

export default SummaryScreen;
