import React, { useState, useEffect, useMemo } from 'react';
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
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, darkShadows } from '../../../core/theme/tokens';
import SegmentedControl from '../../../core/components/SegmentedControl';
import EmptyState from '../../../core/components/EmptyState';
import { CardSkeleton } from '../../../core/components/LoadingSkeleton';

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

    const { colors, shadows } = useTheme();
    const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

    // Document state
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string>(initialPdfId || '');
    const [docTitle, setDocTitle] = useState<string>(initialTitle);

    // Cards & SM-2 state
    const [spacedCards, setSpacedCards] = useState<SpacedCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'due' | 'learning' | 'mastered'>('all');
    const [viewMode, setViewMode] = useState<'list' | 'flashcards'>('flashcards');

    // Translation state
    const [translating, setTranslating] = useState<string | null>(null);
    const [translations, setTranslations] = useState<Record<string, string>>({});

    // Flashcard deck interactive state
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [studyCompleted, setStudyCompleted] = useState(false);

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
            setStudyCompleted(false);
        } catch (err) {
            console.error('Failed to fetch vocabulary bank:', err);
        } finally {
            setLoading(false);
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

        // Advance to next card or complete deck
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
            `Exported ${spacedCards.length} terminology cards formatted for Anki/CSV:\n\n${csvContent.substring(0, 160)}...`
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

    return (
        <View style={styles.container}>
            {/* ── Top Header ── */}
            <View style={styles.headerRow}>
                {navigation?.canGoBack?.() ? (
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                        activeOpacity={0.7}
                    >
                        <ChevronLeft size={22} color={colors.text} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.headerIconBg}>
                        <Book size={20} color={colors.accent} />
                    </View>
                )}

                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {docTitle || 'Flashcards & Spaced Recall'}
                    </Text>
                    <Text style={styles.headerSub}>
                        {stats.dueCount} Due Today • {stats.masteredCount} Mastered • SM-2 Engine
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleExport}
                    style={styles.exportBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Export Cards"
                >
                    <Share2 size={17} color={colors.textMuted} />
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

            {/* ── Mode Switcher (Flashcard Deck vs Word List) ── */}
            <View style={styles.viewModeContainer}>
                <SegmentedControl
                    options={[
                        { key: 'flashcards', label: 'SM-2 Spaced Deck', icon: GraduationCap },
                        { key: 'list', label: 'Terminology Bank', icon: Layers },
                    ]}
                    selectedKey={viewMode}
                    onSelect={(mode) => setViewMode(mode as 'list' | 'flashcards')}
                />
            </View>

            {/* ================================================================= */}
            {/* FLASHCARD STUDY MODE (SM-2 ALGORITHM) */}
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
                        description="Upload a study document to automatically generate your active recall flashcard deck."
                    />
                ) : studyCompleted ? (
                    /* Study Deck Completion Summary */
                    <View style={styles.completionContainer}>
                        <View style={styles.completionCard}>
                            <View style={styles.trophyIconBg}>
                                <GraduationCap size={44} color={colors.accent} />
                            </View>
                            <Text style={styles.completionTitle}>Daily Review Complete!</Text>
                            <Text style={styles.completionSub}>
                                Your SuperMemo-2 spaced intervals have been updated based on your recall accuracy.
                            </Text>

                            <View style={styles.scoreRow}>
                                <View style={styles.scoreBox}>
                                    <Text style={[styles.scoreNum, { color: colors.success }]}>
                                        {stats.masteredCount}
                                    </Text>
                                    <Text style={styles.scoreLabel}>Mastered</Text>
                                </View>
                                <View style={styles.scoreBox}>
                                    <Text style={[styles.scoreNum, { color: colors.warning }]}>
                                        {stats.learningCount}
                                    </Text>
                                    <Text style={styles.scoreLabel}>In Learning</Text>
                                </View>
                                <View style={styles.scoreBox}>
                                    <Text style={[styles.scoreNum, { color: colors.accent }]}>
                                        {stats.total}
                                    </Text>
                                    <Text style={styles.scoreLabel}>Total Deck</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.restartBtn}
                                onPress={() => {
                                    setCurrentCardIndex(0);
                                    setIsFlipped(false);
                                    setStudyCompleted(false);
                                }}
                                activeOpacity={0.85}
                            >
                                <RotateCw size={16} color={colors.textInverse} style={{ marginRight: 6 }} />
                                <Text style={styles.restartBtnText}>Review Deck Again</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.backToListBtn}
                                onPress={() => setViewMode('list')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.backToListText}>View Terminology Bank</Text>
                            </TouchableOpacity>
                        </View>
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
                                    <View style={styles.intervalBadge}>
                                        <Clock size={11} color={colors.textMuted} />
                                        <Text style={styles.intervalBadgeText}>
                                            Interval: {activeCard.intervalDays}d (EF {activeCard.easeFactor.toFixed(1)})
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${((currentCardIndex + 1) / spacedCards.length) * 100}%` },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Interactive Flip Card */}
                        <TouchableOpacity
                            style={[
                                styles.flashcard,
                                isFlipped ? styles.flashcardBack : styles.flashcardFront,
                            ]}
                            onPress={() => setIsFlipped(!isFlipped)}
                            activeOpacity={0.92}
                        >
                            {/* Card Top Actions: Side Badge & TTS Speaker */}
                            <View style={styles.cardTopRow}>
                                <View style={styles.cardSideBadge}>
                                    <Text style={styles.cardSideBadgeText}>
                                        {isFlipped ? 'EXPLANATION & MEANING' : 'STUDY TERM'}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.ttsSpeakerBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        if (isSpeaking) {
                                            handleStopSpeech();
                                        } else {
                                            handleSpeak(
                                                activeCard.term,
                                                isFlipped ? activeCard.definition : undefined
                                            );
                                        }
                                    }}
                                    activeOpacity={0.7}
                                    accessibilityLabel="Listen to pronunciation"
                                >
                                    {isSpeaking ? (
                                        <VolumeX size={18} color={colors.accent} />
                                    ) : (
                                        <Volume2 size={18} color={colors.accent} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Card Content Area */}
                            {!isFlipped ? (
                                <View style={styles.cardCenterContent}>
                                    <Text style={styles.flashcardTerm}>{activeCard?.term}</Text>
                                    <Text style={styles.tapToFlipHint}>
                                        Tap card to reveal definition &amp; Feynman breakdown
                                    </Text>
                                </View>
                            ) : (
                                <ScrollView
                                    style={styles.cardBackScroll}
                                    contentContainerStyle={styles.cardCenterContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    <Text style={styles.flashcardDefinition}>
                                        {activeCard?.definition}
                                    </Text>
                                    <Text style={styles.tapToFlipHint}>Tap to flip back</Text>
                                </ScrollView>
                            )}

                            {/* Card Bottom State Indicator */}
                            <View style={styles.cardBottomIndicator}>
                                <Text style={styles.cardStateText}>
                                    Status: {activeCard?.state?.toUpperCase() || 'NEW'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* SM-2 4-Grade Feedback Matrix */}
                        <View style={styles.gradeMatrixContainer}>
                            <Text style={styles.gradeMatrixLabel}>Rate Your Recall Confidence (SM-2):</Text>
                            <View style={styles.gradeButtonRow}>
                                {/* Again: 1 Day */}
                                <TouchableOpacity
                                    style={[styles.sm2Btn, styles.againBtn]}
                                    onPress={() => handleGradeCard('again')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.sm2BtnText, { color: colors.danger }]}>Again</Text>
                                    <Text style={styles.sm2SubText}>&lt; 1d</Text>
                                </TouchableOpacity>

                                {/* Hard: Slight Interval */}
                                <TouchableOpacity
                                    style={[styles.sm2Btn, styles.hardBtn]}
                                    onPress={() => handleGradeCard('hard')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.sm2BtnText, { color: colors.warning }]}>Hard</Text>
                                    <Text style={styles.sm2SubText}>2d</Text>
                                </TouchableOpacity>

                                {/* Good: Standard Interval */}
                                <TouchableOpacity
                                    style={[styles.sm2Btn, styles.goodBtn]}
                                    onPress={() => handleGradeCard('good')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.sm2BtnText, { color: colors.accent }]}>Good</Text>
                                    <Text style={styles.sm2SubText}>6d</Text>
                                </TouchableOpacity>

                                {/* Easy: Boosted Interval */}
                                <TouchableOpacity
                                    style={[styles.sm2Btn, styles.easyBtn]}
                                    onPress={() => handleGradeCard('easy')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.sm2BtnText, { color: colors.success }]}>Easy</Text>
                                    <Text style={styles.sm2SubText}>10d+</Text>
                                </TouchableOpacity>
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
                            <Search size={15} color={colors.textSubtle} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search terms or concepts..."
                                placeholderTextColor={colors.textSubtle}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                                    <X size={15} color={colors.textMuted} />
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
                                <View style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <View style={styles.termRow}>
                                                <Text style={styles.term}>{item.term}</Text>
                                                <View style={styles.posBadge}>
                                                    <Text style={styles.posBadgeText}>{item.state}</Text>
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.cardActions}>
                                            {/* Audio Pronunciation Button */}
                                            <TouchableOpacity
                                                onPress={() => handleSpeak(item.term, item.definition)}
                                                style={styles.actionIconBtn}
                                                activeOpacity={0.7}
                                            >
                                                <Volume2 size={16} color={colors.accent} />
                                            </TouchableOpacity>

                                            {/* Spanish Translation Button */}
                                            <TouchableOpacity
                                                onPress={() => handleTranslate(item.term, item.definition)}
                                                disabled={!!translating}
                                                style={styles.actionIconBtn}
                                                activeOpacity={0.7}
                                            >
                                                {translating === item.term ? (
                                                    <ActivityIndicator size="small" color={colors.accent} />
                                                ) : translations[item.term] ? (
                                                    <Check size={16} color={colors.success} />
                                                ) : (
                                                    <Languages size={16} color={colors.accent} />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <Text style={styles.definition}>{item.definition}</Text>

                                    {/* Translation Preview */}
                                    {translations[item.term] && (
                                        <View style={styles.translationBox}>
                                            <View style={styles.translationHeader}>
                                                <Sparkles size={12} color={colors.indigo} />
                                                <Text style={styles.translationLabel}>Spanish Translation</Text>
                                            </View>
                                            <Text style={styles.translationText}>{translations[item.term]}</Text>
                                        </View>
                                    )}
                                </View>
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

const createStyles = (colors: ThemeColors, shadows: typeof darkShadows) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
            paddingTop: 50,
        },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
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
        exportBtn: {
            width: 38,
            height: 38,
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
        viewModeContainer: {
            paddingHorizontal: spacing.lg,
            marginVertical: spacing.sm,
        },
        flashcardContainer: {
            flex: 1,
            paddingHorizontal: spacing.lg,
            paddingBottom: 85, // Space for bottom tab bar
            justifyContent: 'space-between',
        },
        flashcardProgressHeader: {
            marginBottom: spacing.xs,
        },
        cardMetaPillRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
        },
        flashcardProgressText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        intervalBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.surfaceSubtle,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: radii.xs,
        },
        intervalBadgeText: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '600',
        },
        progressBar: {
            height: 4,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: 2,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            backgroundColor: colors.accent,
        },
        flashcard: {
            flex: 1,
            minHeight: 260,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderLight,
            borderRadius: radii.xxl || 24,
            padding: spacing.lg,
            justifyContent: 'space-between',
            ...shadows.card,
        },
        flashcardFront: {
            borderColor: colors.accentBorder,
        },
        flashcardBack: {
            borderColor: colors.indigo,
        },
        cardTopRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        cardSideBadge: {
            backgroundColor: colors.surfaceSubtle,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: radii.xs,
        },
        cardSideBadgeText: {
            color: colors.textSubtle,
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 0.8,
        },
        ttsSpeakerBtn: {
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.accentMuted,
            justifyContent: 'center',
            alignItems: 'center',
        },
        cardCenterContent: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: spacing.md,
        },
        cardBackScroll: {
            flex: 1,
        },
        flashcardTerm: {
            color: colors.text,
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            textAlign: 'center',
            marginBottom: 12,
        },
        flashcardDefinition: {
            color: colors.textSecondary,
            fontSize: typography.sizes.base,
            lineHeight: 26,
            textAlign: 'center',
            fontWeight: '500',
        },
        tapToFlipHint: {
            color: colors.textSubtle,
            fontSize: typography.sizes.xs,
            marginTop: 12,
            fontStyle: 'italic',
        },
        cardBottomIndicator: {
            alignItems: 'center',
            paddingTop: 4,
        },
        cardStateText: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        gradeMatrixContainer: {
            marginTop: spacing.md,
        },
        gradeMatrixLabel: {
            color: colors.textSubtle,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
            textAlign: 'center',
        },
        gradeButtonRow: {
            flexDirection: 'row',
            gap: 6,
        },
        sm2Btn: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.card,
        },
        againBtn: {
            borderColor: colors.dangerMuted,
        },
        hardBtn: {
            borderColor: colors.warningMuted,
        },
        goodBtn: {
            borderColor: colors.accentBorder,
        },
        easyBtn: {
            borderColor: colors.successMuted,
        },
        sm2BtnText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        sm2SubText: {
            color: colors.textSubtle,
            fontSize: 9,
            marginTop: 2,
        },
        completionContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingBottom: 85,
        },
        completionCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: spacing.xl,
            alignItems: 'center',
            width: '100%',
            ...shadows.card,
        },
        trophyIconBg: {
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: colors.accentMuted,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.md,
        },
        completionTitle: {
            color: colors.text,
            fontSize: typography.sizes.lg,
            fontWeight: '700',
            textAlign: 'center',
        },
        completionSub: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            lineHeight: 18,
            textAlign: 'center',
            marginTop: 4,
            marginBottom: spacing.lg,
        },
        scoreRow: {
            flexDirection: 'row',
            width: '100%',
            gap: 10,
            marginBottom: spacing.lg,
        },
        scoreBox: {
            flex: 1,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            paddingVertical: 10,
            alignItems: 'center',
        },
        scoreNum: {
            fontSize: 20,
            fontWeight: '800',
        },
        scoreLabel: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
        },
        restartBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
            width: '100%',
            paddingVertical: 13,
            borderRadius: radii.md,
            marginBottom: 8,
            ...shadows.glowAccent,
        },
        restartBtnText: {
            color: colors.textInverse,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        backToListBtn: {
            paddingVertical: 10,
        },
        backToListText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        searchSection: {
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.xs,
        },
        searchWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: 7,
            marginBottom: spacing.xs,
        },
        searchInput: {
            flex: 1,
            color: colors.text,
            fontSize: typography.sizes.sm,
            padding: 0,
        },
        filterChipRow: {
            flexDirection: 'row',
            gap: 6,
            marginVertical: 4,
        },
        chip: {
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
        },
        chipActive: {
            backgroundColor: colors.accentMuted,
            borderColor: colors.accent,
        },
        chipText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        chipTextActive: {
            color: colors.accent,
            fontWeight: '700',
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
            padding: spacing.md,
            borderRadius: radii.lg,
            marginBottom: spacing.sm,
            ...shadows.card,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: spacing.xs,
        },
        termRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
        },
        term: {
            color: colors.accent,
            fontSize: typography.sizes.base,
            fontWeight: '700',
        },
        posBadge: {
            backgroundColor: colors.surfaceSubtle,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: radii.xs,
        },
        posBadgeText: {
            color: colors.textSubtle,
            fontSize: 9,
            fontWeight: '800',
            textTransform: 'uppercase',
        },
        cardActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        actionIconBtn: {
            backgroundColor: colors.surfaceSubtle,
            padding: 7,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
        },
        definition: {
            color: colors.textSecondary,
            lineHeight: 20,
            fontSize: typography.sizes.sm,
            marginTop: 2,
        },
        translationBox: {
            marginTop: spacing.sm,
            padding: spacing.sm,
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            borderLeftWidth: 3,
            borderLeftColor: colors.indigo,
        },
        translationHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 3,
        },
        translationLabel: {
            color: colors.indigo,
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
            marginLeft: 4,
        },
        translationText: {
            color: colors.textSecondary,
            fontStyle: 'italic',
            fontSize: typography.sizes.xs,
        },
    });

export default VocabularyScreen;
