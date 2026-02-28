/**
 * scripts/db-migrate-status.ts — db:migrate:status entry point.
 *
 * Displays the current state of the database: tables, row counts,
 * migration status. Read-only — no side effects.
 *
 * Usage: npx tsx scripts/db-migrate-status.ts
 * Exit 0 on success, exit 1 if database not found.
 */
import Database from 'better-sqlite3';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

const dbPath = process.env.DB_PATH || join(process.cwd(), 'data', 'cinema.db');

function main(): void {
    if (!existsSync(dbPath)) {
        console.log(`Database not found at ${dbPath}`);
        console.log("Run 'npm run db:migrate' to create it.");
        process.exit(1);
    }

    const db = new Database(dbPath, { readonly: true });
    try {
        // File size
        const stats = statSync(dbPath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`Database: ${dbPath} (${sizeKB} KB)\n`);

        // List all tables with row counts (exclude FTS5 shadow tables)
        const tables = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_articles_%' ORDER BY name"
            )
            .all() as { name: string }[];

        console.log('Tables:');
        let totalRows = 0;
        const nameWidth = Math.max(...tables.map((t) => t.name.length), 10);

        for (const table of tables) {
            // Row count per table (safe — table names come from sqlite_master)
            const row = db
                .prepare(`SELECT COUNT(*) as cnt FROM "${table.name}"`)
                .get() as { cnt: number };
            const count = row.cnt;
            totalRows += count;
            console.log(
                `  ${table.name.padEnd(nameWidth)} ${String(count).padStart(6)} rows`
            );
        }

        console.log(`  ${''.padEnd(nameWidth, '-')} ${'------'}`);
        console.log(
            `  ${'Total'.padEnd(nameWidth)} ${String(totalRows).padStart(6)} rows`
        );

        // Migration info
        const hasMigrationsTable = db
            .prepare(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_migrations' LIMIT 1"
            )
            .get();

        if (hasMigrationsTable) {
            const migrations = db
                .prepare(
                    'SELECT id, applied_at FROM app_migrations ORDER BY applied_at'
                )
                .all() as { id: string; applied_at: string }[];

            console.log(`\nMigrations applied: ${migrations.length}`);
            if (migrations.length > 0) {
                const last = migrations[migrations.length - 1];
                console.log(`Last migration: ${last.id}`);
            }
        }
    } catch (err) {
        console.error('Error reading database status:', err);
        process.exit(1);
    } finally {
        db.close();
    }
}

main();
