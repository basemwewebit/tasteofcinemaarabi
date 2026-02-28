// src/lib/db/index.ts
import Database from 'better-sqlite3';
import { join } from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!db) {
        const dbPath = join(process.cwd(), 'data', 'cinema.db');
        db = new Database(dbPath, {
            // verbose: console.log, // Optional: for debugging
        });

        // Performance recommended settings
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('foreign_keys = ON');

        // Ensure cleanup
        process.on('exit', () => db?.close());
        process.on('SIGHUP', () => process.exit(128 + 1));
        process.on('SIGINT', () => process.exit(128 + 2));
        process.on('SIGTERM', () => process.exit(128 + 15));
    }
    return db;
}

/**
 * Basic utility to format dates for SQLite
 */
export function formatSqliteDate(date = new Date()): string {
    return date.toISOString().replace('T', ' ').split('.')[0];
}
