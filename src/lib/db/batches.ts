import { getDb, formatSqliteDate } from './index';

export interface ImportBatch {
    id?: number;
    source_url: string;
    total_articles: number;
    translated: number;
    failed: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    started_at?: string;
    completed_at?: string | null;
}

export function createBatch(sourceUrl: string, total: number): number {
    const db = getDb();
    const stmt = db.prepare(`
    INSERT INTO import_batches (source_url, total_articles, status, started_at)
    VALUES (?, ?, 'pending', ?)
  `);
    const info = stmt.run(sourceUrl, total, formatSqliteDate());
    return info.lastInsertRowid as number;
}

export function updateBatchStatus(id: number, status: ImportBatch['status']) {
    const db = getDb();
    if (status === 'completed' || status === 'failed') {
        const stmt = db.prepare(`UPDATE import_batches SET status = ?, completed_at = ? WHERE id = ?`);
        stmt.run(status, formatSqliteDate(), id);
    } else {
        const stmt = db.prepare(`UPDATE import_batches SET status = ? WHERE id = ?`);
        stmt.run(status, id);
    }
}

export function incrementBatchSuccess(id: number) {
    const db = getDb();
    const stmt = db.prepare(`UPDATE import_batches SET translated = translated + 1 WHERE id = ?`);
    stmt.run(id);
}

export function incrementBatchFail(id: number) {
    const db = getDb();
    const stmt = db.prepare(`UPDATE import_batches SET failed = failed + 1 WHERE id = ?`);
    stmt.run(id);
}

export function getBatches(): ImportBatch[] {
    const db = getDb();
    const stmt = db.prepare(`SELECT * FROM import_batches ORDER BY started_at DESC`);
    return stmt.all() as ImportBatch[];
}
