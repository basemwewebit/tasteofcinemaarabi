// src/lib/db/index.ts
import Database from 'better-sqlite3';
import { join } from 'path';

let db: Database.Database | null = null;

type DbMigration = {
    id: string;
    sql: string;
};

const DB_MIGRATIONS: DbMigration[] = [
    {
        id: '20260228_fix_articles_au_trigger',
        sql: `
            DROP TRIGGER IF EXISTS articles_au;
            CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
              DELETE FROM search_articles WHERE rowid = old.id;
              INSERT INTO search_articles(rowid, title_ar, excerpt_ar, content_rowid)
              VALUES (new.id, new.title_ar, new.excerpt_ar, new.id);
            END;
        `,
    },
    {
        id: '20260228_publish_existing_drafts_once',
        sql: `
            UPDATE articles
            SET
              status = 'published',
              published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
            WHERE status = 'draft';
        `,
    },
    {
        id: '20260228_add_settings',
        sql: `
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT OR IGNORE INTO settings (key, value) VALUES ('scrape_delay_seconds', '2');
        `,
    },
    {
        id: '20260228_add_scrape_jobs',
        sql: `
            CREATE TABLE IF NOT EXISTS scrape_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_url TEXT NOT NULL,
                status TEXT NOT NULL,
                pages_found INTEGER DEFAULT 0,
                images_found INTEGER DEFAULT 0,
                images_saved INTEGER DEFAULT 0,
                article_id INTEGER,
                error_log TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            );
        `,
    },
    {
        id: '20260228_articles_scrape_fields',
        sql: `
            ALTER TABLE articles ADD COLUMN page_count INTEGER DEFAULT 1;
            ALTER TABLE articles ADD COLUMN scraped_at DATETIME;
        `,
    },
];

function runMigrations(database: Database.Database): void {
    database['exec'](`
        CREATE TABLE IF NOT EXISTS app_migrations (
            id TEXT PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const hasMigrationStmt = database.prepare('SELECT 1 FROM app_migrations WHERE id = ? LIMIT 1');
    const markMigrationStmt = database.prepare('INSERT INTO app_migrations (id) VALUES (?)');

    for (const migration of DB_MIGRATIONS) {
        const alreadyApplied = hasMigrationStmt.get(migration.id);
        if (alreadyApplied) {
            continue;
        }

        const applyMigration = database.transaction(() => {
            database['exec'](migration.sql);
            markMigrationStmt.run(migration.id);
        });

        applyMigration();
    }
}

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
        runMigrations(db);

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
