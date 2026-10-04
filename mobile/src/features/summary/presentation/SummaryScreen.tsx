import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    Alert,
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
    Share2,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import ttsService from '../../../core/tts/ttsService';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import { motion, triggerHaptic } from '../../../core/theme/motion';
import SegmentedControl from '../../../core/components/SegmentedControl';
import { ParagraphSkeleton, CardSkeleton } from '../../../core/components/LoadingSkeleton';
import { AnimatedPressable } from '../../../core/components/AnimatedPressable';
import Toast from '../../../core/components/Toast';

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

    const { colors, shadows, typography, isDark } = useTheme();
    const tabAccent = colors.tabCourseHub; // Blue #2F6FED
    const styles = useMemo(() => createStyles(colors, shadows, tabAccent), [colors, shadows, tabAccent]);

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
    const [toastMessage, setToastMessage] = useState<string | null>(null);

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
            const sumRes = await apiClient.get(`/pdf/${docId}`);
            setSummaryData(sumRes.data);
            if (sumRes.data?.original_name) {
                setDocTitle(formatTitle(sumRes.data.original_name));
            }

            apiClient
                .get(`/pdf/${docId}/cheat-sheet`)
                .then((res) => setCheatSheetData(res.data))
                .catch(() => {});

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

        triggerHaptic('selection');
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
        triggerHaptic('selection');
        setToastMessage('Summary copied to clipboard');
    };

    return (
        <View style={styles.container}>
            {/* ── Top Header ── */}
            <View style={styles.headerRow}>
                <AnimatedPressable
                    onPress={() => {
                        ttsService.stop();
                        navigation?.goBack?.();
                    }}
                    style={styles.backBtn}
                    accessibilityLabel="Go Back"
                >
                    <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
                </AnimatedPressable>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerSuperText}>SUMMARY & NOTES</Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {docTitle || 'Document Synthesis'}
                    </Text>
                </View>

                <AnimatedPressable
                    onPress={handleCopy}
                    style={styles.actionIconButton}
                    accessibilityLabel="Copy summary"
                >
                    <Copy size={18} color={colors.textMuted} strokeWidth={1.75} />
                </AnimatedPressable>
            </View>

            {/* ── Segmented Control for Summary Mode ── */}
            <View style={styles.controlWrapper}>
                <SegmentedControl
                    options={[
                        { key: 'brief', label: 'Brief', icon: Sparkles },
                        { key: 'detailed', label: 'Takeaways', icon: ListChecks },
                        { key: 'cheatsheet', label: 'Cheat Sheet', icon: FileCode },
                        { key: 'podcast', label: 'Audio Script', icon: Headphones },
                    ]}
                    selectedKey={activeTab}
                    onSelect={(key) => setActiveTab(key as SummaryTabKey)}
                    activeColor={tabAccent}
                />
            </View>

            {/* ── Audio Narration Toolbar ── */}
            <View style={styles.audioToolbarWrapper}>
                <View style={[styles.audioToolbar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, shadows.subtle]}>
                    <View style={styles.audioInfo}>
                        <Headphones size={18} color={tabAccent} strokeWidth={2} style={{ marginRight: 8 }} />
                        <Text style={[styles.audioTitle, { color: colors.text }]}>
                            {isPlayingAudio ? 'Narration in Progress' : 'Listen to Audio Narration'}
                        </Text>
                    </View>

                    <View style={styles.audioControls}>
                        <AnimatedPressable
                            style={[styles.rateBadge, { backgroundColor: colors.surface }]}
                            onPress={handleCycleSpeed}
                        >
                            <Text style={[styles.rateText, { color: colors.textSecondary }]}>
                                {speechRate}x
                            </Text>
                        </AnimatedPressable>

                        <AnimatedPressable
                            style={[styles.playButton, { backgroundColor: isPlayingAudio ? colors.secondary : tabAccent }, shadows.glowAccent]}
                            onPress={handleToggleAudio}
                        >
                            {isPlayingAudio ? (
                                <Pause size={16} color="#FFFFFF" strokeWidth={2.5} />
                            ) : (
                                <Play size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 2 }} />
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </View>

            {/* ── Main Content Area ── */}
            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            if (selectedDocId) fetchAllDetails(selectedDocId, true);
                        }}
                        tintColor={tabAccent}
                    />
                }
            >
                {loading ? (
                    <View style={{ paddingVertical: 12 }}>
                        <CardSkeleton />
                        <ParagraphSkeleton lines={5} />
                    </View>
                ) : (
                    <View>
                        {/* Brief Summary */}
                        {activeTab === 'brief' && (
                            <View style={[styles.card, shadows.card]}>
                                <Text style={[styles.readingBody, { fontFamily: typography.fontFamily.reading }]}>
                                    {summaryData?.summary_brief || 'No summary available for this document.'}
                                </Text>
                            </View>
                        )}

                        {/* Detailed Takeaways */}
                        {activeTab === 'detailed' && (
                            <View style={[styles.card, shadows.card]}>
                                <Text style={[styles.readingBody, { fontFamily: typography.fontFamily.reading }]}>
                                    {summaryData?.summary_details?.main_points || 'No detailed takeaways available.'}
                                </Text>
                            </View>
                        )}

                        {/* Cheat Sheet */}
                        {activeTab === 'cheatsheet' && (
                            <View style={[styles.card, shadows.card]}>
                                <Text style={[styles.readingBody, { fontFamily: typography.fontFamily.reading }]}>
                                    {cheatSheetData?.markdown_view || 'Cheat sheet is being compiled for this document.'}
                                </Text>
                            </View>
                        )}

                        {/* Podcast Script */}
                        {activeTab === 'podcast' && (
                            <View style={[styles.card, shadows.card]}>
                                <Text style={[styles.readingBody, { fontFamily: typography.fontFamily.reading }]}>
                                    {podcastData?.full_script || 'Podcast script preview generated from key topics.'}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            <Toast
                visible={!!toastMessage}
                message={toastMessage || ''}
                onDismiss={() => setToastMessage(null)}
            />
        </View>
    );
};

const createStyles = (colors: ThemeColors, shadows: any, tabAccent: string) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: Platform.OS === 'ios' ? 48 : 20,
            paddingHorizontal: 16,
            paddingBottom: 10,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        backBtn: {
            width: 38,
            height: 38,
            borderRadius: radii.controls,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
        },
        headerTitleContainer: {
            flex: 1,
            marginHorizontal: 12,
        },
        headerSuperText: {
            fontSize: 10,
            fontWeight: '700',
            color: colors.textMuted,
            letterSpacing: 0.8,
        },
        headerTitle: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
            marginTop: 1,
        },
        actionIconButton: {
            width: 38,
            height: 38,
            borderRadius: radii.controls,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
        },
        controlWrapper: {
            paddingHorizontal: 16,
            paddingTop: 12,
            backgroundColor: colors.bg,
        },
        audioToolbarWrapper: {
            paddingHorizontal: 16,
            paddingTop: 10,
        },
        audioToolbar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: radii.cards,
            borderWidth: 1,
        },
        audioInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        audioTitle: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
        },
        audioControls: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        rateBadge: {
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: radii.full,
        },
        rateText: {
            fontSize: 11,
            fontWeight: '700',
        },
        playButton: {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
        },
        scrollArea: {
            flex: 1,
            paddingHorizontal: 16,
        },
        scrollContent: {
            paddingTop: 12,
            paddingBottom: 40,
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
        },
        readingBody: {
            fontSize: typography.sizes.md,
            lineHeight: 26,
            color: colors.text,
        },
    });

export default SummaryScreen;
