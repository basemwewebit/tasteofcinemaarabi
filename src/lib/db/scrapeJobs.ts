// src/lib/db/scrapeJobs.ts
import { getDb } from './index';
import { ScrapeJob, ScrapeJobUpdate } from '../../types/scraper';

export function createScrapeJob(targetUrl: string): number {
    const db = getDb();
    const stmt = db.prepare('INSERT INTO scrape_jobs (target_url, status) VALUES (?, ?)');
    const info = stmt.run(targetUrl, 'pending');
    return info.lastInsertRowid as number;
}

export function updateScrapeJob(id: number, updates: ScrapeJobUpdate): void {
    const db = getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k as keyof ScrapeJobUpdate]);
    values.push(id);

    const stmt = db.prepare(`UPDATE scrape_jobs SET ${setClause} WHERE id = ?`);
    stmt.run(...values);
}

export function getScrapeJob(id: number): ScrapeJob | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(id) as ScrapeJob | undefined;
    return row || null;
}

export function listScrapeJobs(limit: number = 20, offset: number = 0): ScrapeJob[] {
    const db = getDb();
    return db.prepare('SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT ? OFFSET ?').all(limit, offset) as ScrapeJob[];
}
