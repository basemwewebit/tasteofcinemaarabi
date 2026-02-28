/**
 * scripts/db-migrate-fresh.ts — db:migrate:fresh entry point.
 *
 * Drops ALL user tables, triggers, and views then re-applies
 * data/schema.sql and incremental migrations from scratch.
 *
 * REQUIRES --force flag to execute (safety guard).
 *
 * Usage: npx tsx scripts/db-migrate-fresh.ts --force
 * Exit 0 on success, exit 1 on error or missing --force.
 */
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const dbPath = process.env.DB_PATH || join(process.cwd(), 'data', 'cinema.db');
const schemaPath = join(process.cwd(), 'data', 'schema.sql');

function main(): void {
    // Check --force flag
    const args = process.argv.slice(2);
    if (!args.includes('--force')) {
        console.error(
            '⚠️  This will DROP ALL TABLES and recreate from schema.\n' +
                `   All data in ${dbPath} will be permanently deleted.\n` +
                '   Run with --force to confirm.'
        );
        process.exit(1);
    }

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
        // Disable foreign keys for safe dropping
        db.pragma('foreign_keys = OFF');

        // Query all user-created objects from sqlite_master
        const triggers = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='trigger' AND name NOT LIKE 'sqlite_%'"
            )
            .all() as { name: string }[];

        const views = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='view' AND name NOT LIKE 'sqlite_%'"
            )
            .all() as { name: string }[];

        const tables = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            .all() as { name: string }[];

        // Drop in order: triggers → views → tables
        for (const t of triggers) {
            db['exec'](`DROP TRIGGER IF EXISTS "${t.name}"`);
        }
        for (const v of views) {
            db['exec'](`DROP VIEW IF EXISTS "${v.name}"`);
        }
        for (const t of tables) {
            db['exec'](`DROP TABLE IF EXISTS "${t.name}"`);
        }

        // Re-enable foreign keys
        db.pragma('foreign_keys = ON');

        // Re-apply schema
        db['exec'](schema);

        // Re-run incremental migrations
        const migrationsApplied = runMigrations(db);

        // Gather new table list
        const newTables = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
            .all() as { name: string }[];

        const elapsed = ((performance.now() - start) / 1000).toFixed(2);

        console.log(
            `Dropped ${tables.length} table(s), ${triggers.length} trigger(s).`
        );
        console.log(`Schema reapplied from ${schemaPath}.`);
        if (migrationsApplied > 0) {
            console.log(`Applied ${migrationsApplied} incremental migration(s).`);
        }
        console.log(`Tables: ${newTables.map((t) => t.name).join(', ')}`);
        console.log(`Fresh migration complete in ${elapsed}s.`);
    } catch (err) {
        console.error('Error during fresh migration:', err);
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
