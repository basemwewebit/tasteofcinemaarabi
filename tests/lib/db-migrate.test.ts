/**
 * tests/lib/db-migrate.test.ts — Tests for `npm run db:migrate`.
 *
 * Verifies: DB file creation, schema tables present, migrations applied,
 * idempotent re-run, summary output format.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const projectRoot = join(__dirname, '..', '..');

let testDir: string;
let dbPath: string;

function runMigrate(): { stdout: string; exitCode: number } {
    try {
        const stdout = execSync('npx tsx scripts/setup-db.ts', {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 30000,
            env: { ...process.env, DB_PATH: dbPath },
        });
        return { stdout, exitCode: 0 };
    } catch (err: unknown) {
        const e = err as { stdout?: string; status?: number };
        return { stdout: e.stdout || '', exitCode: e.status ?? 1 };
    }
}

describe('db:migrate', () => {
    beforeEach(() => {
        testDir = join(tmpdir(), `db-migrate-test-${process.pid}-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        dbPath = join(testDir, 'cinema.db');
    });

    afterEach(() => {
        try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('creates the database file', () => {
        runMigrate();
        expect(existsSync(dbPath)).toBe(true);
    });

    it('creates all expected schema tables', () => {
        runMigrate();
        const db = new Database(dbPath, { readonly: true });
        const tables = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_articles_%' ORDER BY name"
            )
            .all() as { name: string }[];
        db.close();

        const tableNames = tables.map((t) => t.name);
        expect(tableNames).toContain('categories');
        expect(tableNames).toContain('articles');
        expect(tableNames).toContain('comments');
        expect(tableNames).toContain('subscribers');
        expect(tableNames).toContain('import_batches');
        expect(tableNames).toContain('search_articles');
        expect(tableNames).toContain('settings');
        expect(tableNames).toContain('scrape_jobs');
        expect(tableNames).toContain('app_migrations');
    });

    it('applies all incremental migrations', () => {
        runMigrate();
        const db = new Database(dbPath, { readonly: true });
        const migrations = db
            .prepare('SELECT id FROM app_migrations ORDER BY applied_at')
            .all() as { id: string }[];
        db.close();

        expect(migrations.length).toBe(5);
        expect(migrations.map((m) => m.id)).toContain(
            '20260228_articles_scrape_fields'
        );
    });

    it('is idempotent on re-run', () => {
        // First run
        const first = runMigrate();
        expect(first.exitCode).toBe(0);

        // Second run
        const second = runMigrate();
        expect(second.exitCode).toBe(0);
        expect(second.stdout).toContain('All migrations already applied');

        // Tables should still be intact
        const db = new Database(dbPath, { readonly: true });
        const migrations = db
            .prepare('SELECT id FROM app_migrations')
            .all() as { id: string }[];
        db.close();
        expect(migrations.length).toBe(5);
    });

    it('prints summary output with expected format', () => {
        const { stdout } = runMigrate();
        expect(stdout).toContain('Database initialized successfully');
        expect(stdout).toContain('Tables:');
        expect(stdout).toMatch(/Completed in \d+\.\d+s/);
    });
});
