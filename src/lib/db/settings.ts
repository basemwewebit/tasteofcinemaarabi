// src/lib/db/settings.ts
import { getDb } from './index';

export function getSetting(key: string): string | null {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, value);
}
