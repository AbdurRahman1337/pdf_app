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
    Platform,
    Animated,
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
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../../../core/theme/motion';
import SegmentedControl from '../../../core/components/SegmentedControl';
import EmptyState from '../../../core/components/EmptyState';
import { CardSkeleton } from '../../../core/components/LoadingSkeleton';
import { AnimatedPressable } from '../../../core/components/AnimatedPressable';

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

    const { colors, shadows, typography, isDark } = useTheme();
    const tabAccent = colors.tabCourseHub; // Blue #2F6FED
    const styles = useMemo(() => createStyles(colors, shadows, tabAccent), [colors, shadows, tabAccent]);

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

    // Flashcard deck interactive state
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [studyCompleted, setStudyCompleted] = useState(false);

    const flipAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchDocs();
    }, []);

    useEffect(() => {
        if (selectedDocId) {
            fetchVocabForDoc(selectedDocId);
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
        triggerHaptic('selection');
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

    // Flip Card Handler
    const handleFlip = () => {
        triggerHaptic('selection');
        if (getIsReducedMotion()) {
            setIsFlipped(!isFlipped);
            return;
        }

        Animated.timing(flipAnim, {
            toValue: isFlipped ? 0 : 180,
            duration: motion.durations.flip,
            easing: motion.easings.easeOutCubic,
            useNativeDriver: true,
        }).start(() => {
            setIsFlipped(!isFlipped);
        });
    };

    // Rating handler
    const handleRateCard = async (rating: RecallRating) => {
        triggerHaptic(rating === 'good' || rating === 'easy' ? 'success' : 'warning');
        const activeCard = dueCards[currentCardIndex];
        if (!activeCard || !selectedDocId) return;

        const updated = applySM2(activeCard, rating);
        const nextDeck = spacedCards.map((c) => (c.id === updated.id ? updated : c));
        setSpacedCards(nextDeck);
        await saveSpacedCards(selectedDocId, nextDeck);

        setIsFlipped(false);
        flipAnim.setValue(0);

        if (currentCardIndex < dueCards.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
        } else {
            setStudyCompleted(true);
        }
    };

    const dueCards = useMemo(() => {
        return spacedCards.filter((c) => {
            if (filterMode === 'due') return isCardDue(c);
            if (filterMode === 'learning') return c.state === 'learning' || c.repetitions < 3;
            if (filterMode === 'mastered') return c.state === 'mastered' || c.repetitions >= 3;
            return true;
        });
    }, [spacedCards, filterMode]);

    const stats = useMemo(() => calculateDeckStats(spacedCards), [spacedCards]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <AnimatedPressable
                    onPress={() => {
                        ttsService.stop();
                        navigation?.goBack?.();
                    }}
                    style={styles.backBtn}
                >
                    <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
                </AnimatedPressable>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerSuperText}>VOCABULARY & FLASHCARDS</Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {docTitle || 'Vocabulary Bank'}
                    </Text>
                </View>
            </View>

            {/* Mode & Filter Tabs */}
            <View style={styles.viewModeWrapper}>
                <SegmentedControl
                    options={[
                        { key: 'flashcards', label: 'Flashcards', icon: Sparkles },
                        { key: 'list', label: 'Full Dictionary', icon: Book },
                    ]}
                    selectedKey={viewMode}
                    onSelect={(key) => setViewMode(key as any)}
                    activeColor={tabAccent}
                />
            </View>

            {/* ── FLASHCARD STUDY MODE ── */}
            {viewMode === 'flashcards' && (
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                    {loading ? (
                        <View style={{ paddingVertical: 20 }}>
                            <CardSkeleton />
                        </View>
                    ) : dueCards.length === 0 || studyCompleted ? (
                        <EmptyState
                            icon={Check}
                            title="All cards reviewed!"
                            description="You have reviewed all cards in this filter set. Great work!"
                            actionLabel="Review Again"
                            onAction={() => {
                                setStudyCompleted(false);
                                setCurrentCardIndex(0);
                            }}
                        />
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={[styles.deckProgressLabel, { color: colors.textMuted }]}>
                                Card {currentCardIndex + 1} of {dueCards.length}
                            </Text>

                            <AnimatedPressable
                                style={[styles.flashcardContainer, shadows.modal]}
                                onPress={handleFlip}
                                scaleTo={0.98}
                            >
                                {!isFlipped ? (
                                    <View style={styles.cardFace}>
                                        <View style={[styles.cardTag, { backgroundColor: tabAccent }]}>
                                            <Text style={styles.cardTagText}>TERM</Text>
                                        </View>
                                        <Text style={styles.cardTermText}>
                                            {dueCards[currentCardIndex].term}
                                        </Text>
                                        <AnimatedPressable
                                            style={styles.pronounceBtn}
                                            onPress={() => handleSpeak(dueCards[currentCardIndex].term)}
                                        >
                                            <Volume2 size={18} color={tabAccent} strokeWidth={2} />
                                        </AnimatedPressable>
                                        <Text style={[styles.flipHint, { color: colors.textMuted }]}>
                                            Tap card to flip
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.cardFace}>
                                        <View style={[styles.cardTag, { backgroundColor: colors.secondary }]}>
                                            <Text style={styles.cardTagText}>DEFINITION</Text>
                                        </View>
                                        <Text style={[styles.cardDefinitionText, { fontFamily: typography.fontFamily.reading }]}>
                                            {dueCards[currentCardIndex].definition}
                                        </Text>
                                    </View>
                                )}
                            </AnimatedPressable>

                            {/* Recall Rating Buttons (SM-2) */}
                            {isFlipped && (
                                <View style={styles.ratingRow}>
                                    <AnimatedPressable
                                        style={[styles.ratingBtn, { backgroundColor: colors.dangerMuted }]}
                                        onPress={() => handleRateCard('again')}
                                    >
                                        <Text style={[styles.ratingBtnText, { color: colors.danger }]}>Forgot</Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        style={[styles.ratingBtn, { backgroundColor: colors.warningMuted }]}
                                        onPress={() => handleRateCard('hard')}
                                    >
                                        <Text style={[styles.ratingBtnText, { color: colors.warning }]}>Hard</Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        style={[styles.ratingBtn, { backgroundColor: colors.successMuted }]}
                                        onPress={() => handleRateCard('good')}
                                    >
                                        <Text style={[styles.ratingBtnText, { color: colors.success }]}>Good</Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        style={[styles.ratingBtn, { backgroundColor: colors.primaryMuted }]}
                                        onPress={() => handleRateCard('easy')}
                                    >
                                        <Text style={[styles.ratingBtnText, { color: colors.primary }]}>Easy</Text>
                                    </AnimatedPressable>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}

            {/* ── LIST VIEW MODE ── */}
            {viewMode === 'list' && (
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 16 }}
                    contentContainerStyle={{ paddingBottom: 110, paddingTop: 10 }}
                    showsVerticalScrollIndicator={false}
                >
                    {spacedCards.map((card) => (
                        <View key={card.id} style={[styles.listCard, shadows.card]}>
                            <View style={styles.listCardHeader}>
                                <Text style={styles.listCardTerm}>{card.term}</Text>
                                <AnimatedPressable onPress={() => handleSpeak(card.term, card.definition)}>
                                    <Volume2 size={16} color={tabAccent} strokeWidth={2} />
                                </AnimatedPressable>
                            </View>
                            <Text style={[styles.listCardDef, { fontFamily: typography.fontFamily.reading }]}>
                                {card.definition}
                            </Text>
                        </View>
                    ))}
                </ScrollView>
            )}
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
            marginLeft: 12,
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
        viewModeWrapper: {
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        deckProgressLabel: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '700',
            marginBottom: 16,
        },
        flashcardContainer: {
            width: '92%',
            minHeight: 280,
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            justifyContent: 'center',
            alignItems: 'center',
        },
        cardFace: {
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
        },
        cardTag: {
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radii.full,
            marginBottom: 16,
        },
        cardTagText: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.5,
        },
        cardTermText: {
            fontSize: typography.sizes.xxl,
            fontWeight: '800',
            color: colors.text,
            textAlign: 'center',
        },
        pronounceBtn: {
            padding: 8,
            marginTop: 8,
        },
        flipHint: {
            fontSize: typography.sizes.xs,
            marginTop: 14,
            fontWeight: '600',
        },
        cardDefinitionText: {
            fontSize: typography.sizes.md,
            lineHeight: 26,
            color: colors.text,
            textAlign: 'center',
        },
        ratingRow: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 24,
        },
        ratingBtn: {
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: radii.controls,
        },
        ratingBtnText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        listCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.cards,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 10,
        },
        listCardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
        },
        listCardTerm: {
            fontSize: typography.sizes.md,
            fontWeight: '800',
            color: colors.text,
        },
        listCardDef: {
            fontSize: typography.sizes.sm,
            lineHeight: 22,
            color: colors.textSecondary,
        },
    });

export default VocabularyScreen;
