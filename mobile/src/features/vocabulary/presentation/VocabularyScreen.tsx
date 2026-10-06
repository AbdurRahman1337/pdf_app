import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    TextInput,
    Alert,
    ScrollView,
    Animated,
    Platform,
} from 'react-native';
import {
    ChevronLeft,
    Languages,
    Book,
    Check,
    Search,
    X,
    Sparkles,
    RotateCw,
    Share2,
    GraduationCap,
    Layers,
    ArrowRight,
    ArrowLeft,
    HelpCircle,
    Volume2,
    VolumeX,
    Clock,
    Flame,
    FileText,
    Award,
} from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';
import ttsService from '../../../core/tts/ttsService';
import {
    SpacedCard,
    applySM2,
    loadSpacedCards,
    saveSpacedCards,
    calculateDeckStats,
    isCardDue,
    RecallRating,
} from '../../../core/study/spacedRepetition';
import { useTheme, useSafeTopGap, getStaticSafeTopGap } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import SegmentedControl from '../../../core/components/SegmentedControl';
import EmptyState from '../../../core/components/EmptyState';
import { CardSkeleton } from '../../../core/components/LoadingSkeleton';
import TactileButton from '../../../core/components/TactileButton';
import TactileCard from '../../../core/components/TactileCard';
import TactileProgressBar from '../../../core/components/TactileProgressBar';
import CelebrationOverlay from '../../../core/components/CelebrationOverlay';

const formatTitle = (name?: string) => {
    if (!name) return 'Vocabulary Bank';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

const VocabularyScreen = ({ route, navigation }: any) => {
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

    // Cards & SM-2 state
    const [spacedCards, setSpacedCards] = useState<SpacedCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'due' | 'learning' | 'mastered'>('all');
    const [viewMode, setViewMode] = useState<'flashcards' | 'list'>('flashcards');

    // Translation state
    const [translating, setTranslating] = useState<string | null>(null);
    const [translations, setTranslations] = useState<Record<string, string>>({});

    // Flashcard deck interactive state
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [studyCompleted, setStudyCompleted] = useState(false);

    // 3D Flip animation
    const flipAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchDocs();
    }, []);

    useEffect(() => {
        if (selectedDocId) {
            fetchVocabForDoc(selectedDocId);
        }
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
            // Ignore doc fetch error
        }
    };

    const fetchVocabForDoc = async (docId: string) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/pdf/${docId}`);
            const rawVocab = response.data.vocabulary || [];
            if (response.data.original_name) {
                setDocTitle(formatTitle(response.data.original_name));
            }

            const loadedSpaced = await loadSpacedCards(docId, rawVocab);
            setSpacedCards(loadedSpaced);
            setCurrentCardIndex(0);
            setIsFlipped(false);
            flipAnim.setValue(0);
            setStudyCompleted(false);
        } catch (err) {
            console.error('Failed to fetch vocabulary bank:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── 3D Card Flip Handler ──
    const handleFlipCard = () => {
        if (isFlipped) {
            Animated.spring(flipAnim, {
                toValue: 0,
                friction: 8,
                tension: 10,
                useNativeDriver: true,
            }).start();
            setIsFlipped(false);
        } else {
            Animated.spring(flipAnim, {
                toValue: 180,
                friction: 8,
                tension: 10,
                useNativeDriver: true,
            }).start();
            setIsFlipped(true);
        }
    };

    // ── TTS Pronunciation Handler ──
    const handleSpeak = async (term: string, definition?: string) => {
        const textToSpeak = definition ? `${term}. ${definition}` : term;
        try {
            setIsSpeaking(true);
            await ttsService.speak(textToSpeak, {
                rate: 0.95,
                onDone: () => setIsSpeaking(false),
                onStopped: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
        } catch {
            setIsSpeaking(false);
        }
    };

    const handleStopSpeech = async () => {
        await ttsService.stop();
        setIsSpeaking(false);
    };

    // ── SM-2 Spaced Repetition Grading ──
    const handleGradeCard = async (rating: RecallRating) => {
        if (!spacedCards.length) return;
        const currentCard = spacedCards[currentCardIndex];
        if (!currentCard) return;

        const updatedCard = applySM2(currentCard, rating);
        const updatedList = [...spacedCards];
        updatedList[currentCardIndex] = updatedCard;

        setSpacedCards(updatedList);
        await saveSpacedCards(selectedDocId, updatedList);

        // Reset flip
        flipAnim.setValue(0);
        setIsFlipped(false);
        handleStopSpeech();

        if (currentCardIndex + 1 < spacedCards.length) {
            setCurrentCardIndex((prev) => prev + 1);
        } else {
            setStudyCompleted(true);
        }
    };

    const handleTranslate = async (term: string, definition: string) => {
        setTranslating(term);
        try {
            const response = await apiClient.post('/ai/translate', {
                text: definition,
                target_language: 'es',
            });
            setTranslations((prev) => ({ ...prev, [term]: response.data.translated_text }));
        } catch {
            Alert.alert('Translation Notice', 'Unable to translate definition right now.');
        } finally {
            setTranslating(null);
        }
    };

    const handleExport = () => {
        if (!spacedCards.length) return;
        const csvContent = spacedCards
            .map((v) => `"${v.term}","${(v.definition || '').replace(/"/g, '""')}","${v.state}"`)
            .join('\n');
        Alert.alert(
            'Export Vocabulary',
            `Exported ${spacedCards.length} cards formatted for CSV/Anki:\n\n${csvContent.substring(0, 160)}...`
        );
    };

    // Stats
    const stats = useMemo(() => calculateDeckStats(spacedCards), [spacedCards]);

    // Filtered vocabulary list for List Mode
    const filteredVocab = useMemo(() => {
        return spacedCards.filter((card) => {
            if (filterMode === 'due' && !isCardDue(card)) return false;
            if (filterMode === 'mastered' && card.state !== 'mastered') return false;
            if (filterMode === 'learning' && card.state !== 'learning' && card.state !== 'review') return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesTerm = (card.term || '').toLowerCase().includes(q);
                const matchesDef = (card.definition || '').toLowerCase().includes(q);
                return matchesTerm || matchesDef;
            }
            return true;
        });
    }, [spacedCards, filterMode, searchQuery]);

    const activeCard = spacedCards[currentCardIndex];

    // Card Rotation Interpolations for 3D Flip
    const frontInterpolate = flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['0deg', '180deg'],
    });
    const backInterpolate = flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['180deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            {/* ── Top Header ── */}
            <View style={styles.headerRow}>
                <TouchableOpacity
                    onPress={() => {
                        handleStopSpeech();
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
                        {docTitle || 'Flashcards & Words'}
                    </Text>
                    <Text style={styles.headerSub}>
                        {stats.dueCount} Due · {stats.masteredCount} Mastered · SM-2 Algorithm
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleExport}
                    style={styles.exportBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Export Cards"
                >
                    <Share2 size={18} color={colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
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
                                    onPress={() => setSelectedDocId(d.id)}
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

            {/* ── Mode Switcher (Flashcard Deck vs Word List) ── */}
            <View style={styles.viewModeContainer}>
                <SegmentedControl
                    options={[
                        { key: 'flashcards', label: 'Flashcard Deck', icon: GraduationCap },
                        { key: 'list', label: 'Word Bank', icon: Layers },
                    ]}
                    selectedKey={viewMode}
                    onSelect={(mode) => setViewMode(mode as 'flashcards' | 'list')}
                />
            </View>

            {/* ================================================================= */}
            {/* FLASHCARD STUDY MODE (3D FLIP + SM-2) */}
            {/* ================================================================= */}
            {viewMode === 'flashcards' ? (
                loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                ) : spacedCards.length === 0 ? (
                    <EmptyState
                        icon={Book}
                        title="No vocabulary indexed yet"
                        description="Upload your study materials to automatically generate active recall flashcards."
                    />
                ) : studyCompleted ? (
                    /* Study Deck Completion Summary */
                    <View style={styles.completionContainer}>
                        <TactileCard contentStyle={{ padding: 24, alignItems: 'center' }}>
                            <View style={[styles.trophyIconBg, { backgroundColor: colors.accentMuted }]}>
                                <Award size={48} color={colors.accent} strokeWidth={2.5} />
                            </View>
                            <Text style={styles.completionTitle}>Daily Review Complete!</Text>
                            <Text style={styles.completionSub}>
                                Great job! Your spaced intervals have been updated based on your recall accuracy.
                            </Text>

                            <View style={styles.scoreRow}>
                                <View style={styles.scoreBox}>
                                    <Text style={[styles.scoreNum, { color: colors.accent }]}>
                                        {stats.masteredCount}
                                    </Text>
                                    <Text style={styles.scoreLabel}>Mastered</Text>
                                </View>
                                <View style={styles.scoreBox}>
                                    <Text style={[styles.scoreNum, { color: colors.gold }]}>
                                        {stats.learningCount}
                                    </Text>
                                    <Text style={styles.scoreLabel}>In Learning</Text>
                                </View>
                                <View style={styles.scoreBox}>
                                    <Text style={[styles.scoreNum, { color: colors.blue }]}>
                                        {stats.total}
                                    </Text>
                                    <Text style={styles.scoreLabel}>Total Deck</Text>
                                </View>
                            </View>

                            <TactileButton
                                title="Review Deck Again"
                                onPress={() => {
                                    setCurrentCardIndex(0);
                                    setIsFlipped(false);
                                    flipAnim.setValue(0);
                                    setStudyCompleted(false);
                                }}
                                variant="primary"
                                size="lg"
                                fullWidth
                                icon={RotateCw}
                                style={{ marginBottom: 10 }}
                            />

                            <TactileButton
                                title="View Terminology Bank"
                                onPress={() => setViewMode('list')}
                                variant="secondary"
                                size="md"
                                fullWidth
                            />
                        </TactileCard>
                    </View>
                ) : (
                    /* Active SM-2 Flashcard */
                    <View style={styles.flashcardContainer}>
                        {/* Progress and Interval Header */}
                        <View style={styles.flashcardProgressHeader}>
                            <View style={styles.cardMetaPillRow}>
                                <Text style={styles.flashcardProgressText}>
                                    Card {currentCardIndex + 1} of {spacedCards.length}
                                </Text>
                                {activeCard?.intervalDays > 0 && (
                                    <View style={[styles.intervalBadge, { backgroundColor: colors.surfaceRaised }]}>
                                        <Clock size={12} color={colors.textMuted} />
                                        <Text style={styles.intervalBadgeText}>
                                            Interval: {activeCard.intervalDays}d
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <TactileProgressBar
                                progress={((currentCardIndex + 1) / spacedCards.length) * 100}
                                height={10}
                                variant="accent"
                            />
                        </View>

                        {/* Interactive 3D Flip Card */}
                        <TouchableOpacity
                            onPress={handleFlipCard}
                            activeOpacity={0.95}
                            style={styles.flipCardWrapper}
                            accessibilityLabel="Flashcard, tap to flip"
                        >
                            {/* Card Front */}
                            <Animated.View
                                style={[
                                    styles.flashcardSurface,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.border,
                                        transform: [{ rotateY: frontInterpolate }],
                                        backfaceVisibility: 'hidden',
                                    },
                                ]}
                            >
                                <View style={styles.cardTopRow}>
                                    <View style={[styles.cardSideBadge, { backgroundColor: colors.blueMuted }]}>
                                        <Text style={[styles.cardSideBadgeText, { color: colors.blueDark }]}>
                                            TERM
                                        </Text>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.ttsSpeakerBtn}
                                        onPress={(e) => {
                                            // @ts-ignore
                                            e.stopPropagation?.();
                                            if (isSpeaking) handleStopSpeech();
                                            else handleSpeak(activeCard.term);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        {isSpeaking ? (
                                            <VolumeX size={20} color={colors.accent} />
                                        ) : (
                                            <Volume2 size={20} color={colors.accent} />
                                        )}
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.cardCenterContent}>
                                    <Text style={[styles.flashcardTerm, { color: colors.text }]}>
                                        {activeCard?.term}
                                    </Text>
                                    <Text style={[styles.tapToFlipHint, { color: colors.textMuted }]}>
                                        Tap card to reveal definition
                                    </Text>
                                </View>

                                <View style={styles.cardBottomIndicator}>
                                    <Text style={[styles.cardStateText, { color: colors.textSubtle }]}>
                                        Status: {activeCard?.state?.toUpperCase() || 'NEW'}
                                    </Text>
                                </View>
                            </Animated.View>

                            {/* Card Back */}
                            <Animated.View
                                style={[
                                    styles.flashcardSurface,
                                    styles.flashcardBackSurface,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.accent,
                                        transform: [{ rotateY: backInterpolate }],
                                        backfaceVisibility: 'hidden',
                                    },
                                ]}
                            >
                                <View style={styles.cardTopRow}>
                                    <View style={[styles.cardSideBadge, { backgroundColor: colors.accentMuted }]}>
                                        <Text style={[styles.cardSideBadgeText, { color: colors.accent }]}>
                                            MEANING &amp; CONTEXT
                                        </Text>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.ttsSpeakerBtn}
                                        onPress={(e) => {
                                            // @ts-ignore
                                            e.stopPropagation?.();
                                            if (isSpeaking) handleStopSpeech();
                                            else handleSpeak(activeCard.term, activeCard.definition);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Volume2 size={20} color={colors.accent} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cardCenterContent}>
                                    <Text style={[styles.flashcardDefinition, { color: colors.textSecondary }]}>
                                        {activeCard?.definition}
                                    </Text>
                                    <Text style={[styles.tapToFlipHint, { color: colors.textMuted }]}>
                                        Tap to flip back
                                    </Text>
                                </ScrollView>

                                <View style={styles.cardBottomIndicator}>
                                    <Text style={[styles.cardStateText, { color: colors.accent }]}>
                                        Rate recall below to advance
                                    </Text>
                                </View>
                            </Animated.View>
                        </TouchableOpacity>

                        {/* SM-2 4-Grade Tactile Feedback Matrix */}
                        <View style={styles.gradeMatrixContainer}>
                            <Text style={styles.gradeMatrixLabel}>Rate Your Recall Confidence:</Text>
                            <View style={styles.gradeButtonRow}>
                                <View style={{ flex: 1 }}>
                                    <TactileButton
                                        title="Again"
                                        onPress={() => handleGradeCard('again')}
                                        variant="danger"
                                        size="sm"
                                        fullWidth
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <TactileButton
                                        title="Hard"
                                        onPress={() => handleGradeCard('hard')}
                                        variant="gold"
                                        size="sm"
                                        fullWidth
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <TactileButton
                                        title="Good"
                                        onPress={() => handleGradeCard('good')}
                                        variant="primary"
                                        size="sm"
                                        fullWidth
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <TactileButton
                                        title="Easy"
                                        onPress={() => handleGradeCard('easy')}
                                        variant="blue"
                                        size="sm"
                                        fullWidth
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                )
            ) : (
                /* ================================================================= */
                /* LIST VIEW MODE */
                /* ================================================================= */
                <>
                    {/* Search & Filter Chips */}
                    <View style={styles.searchSection}>
                        <View style={styles.searchWrapper}>
                            <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search terms or definitions..."
                                placeholderTextColor={colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                                    <X size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.filterChipRow}>
                            <TouchableOpacity
                                style={[styles.chip, filterMode === 'all' && styles.chipActive]}
                                onPress={() => setFilterMode('all')}
                            >
                                <Text style={[styles.chipText, filterMode === 'all' && styles.chipTextActive]}>
                                    All ({spacedCards.length})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.chip, filterMode === 'due' && styles.chipActive]}
                                onPress={() => setFilterMode('due')}
                            >
                                <Text style={[styles.chipText, filterMode === 'due' && styles.chipTextActive]}>
                                    Due Today ({stats.dueCount})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.chip, filterMode === 'mastered' && styles.chipActive]}
                                onPress={() => setFilterMode('mastered')}
                            >
                                <Text style={[styles.chipText, filterMode === 'mastered' && styles.chipTextActive]}>
                                    Mastered ({stats.masteredCount})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Word Cards List */}
                    {loading ? (
                        <View style={styles.skeletonContainer}>
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredVocab}
                            renderItem={({ item }) => (
                                <TactileCard contentStyle={{ padding: 16 }}>
                                    <View style={styles.cardHeader}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <View style={styles.termRow}>
                                                <Text style={styles.term}>{item.term}</Text>
                                                <View style={[styles.posBadge, { backgroundColor: item.state === 'mastered' ? colors.accentMuted : colors.surfaceRaised }]}>
                                                    <Text style={[styles.posBadgeText, { color: item.state === 'mastered' ? colors.accent : colors.textMuted }]}>
                                                        {item.state}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.cardActions}>
                                            <TouchableOpacity
                                                onPress={() => handleSpeak(item.term, item.definition)}
                                                style={styles.actionIconBtn}
                                                activeOpacity={0.7}
                                            >
                                                <Volume2 size={18} color={colors.accent} />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => handleTranslate(item.term, item.definition)}
                                                disabled={!!translating}
                                                style={styles.actionIconBtn}
                                                activeOpacity={0.7}
                                            >
                                                {translating === item.term ? (
                                                    <ActivityIndicator size="small" color={colors.accent} />
                                                ) : translations[item.term] ? (
                                                    <Check size={18} color={colors.success} />
                                                ) : (
                                                    <Languages size={18} color={colors.accent} />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <Text style={styles.definition}>{item.definition}</Text>

                                    {translations[item.term] && (
                                        <View style={styles.translationBox}>
                                            <View style={styles.translationHeader}>
                                                <Sparkles size={12} color={colors.blueDark} />
                                                <Text style={[styles.translationLabel, { color: colors.blueDark }]}>
                                                    Spanish Translation
                                                </Text>
                                            </View>
                                            <Text style={styles.translationText}>{translations[item.term]}</Text>
                                        </View>
                                    )}
                                </TactileCard>
                            )}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <EmptyState
                                    icon={Book}
                                    title="No matching vocabulary"
                                    description={
                                        searchQuery
                                            ? `No terms found matching "${searchQuery}".`
                                            : 'No cards available in this filter.'
                                    }
                                />
                            }
                        />
                    )}
                </>
            )}
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
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
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
        exportBtn: {
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
        viewModeContainer: {
            paddingHorizontal: 20,
            marginBottom: 12,
        },
        flashcardContainer: {
            flex: 1,
            paddingHorizontal: 20,
            paddingBottom: 110,
            justifyContent: 'space-between',
        },
        flashcardProgressHeader: {
            marginBottom: 14,
        },
        cardMetaPillRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        flashcardProgressText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        intervalBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radii.full,
        },
        intervalBadgeText: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '700',
        },
        flipCardWrapper: {
            flex: 1,
            minHeight: 300,
            position: 'relative',
        },
        flashcardSurface: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: radii.xxl,
            borderWidth: 2.5,
            padding: 20,
            justifyContent: 'space-between',
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
        },
        flashcardBackSurface: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
        cardTopRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        cardSideBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radii.full,
        },
        cardSideBadgeText: {
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.5,
        },
        ttsSpeakerBtn: {
            padding: 8,
        },
        cardCenterContent: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 20,
        },
        flashcardTerm: {
            fontSize: 26,
            fontWeight: '800',
            textAlign: 'center',
            marginBottom: 12,
            lineHeight: 32,
        },
        flashcardDefinition: {
            fontSize: typography.sizes.base,
            lineHeight: 26,
            textAlign: 'center',
            marginBottom: 12,
            fontWeight: '500',
        },
        tapToFlipHint: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            fontStyle: 'italic',
        },
        cardBottomIndicator: {
            alignItems: 'center',
            paddingTop: 8,
            borderTopWidth: 1.5,
            borderTopColor: colors.borderLight,
        },
        cardStateText: {
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.5,
        },
        gradeMatrixContainer: {
            marginTop: 16,
        },
        gradeMatrixLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            color: colors.textSecondary,
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        gradeButtonRow: {
            flexDirection: 'row',
            gap: 8,
        },
        completionContainer: {
            flex: 1,
            paddingHorizontal: 20,
            justifyContent: 'center',
        },
        trophyIconBg: {
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
        },
        completionTitle: {
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 6,
        },
        completionSub: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 20,
        },
        scoreRow: {
            flexDirection: 'row',
            width: '100%',
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.xl,
            padding: 14,
            marginBottom: 20,
            justifyContent: 'space-around',
        },
        scoreBox: {
            alignItems: 'center',
        },
        scoreNum: {
            fontSize: typography.sizes.xl,
            fontWeight: '800',
        },
        scoreLabel: {
            fontSize: 11,
            color: colors.textMuted,
            fontWeight: '700',
            marginTop: 2,
        },
        searchSection: {
            paddingHorizontal: 20,
            marginBottom: 12,
        },
        searchWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            borderRadius: radii.lg,
            paddingHorizontal: 12,
            height: 44,
            marginBottom: 10,
        },
        searchInput: {
            flex: 1,
            fontSize: typography.sizes.sm,
            color: colors.text,
            fontWeight: '600',
        },
        filterChipRow: {
            flexDirection: 'row',
            gap: 8,
        },
        chip: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radii.full,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        chipActive: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        chipText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.textMuted,
        },
        chipTextActive: {
            color: colors.textInverse,
            fontWeight: '800',
        },
        listContent: {
            paddingHorizontal: 20,
            paddingBottom: 110,
            gap: 10,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        termRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        term: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
        },
        posBadge: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: radii.xs,
        },
        posBadgeText: {
            fontSize: 10,
            fontWeight: '800',
            textTransform: 'uppercase',
        },
        cardActions: {
            flexDirection: 'row',
            gap: 6,
        },
        actionIconBtn: {
            padding: 6,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceRaised,
        },
        definition: {
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            lineHeight: 22,
            fontWeight: '500',
        },
        translationBox: {
            marginTop: 10,
            padding: 10,
            backgroundColor: colors.blueMuted,
            borderRadius: radii.md,
        },
        translationHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginBottom: 2,
        },
        translationLabel: {
            fontSize: 10,
            fontWeight: '800',
            textTransform: 'uppercase',
        },
        translationText: {
            fontSize: typography.sizes.xs,
            color: colors.text,
            fontWeight: '600',
        },
        skeletonContainer: {
            paddingHorizontal: 20,
            gap: 10,
        },
    });

export default VocabularyScreen;
