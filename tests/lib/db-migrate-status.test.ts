/**
 * tests/lib/db-migrate-status.test.ts — Tests for `npm run db:migrate:status`.
 *
 * Verifies: table list matches schema, row counts accurate,
 * read-only (no side effects), handles missing DB.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const projectRoot = join(__dirname, '..', '..');

let testDir: string;
let dbPath: string;

function envWithDb(): NodeJS.ProcessEnv {
    return { ...process.env, DB_PATH: dbPath };
}

function runMigrate(): void {
    execSync('npx tsx scripts/setup-db.ts', {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 30000,
        env: envWithDb(),
    });
}

function runSeed(): void {
    execSync('npx tsx scripts/db-seed.ts', {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 30000,
        env: envWithDb(),
    });
}

function runStatus(): { stdout: string; stderr: string; exitCode: number } {
    try {
        const stdout = execSync('npx tsx scripts/db-migrate-status.ts', {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 30000,
            env: envWithDb(),
        });
        return { stdout, stderr: '', exitCode: 0 };
    } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; status?: number };
        return {
            stdout: e.stdout || '',
            stderr: e.stderr || '',
            exitCode: e.status ?? 1,
        };
    }
}

describe('db:migrate:status', () => {
    beforeEach(() => {
        testDir = join(tmpdir(), `db-status-test-${process.pid}-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        dbPath = join(testDir, 'cinema.db');
    });

    afterEach(() => {
        try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('lists all expected tables', () => {
        runMigrate();
        const { stdout, exitCode } = runStatus();
        expect(exitCode).toBe(0);

        // Check for expected tables
        expect(stdout).toContain('categories');
        expect(stdout).toContain('articles');
        expect(stdout).toContain('comments');
        expect(stdout).toContain('subscribers');
        expect(stdout).toContain('import_batches');
        expect(stdout).toContain('search_articles');
        expect(stdout).toContain('settings');
        expect(stdout).toContain('scrape_jobs');
        expect(stdout).toContain('app_migrations');
    });

    it('shows accurate row counts after seeding', () => {
        runMigrate();
        runSeed();
        const { stdout, exitCode } = runStatus();
        expect(exitCode).toBe(0);

        // categories should have 4 rows
        expect(stdout).toMatch(/categories\s+4 rows/);
        // settings should have 1 row (from migration)
        expect(stdout).toMatch(/settings\s+1 rows/);
    }, 15_000);

    it('shows migration count', () => {
        runMigrate();
        const { stdout } = runStatus();
        expect(stdout).toContain('Migrations applied: 5');
        expect(stdout).toContain('Last migration: 20260228_articles_scrape_fields');
    });

    it('is read-only (no side effects)', () => {
        runMigrate();

        // Run status
        runStatus();

        // Verify data is unchanged
        const db = new Database(dbPath, { readonly: true });
        const migrations = db
            .prepare('SELECT COUNT(*) as cnt FROM app_migrations')
            .get() as { cnt: number };
        db.close();

        expect(migrations.cnt).toBe(5);
    });

    it('exits 1 when database does not exist', () => {
        // dbPath doesn't exist yet (no runMigrate called)
        const result = runStatus();
        expect(result.exitCode).toBe(1);
    });

    it('shows database file size', () => {
        runMigrate();
        const { stdout } = runStatus();
        expect(stdout).toMatch(/Database:.*\(\d+ KB\)/);
    });
});
