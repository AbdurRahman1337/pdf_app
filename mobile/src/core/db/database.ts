import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export interface DBCourse {
    id: string;
    title: string;
    description?: string;
    target_exam_or_degree?: string;
    created_at: string;
    overall_progress_percentage: number;
}

export interface DBSubject {
    id: string;
    course_id: string;
    name: string;
    code?: string;
    color?: string;
    mastery_percentage: number;
    summary_brief?: string;
    vocab_count: number;
}

export interface DBDocument {
    id: string;
    course_id?: string;
    subject_id?: string;
    filename: string;
    size_bytes: number;
    chunk_count: number;
    uploaded_at?: string;
    drive_file_id?: string;
    drive_web_view_link?: string;
    status: string;
}

export interface DBDocumentAnalysis {
    doc_id: string;
    title?: string;
    summary_brief: string;
    main_points: string;
    vocabulary_json: string;
    cheat_sheet_json?: string;
    podcast_json?: string;
    updated_at: string;
}

export interface DBSpacedCard {
    id: string;
    doc_id?: string;
    term: string;
    definition: string;
    repetitions: number;
    interval_days: number;
    ease_factor: number;
    next_review_date: number;
    last_reviewed_date?: number;
    state: string;
    history_json?: string;
}

export interface DBExamHistory {
    id: string;
    date: string;
    course_title: string;
    subjects_json: string;
    score_pct: number;
    total_correct: number;
    total_questions: number;
    time_spent: number;
    subject_breakdown_json: string;
    weak_topics_json: string;
}

export interface DBChatMessage {
    id: string;
    scope_type: string;
    scope_id: string;
    sender: 'user' | 'ai';
    text: string;
    citations_json?: string;
    timestamp: string;
}

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
    if (dbInstance) {
        return dbInstance;
    }
    dbInstance = await SQLite.openDatabaseAsync('study_assistant.db');
    await initTables(dbInstance);
    return dbInstance;
}

async function initTables(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            target_exam_or_degree TEXT,
            created_at TEXT,
            overall_progress_percentage INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL,
            name TEXT NOT NULL,
            code TEXT,
            color TEXT,
            mastery_percentage INTEGER DEFAULT 0,
            summary_brief TEXT,
            vocab_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            course_id TEXT,
            subject_id TEXT,
            filename TEXT NOT NULL,
            size_bytes INTEGER DEFAULT 0,
            chunk_count INTEGER DEFAULT 0,
            uploaded_at TEXT,
            drive_file_id TEXT,
            drive_web_view_link TEXT,
            status TEXT DEFAULT 'READY'
        );

        CREATE TABLE IF NOT EXISTS document_analyses (
            doc_id TEXT PRIMARY KEY,
            title TEXT,
            summary_brief TEXT,
            main_points TEXT,
            vocabulary_json TEXT,
            cheat_sheet_json TEXT,
            podcast_json TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS spaced_cards (
            id TEXT PRIMARY KEY,
            doc_id TEXT,
            term TEXT NOT NULL,
            definition TEXT NOT NULL,
            repetitions INTEGER DEFAULT 0,
            interval_days INTEGER DEFAULT 1,
            ease_factor REAL DEFAULT 2.5,
            next_review_date INTEGER,
            last_reviewed_date INTEGER,
            state TEXT DEFAULT 'new',
            history_json TEXT
        );

        CREATE TABLE IF NOT EXISTS exam_history (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            course_title TEXT NOT NULL,
            subjects_json TEXT NOT NULL,
            score_pct REAL NOT NULL,
            total_correct INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            time_spent INTEGER NOT NULL,
            subject_breakdown_json TEXT,
            weak_topics_json TEXT
        );

        CREATE TABLE IF NOT EXISTS exam_autosave (
            key TEXT PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            scope_type TEXT NOT NULL,
            scope_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT NOT NULL,
            citations_json TEXT,
            timestamp TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_session (
            key TEXT PRIMARY KEY,
            user_json TEXT,
            google_tokens_json TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
}

// ── KV Store Helpers ─────────────────────────────────────────────────────────

export async function kvSet(key: string, value: any): Promise<void> {
    const db = await getDB();
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    await db.runAsync(
        'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)',
        [key, strVal]
    );
}

export async function kvGet<T = any>(key: string, defaultValue: T | null = null): Promise<T | null> {
    try {
        const db = await getDB();
        const row = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM kv_store WHERE key = ?',
            [key]
        );
        if (!row || row.value === undefined || row.value === null) {
            return defaultValue;
        }
        try {
            return JSON.parse(row.value) as T;
        } catch {
            return row.value as unknown as T;
        }
    } catch {
        return defaultValue;
    }
}

export async function kvRemove(key: string): Promise<void> {
    const db = await getDB();
    await db.runAsync('DELETE FROM kv_store WHERE key = ?', [key]);
}

// ── Auth & Google OAuth Persistence ──────────────────────────────────────────

export async function saveAuthSession(user: any, googleTokens: any): Promise<void> {
    const db = await getDB();
    const now = new Date().toISOString();
    await db.runAsync(
        'INSERT OR REPLACE INTO auth_session (key, user_json, google_tokens_json, updated_at) VALUES (?, ?, ?, ?)',
        [
            'current_session',
            user ? JSON.stringify(user) : null,
            googleTokens ? JSON.stringify(googleTokens) : null,
            now,
        ]
    );
}

export async function loadAuthSession(): Promise<{ user: any; googleTokens: any } | null> {
    try {
        const db = await getDB();
        const row = await db.getFirstAsync<{ user_json: string | null; google_tokens_json: string | null }>(
            'SELECT user_json, google_tokens_json FROM auth_session WHERE key = ?',
            ['current_session']
        );
        if (!row) return null;
        return {
            user: row.user_json ? JSON.parse(row.user_json) : null,
            googleTokens: row.google_tokens_json ? JSON.parse(row.google_tokens_json) : null,
        };
    } catch {
        return null;
    }
}

export async function clearAuthSession(): Promise<void> {
    const db = await getDB();
    await db.runAsync('DELETE FROM auth_session WHERE key = ?', ['current_session']);
}

// ── Courses & Hierarchy Persistence ──────────────────────────────────────────

export async function saveCoursesHierarchy(courses: any[]): Promise<void> {
    const db = await getDB();
    for (const c of courses) {
        await db.runAsync(
            `INSERT OR REPLACE INTO courses (id, title, description, target_exam_or_degree, created_at, overall_progress_percentage)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                c.id,
                c.title,
                c.description || '',
                c.target_exam_or_degree || '',
                c.created_at || new Date().toISOString(),
                c.overall_progress_percentage || 0,
            ]
        );

        if (Array.isArray(c.subjects)) {
            for (const s of c.subjects) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO subjects (id, course_id, name, code, color, mastery_percentage, summary_brief, vocab_count)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        s.id,
                        c.id,
                        s.name,
                        s.code || '',
                        s.color || '#10B981',
                        s.mastery_percentage || 0,
                        s.summary_brief || '',
                        s.vocab_count || 0,
                    ]
                );

                if (Array.isArray(s.documents)) {
                    for (const d of s.documents) {
                        await db.runAsync(
                            `INSERT OR REPLACE INTO documents (id, course_id, subject_id, filename, size_bytes, chunk_count, uploaded_at, drive_file_id, drive_web_view_link, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                d.id,
                                c.id,
                                s.id,
                                d.filename || d.original_name || 'document.pdf',
                                d.size_bytes || 0,
                                d.chunk_count || 1,
                                d.uploaded_at || new Date().toISOString(),
                                d.drive_file_id || null,
                                d.drive_web_view_link || null,
                                d.status || 'READY',
                            ]
                        );
                    }
                }
            }
        }
    }
}

export async function loadCoursesHierarchy(): Promise<any[]> {
    try {
        const db = await getDB();
        const courseRows = await db.getAllAsync<DBCourse>('SELECT * FROM courses');
        if (!courseRows || courseRows.length === 0) return [];

        const result: any[] = [];
        for (const c of courseRows) {
            const subjectRows = await db.getAllAsync<DBSubject>(
                'SELECT * FROM subjects WHERE course_id = ?',
                [c.id]
            );
            const subjects: any[] = [];
            for (const s of subjectRows) {
                const docRows = await db.getAllAsync<DBDocument>(
                    'SELECT * FROM documents WHERE subject_id = ?',
                    [s.id]
                );
                subjects.push({
                    ...s,
                    documents: docRows.map((d) => ({
                        id: d.id,
                        filename: d.filename,
                        original_name: d.filename,
                        size_bytes: d.size_bytes,
                        chunk_count: d.chunk_count,
                        uploaded_at: d.uploaded_at,
                        drive_file_id: d.drive_file_id,
                        drive_web_view_link: d.drive_web_view_link,
                        status: d.status,
                    })),
                });
            }
            result.push({
                ...c,
                subjects,
            });
        }
        return result;
    } catch (e) {
        console.warn('Error loading courses from SQLite:', e);
        return [];
    }
}

// ── Document Analyses (Summary, Cheat Sheet, Podcast) ─────────────────────────

export async function saveDocumentAnalysis(analysis: {
    doc_id: string;
    title?: string;
    summary_brief: string;
    main_points: string;
    vocabulary: any[];
    cheat_sheet?: any;
    podcast?: any;
}): Promise<void> {
    const db = await getDB();
    await db.runAsync(
        `INSERT OR REPLACE INTO document_analyses 
         (doc_id, title, summary_brief, main_points, vocabulary_json, cheat_sheet_json, podcast_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            analysis.doc_id,
            analysis.title || '',
            analysis.summary_brief || '',
            analysis.main_points || '',
            JSON.stringify(analysis.vocabulary || []),
            analysis.cheat_sheet ? JSON.stringify(analysis.cheat_sheet) : null,
            analysis.podcast ? JSON.stringify(analysis.podcast) : null,
            new Date().toISOString(),
        ]
    );
}

export async function loadDocumentAnalysis(docId: string): Promise<any | null> {
    try {
        const db = await getDB();
        const row = await db.getFirstAsync<DBDocumentAnalysis>(
            'SELECT * FROM document_analyses WHERE doc_id = ?',
            [docId]
        );
        if (!row) return null;
        return {
            id: row.doc_id,
            original_name: row.title || 'Document',
            summary_brief: row.summary_brief,
            summary_details: { main_points: row.main_points },
            vocabulary: row.vocabulary_json ? JSON.parse(row.vocabulary_json) : [],
            cheatSheet: row.cheat_sheet_json ? JSON.parse(row.cheat_sheet_json) : null,
            podcast: row.podcast_json ? JSON.parse(row.podcast_json) : null,
        };
    } catch {
        return null;
    }
}

// ── Spaced Repetition (SM-2) Flashcards ───────────────────────────────────────

export async function saveSpacedCard(card: any): Promise<void> {
    const db = await getDB();
    await db.runAsync(
        `INSERT OR REPLACE INTO spaced_cards
         (id, doc_id, term, definition, repetitions, interval_days, ease_factor, next_review_date, last_reviewed_date, state, history_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            card.id,
            card.pdfId || card.doc_id || null,
            card.term,
            card.definition,
            card.repetitions || 0,
            card.intervalDays || card.interval_days || 1,
            card.easeFactor || card.ease_factor || 2.5,
            card.nextReviewDate || card.next_review_date || Date.now(),
            card.lastReviewedDate || card.last_reviewed_date || null,
            card.state || 'new',
            card.history ? JSON.stringify(card.history) : null,
        ]
    );
}

export async function loadAllSpacedCards(pdfId?: string): Promise<any[]> {
    try {
        const db = await getDB();
        let rows: DBSpacedCard[];
        if (pdfId) {
            rows = await db.getAllAsync<DBSpacedCard>(
                'SELECT * FROM spaced_cards WHERE doc_id = ? ORDER BY next_review_date ASC',
                [pdfId]
            );
        } else {
            rows = await db.getAllAsync<DBSpacedCard>(
                'SELECT * FROM spaced_cards ORDER BY next_review_date ASC'
            );
        }
        return rows.map((r) => ({
            id: r.id,
            pdfId: r.doc_id,
            term: r.term,
            definition: r.definition,
            repetitions: r.repetitions,
            intervalDays: r.interval_days,
            easeFactor: r.ease_factor,
            nextReviewDate: r.next_review_date,
            lastReviewedDate: r.last_reviewed_date,
            state: r.state as any,
            history: r.history_json ? JSON.parse(r.history_json) : [],
        }));
    } catch {
        return [];
    }
}

// ── Exam History & Active Test Autosave ───────────────────────────────────────

export async function saveExamRecord(record: any): Promise<void> {
    const db = await getDB();
    await db.runAsync(
        `INSERT OR REPLACE INTO exam_history
         (id, date, course_title, subjects_json, score_pct, total_correct, total_questions, time_spent, subject_breakdown_json, weak_topics_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            record.id,
            record.date,
            record.courseTitle,
            JSON.stringify(record.subjects || []),
            record.scorePct,
            record.totalCorrect,
            record.totalQuestions,
            record.timeSpentSeconds || record.time_spent || 0,
            JSON.stringify(record.subjectBreakdown || []),
            JSON.stringify(record.weakTopics || []),
        ]
    );
}

export async function loadExamHistory(): Promise<any[]> {
    try {
        const db = await getDB();
        const rows = await db.getAllAsync<DBExamHistory>(
            'SELECT * FROM exam_history ORDER BY date DESC'
        );
        return rows.map((r) => ({
            id: r.id,
            date: r.date,
            courseTitle: r.course_title,
            subjects: JSON.parse(r.subjects_json || '[]'),
            scorePct: r.score_pct,
            totalCorrect: r.total_correct,
            totalQuestions: r.total_questions,
            timeSpentSeconds: r.time_spent,
            subjectBreakdown: r.subject_breakdown_json ? JSON.parse(r.subject_breakdown_json) : [],
            weakTopics: r.weak_topics_json ? JSON.parse(r.weak_topics_json) : [],
        }));
    } catch {
        return [];
    }
}

export async function saveExamAutosave(state: any): Promise<void> {
    const db = await getDB();
    await db.runAsync(
        'INSERT OR REPLACE INTO exam_autosave (key, state_json, updated_at) VALUES (?, ?, ?)',
        ['active_test', JSON.stringify(state), new Date().toISOString()]
    );
}

export async function loadExamAutosave(): Promise<any | null> {
    try {
        const db = await getDB();
        const row = await db.getFirstAsync<{ state_json: string }>(
            'SELECT state_json FROM exam_autosave WHERE key = ?',
            ['active_test']
        );
        if (!row) return null;
        return JSON.parse(row.state_json);
    } catch {
        return null;
    }
}

export async function clearExamAutosave(): Promise<void> {
    const db = await getDB();
    await db.runAsync('DELETE FROM exam_autosave WHERE key = ?', ['active_test']);
}

// ── Chat Messages Persistence ────────────────────────────────────────────────

export async function saveChatMessage(msg: {
    id: string;
    scope_type: string;
    scope_id: string;
    sender: 'user' | 'ai';
    text: string;
    citations?: any[];
    timestamp: string;
}): Promise<void> {
    const db = await getDB();
    await db.runAsync(
        `INSERT OR REPLACE INTO chat_messages
         (id, scope_type, scope_id, sender, text, citations_json, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            msg.id,
            msg.scope_type,
            msg.scope_id,
            msg.sender,
            msg.text,
            msg.citations ? JSON.stringify(msg.citations) : null,
            msg.timestamp,
        ]
    );
}

export async function loadChatMessages(scopeType: string, scopeId: string): Promise<any[]> {
    try {
        const db = await getDB();
        const rows = await db.getAllAsync<DBChatMessage>(
            'SELECT * FROM chat_messages WHERE scope_type = ? AND scope_id = ? ORDER BY timestamp ASC',
            [scopeType, scopeId]
        );
        return rows.map((r) => ({
            id: r.id,
            sender: r.sender,
            text: r.text,
            timestamp: r.timestamp,
            scope: `${r.scope_type}:${r.scope_id}`,
            citations: r.citations_json ? JSON.parse(r.citations_json) : undefined,
        }));
    } catch {
        return [];
    }
}

export async function clearChatMessages(scopeType: string, scopeId: string): Promise<void> {
    const db = await getDB();
    await db.runAsync(
        'DELETE FROM chat_messages WHERE scope_type = ? AND scope_id = ?',
        [scopeType, scopeId]
    );
}

