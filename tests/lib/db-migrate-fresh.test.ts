/**
 * tests/lib/db-migrate-fresh.test.ts — Tests for `npm run db:migrate:fresh`.
 *
 * Verifies: --force required, all tables dropped and recreated,
 * existing data removed, summary output.
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

function runMigrate(): { stdout: string; exitCode: number } {
    try {
        const stdout = execSync('npx tsx scripts/setup-db.ts', {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 30000,
            env: envWithDb(),
        });
        return { stdout, exitCode: 0 };
    } catch (err: unknown) {
        const e = err as { stdout?: string; status?: number };
        return { stdout: e.stdout || '', exitCode: e.status ?? 1 };
    }
}

function runFresh(
    args: string[] = []
): { stdout: string; stderr: string; exitCode: number } {
    try {
        const stdout = execSync(
            `npx tsx scripts/db-migrate-fresh.ts ${args.join(' ')}`,
            {
                cwd: projectRoot,
                encoding: 'utf-8',
                timeout: 30000,
                env: envWithDb(),
            }
        );
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

describe('db:migrate:fresh', () => {
    beforeEach(() => {
        testDir = join(tmpdir(), `db-fresh-test-${process.pid}-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        dbPath = join(testDir, 'cinema.db');
        // Create a fresh DB with some data
        runMigrate();
    });

    afterEach(() => {
        try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('exits 1 without --force flag', () => {
        const result = runFresh();
        expect(result.exitCode).toBe(1);
        // The warning message is on stderr
        expect(result.stderr).toContain('Run with --force to confirm');
    });

    it('drops all tables and recreates with --force', () => {
        // Insert some test data first
        const db = new Database(dbPath);
        db.prepare(
            "INSERT OR IGNORE INTO categories (slug, name_ar) VALUES ('test', 'اختبار')"
        ).run();
        const beforeCount = (
            db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as {
                cnt: number;
            }
        ).cnt;
        expect(beforeCount).toBeGreaterThan(0);
        db.close();

        // Run fresh
        const result = runFresh(['--force']);
        expect(result.exitCode).toBe(0);

        // Verify tables exist but data is cleared
        const db2 = new Database(dbPath, { readonly: true });
        const catCount = (
            db2.prepare('SELECT COUNT(*) as cnt FROM categories').get() as {
                cnt: number;
            }
        ).cnt;
        expect(catCount).toBe(0); // All data removed

        // Schema tables still present
        const tables = db2
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_articles_%' ORDER BY name"
            )
            .all() as { name: string }[];
        db2.close();

        expect(tables.map((t) => t.name)).toContain('categories');
        expect(tables.map((t) => t.name)).toContain('articles');
    });

    it('re-applies migrations after fresh', () => {
        const result = runFresh(['--force']);
        expect(result.exitCode).toBe(0);

        const db = new Database(dbPath, { readonly: true });
        const migrations = db
            .prepare('SELECT id FROM app_migrations')
            .all() as { id: string }[];
        db.close();

        expect(migrations.length).toBe(5);
    });

    it('prints summary with drop counts', () => {
        const { stdout } = runFresh(['--force']);
        expect(stdout).toContain('Dropped');
        expect(stdout).toContain('table(s)');
        expect(stdout).toContain('Schema reapplied');
        expect(stdout).toContain('Fresh migration complete');
    });
});
