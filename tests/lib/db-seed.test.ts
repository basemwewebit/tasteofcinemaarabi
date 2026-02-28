/**
 * tests/lib/db-seed.test.ts — Tests for `npm run db:seed`.
 *
 * Verifies: 4 categories inserted, idempotent on re-run, transaction behavior.
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

function runSeed(): { stdout: string; exitCode: number } {
    try {
        const stdout = execSync('npx tsx scripts/db-seed.ts', {
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

describe('db:seed', () => {
    beforeEach(() => {
        testDir = join(tmpdir(), `db-seed-test-${process.pid}-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        dbPath = join(testDir, 'cinema.db');
        runMigrate();
    });

    afterEach(() => {
        try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('inserts 4 canonical categories', () => {
        const result = runSeed();
        expect(result.exitCode).toBe(0);

        const db = new Database(dbPath, { readonly: true });
        const categories = db
            .prepare('SELECT slug, name_ar, name_en, sort_order FROM categories ORDER BY sort_order')
            .all() as { slug: string; name_ar: string; name_en: string; sort_order: number }[];
        db.close();

        expect(categories).toHaveLength(4);
        expect(categories[0].slug).toBe('features');
        expect(categories[0].name_ar).toBe('مقالات مميزة');
        expect(categories[1].slug).toBe('film-lists');
        expect(categories[2].slug).toBe('reviews');
        expect(categories[3].slug).toBe('editorial');
    });

    it('is idempotent on re-run (no duplicates)', () => {
        runSeed();
        const result = runSeed();
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Seeded 0 new category(ies) (4 already existed)');

        const db = new Database(dbPath, { readonly: true });
        const count = (
            db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as {
                cnt: number;
            }
        ).cnt;
        db.close();

        expect(count).toBe(4);
    });

    it('exits 1 when database does not exist', () => {
        // Use a non-existent DB path
        const badDir = join(tmpdir(), `db-seed-noexist-${Date.now()}`);
        mkdirSync(badDir, { recursive: true });
        const badPath = join(badDir, 'nonexistent.db');
        try {
            const result = (() => {
                try {
                    const stdout = execSync('npx tsx scripts/db-seed.ts', {
                        cwd: projectRoot,
                        encoding: 'utf-8',
                        timeout: 30000,
                        env: { ...process.env, DB_PATH: badPath },
                    });
                    return { stdout, exitCode: 0 };
                } catch (err: unknown) {
                    const e = err as { stdout?: string; status?: number };
                    return { stdout: e.stdout || '', exitCode: e.status ?? 1 };
                }
            })();
            expect(result.exitCode).toBe(1);
        } finally {
            rmSync(badDir, { recursive: true, force: true });
        }
    });

    it('reports correct counts on first run', () => {
        const { stdout } = runSeed();
        expect(stdout).toContain('Seeded 4 new category(ies) (0 already existed)');
    });
});
