/**
 * scripts/setup-db.ts — db:migrate entry point.
 *
 * Creates the SQLite database, applies data/schema.sql (IF NOT EXISTS),
 * and runs incremental migrations from src/lib/db/index.ts.
 *
 * Usage: npx tsx scripts/setup-db.ts
 * Exit 0 on success, exit 1 on error.
 */
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const dbPath = process.env.DB_PATH || join(process.cwd(), 'data', 'cinema.db');
const schemaPath = join(process.cwd(), 'data', 'schema.sql');

function main(): void {
    const start = performance.now();

    // Ensure parent directory exists
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    // Read schema
    if (!existsSync(schemaPath)) {
        console.error(`Error: Schema file not found at ${schemaPath}`);
        process.exit(1);
    }

    const schema = readFileSync(schemaPath, 'utf-8');

    const db = new Database(dbPath);
    try {
        // Apply schema (CREATE TABLE IF NOT EXISTS — idempotent)
        db['exec'](schema);

        // Run incremental migrations (reuses logic from src/lib/db/index.ts)
        const migrationsApplied = runMigrations(db);

        // Gather summary info
        const tables = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
            .all() as { name: string }[];

        const elapsed = ((performance.now() - start) / 1000).toFixed(2);

        console.log(`Database initialized successfully with schema at ${dbPath}`);
        if (migrationsApplied > 0) {
            console.log(`Applied ${migrationsApplied} incremental migration(s).`);
        } else {
            console.log('All migrations already applied.');
        }
        console.log(`Tables: ${tables.map((t) => t.name).join(', ')}`);
        console.log(`Completed in ${elapsed}s.`);
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    } finally {
        db.close();
    }
}

// ---------------------------------------------------------------------------
// Inline migration runner (mirrors src/lib/db/index.ts DB_MIGRATIONS)
// ---------------------------------------------------------------------------

type DbMigration = { id: string; sql: string };

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
    {
        id: '20260228_articles_quality_report',
        sql: `
            ALTER TABLE articles ADD COLUMN quality_report TEXT DEFAULT NULL;
        `,
    },
];

function runMigrations(db: Database.Database): number {
    db['exec'](`
        CREATE TABLE IF NOT EXISTS app_migrations (
            id TEXT PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const hasMigrationStmt = db.prepare(
        'SELECT 1 FROM app_migrations WHERE id = ? LIMIT 1'
    );
    const markMigrationStmt = db.prepare(
        'INSERT INTO app_migrations (id) VALUES (?)'
    );

    let applied = 0;
    for (const migration of DB_MIGRATIONS) {
        const alreadyApplied = hasMigrationStmt.get(migration.id);
        if (alreadyApplied) continue;

        const applyMigration = db.transaction(() => {
            db['exec'](migration.sql);
            markMigrationStmt.run(migration.id);
        });
        applyMigration();
        applied++;
    }
    return applied;
}

main();
