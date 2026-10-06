import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAllSpacedCards, saveSpacedCard } from '../db/database';

export type RecallRating = 'again' | 'hard' | 'good' | 'easy';

export interface SpacedCard {
    id: string;
    term: string;
    definition: string;
    pdfId?: string;
    repetitions: number;
    intervalDays: number;
    easeFactor: number;
    nextReviewDate: number;
    lastReviewedDate?: number;
    state: 'new' | 'learning' | 'review' | 'mastered';
    history?: { timestamp: number; rating: RecallRating }[];
}

export interface DeckStats {
    total: number;
    dueCount: number;
    masteredCount: number;
    learningCount: number;
    newCount: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function applySM2(card: SpacedCard, rating: RecallRating): SpacedCard {
    const now = Date.now();
    let { repetitions, intervalDays, easeFactor } = card;

    let nextState: 'new' | 'learning' | 'review' | 'mastered' = card.state;

    switch (rating) {
        case 'again':
            repetitions = 0;
            intervalDays = 1;
            easeFactor = Math.max(1.3, easeFactor - 0.2);
            nextState = 'learning';
            break;

        case 'hard':
            repetitions += 1;
            intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
            easeFactor = Math.max(1.3, easeFactor - 0.15);
            nextState = repetitions >= 4 ? 'review' : 'learning';
            break;

        case 'good':
            repetitions += 1;
            if (repetitions === 1) {
                intervalDays = 1;
            } else if (repetitions === 2) {
                intervalDays = 6;
            } else {
                intervalDays = Math.round(intervalDays * easeFactor);
            }
            nextState = repetitions >= 5 ? 'mastered' : 'review';
            break;

        case 'easy':
            repetitions += 1;
            if (repetitions === 1) {
                intervalDays = 4;
            } else if (repetitions === 2) {
                intervalDays = 10;
            } else {
                intervalDays = Math.round(intervalDays * easeFactor * 1.3);
            }
            easeFactor = easeFactor + 0.15;
            nextState = 'mastered';
            break;
    }

    const nextReviewDate = now + intervalDays * ONE_DAY_MS;
    const history = [...(card.history || []), { timestamp: now, rating }];

    return {
        ...card,
        repetitions,
        intervalDays,
        easeFactor,
        nextReviewDate,
        lastReviewedDate: now,
        state: nextState,
        history,
    };
}


export function isCardDue(card: SpacedCard): boolean {
    if (!card.nextReviewDate) return true;
    return Date.now() >= card.nextReviewDate;
}

export function calculateDeckStats(cards: SpacedCard[]): DeckStats {
    let dueCount = 0;
    let masteredCount = 0;
    let learningCount = 0;
    let newCount = 0;

    for (const card of cards) {
        if (card.state === 'mastered') {
            masteredCount++;
        } else if (card.state === 'learning') {
            learningCount++;
        } else if (card.state === 'new') {
            newCount++;
        }

        if (isCardDue(card)) {
            dueCount++;
        }
    }

    return {
        total: cards.length,
        dueCount,
        masteredCount,
        learningCount,
        newCount,
    };
}

export async function loadSpacedCards(pdfId: string, baseTerms: { term: string; definition: string }[]): Promise<SpacedCard[]> {
    try {
        // 1. Load from SQLite
        const sqliteCards = await loadAllSpacedCards(pdfId);
        const storedMap: Record<string, SpacedCard> = {};
        for (const c of sqliteCards) {
            storedMap[c.id] = c;
            storedMap[c.term.toLowerCase()] = c;
        }

        // 2. If SQLite was empty, check AsyncStorage
        if (sqliteCards.length === 0) {
            const storageKey = `@spaced_cards_v2_${pdfId}`;
            const storedRaw = await AsyncStorage.getItem(storageKey);
            if (storedRaw) {
                const asyncMap = JSON.parse(storedRaw);
                Object.assign(storedMap, asyncMap);
            }
        }

        return baseTerms.map((b) => {
            const cardId = `${pdfId}_${b.term}`;
            const existing = storedMap[cardId] || storedMap[b.term.toLowerCase()];
            if (existing) {
                return {
                    ...existing,
                    term: b.term,
                    definition: b.definition,
                    pdfId,
                };
            }
            return {
                id: cardId,
                term: b.term,
                definition: b.definition,
                pdfId,
                repetitions: 0,
                intervalDays: 0,
                easeFactor: 2.5,
                nextReviewDate: Date.now(),
                state: 'new',
            };
        });
    } catch (e) {
        console.warn('[SM-2] Failed to load cards from SQLite:', e);
        return baseTerms.map((b) => ({
            id: `${pdfId}_${b.term}`,
            term: b.term,
            definition: b.definition,
            pdfId,
            repetitions: 0,
            intervalDays: 0,
            easeFactor: 2.5,
            nextReviewDate: Date.now(),
            state: 'new',
        }));
    }
}

export async function saveSpacedCards(pdfId: string, cards: SpacedCard[]): Promise<void> {
    try {
        // 1. Save to SQLite
        for (const card of cards) {
            await saveSpacedCard({
                ...card,
                pdfId,
            });
        }
        // 2. Mirror to AsyncStorage
        const storageKey = `@spaced_cards_v2_${pdfId}`;
        const cardMap: Record<string, SpacedCard> = {};
        for (const card of cards) {
            cardMap[card.id] = card;
        }
        await AsyncStorage.setItem(storageKey, JSON.stringify(cardMap));
    } catch (e) {
        console.warn('[SM-2] Failed to persist spaced cards:', e);
    }
}

