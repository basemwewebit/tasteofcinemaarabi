/**
 * scripts/db-seed.ts — db:seed entry point.
 *
 * Inserts the 4 canonical category records using INSERT OR IGNORE
 * (idempotent — re-runs safely without duplicates).
 *
 * Usage: npx tsx scripts/db-seed.ts
 * Exit 0 on success, exit 1 on error.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';

const dbPath = process.env.DB_PATH || join(process.cwd(), 'data', 'cinema.db');

interface SeedCategory {
    slug: string;
    name_ar: string;
    name_en: string;
    sort_order: number;
}

const SEED_CATEGORIES: SeedCategory[] = [
    { slug: 'features', name_ar: 'مقالات مميزة', name_en: 'Features', sort_order: 1 },
    { slug: 'film-lists', name_ar: 'قوائم أفلام', name_en: 'Film Lists', sort_order: 2 },
    { slug: 'reviews', name_ar: 'مراجعات', name_en: 'Reviews', sort_order: 3 },
    { slug: 'editorial', name_ar: 'تحريري', name_en: 'Editorial', sort_order: 4 },
];

function main(): void {
    if (!existsSync(dbPath)) {
        console.error(`Database not found at ${dbPath}`);
        console.error("Run 'npm run db:migrate' to create it.");
        process.exit(1);
    }

    const db = new Database(dbPath);
    try {
        // Verify categories table exists
        const tableExists = db
            .prepare(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='categories' LIMIT 1"
            )
            .get();

        if (!tableExists) {
            console.error(
                "Error: 'categories' table not found in database."
            );
            console.error("Run 'npm run db:migrate' first.");
            process.exit(1);
        }

        // Count existing before insert
        const countBefore = (
            db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as {
                cnt: number;
            }
        ).cnt;

        const insertStmt = db.prepare(
            'INSERT OR IGNORE INTO categories (slug, name_ar, name_en, sort_order) VALUES (?, ?, ?, ?)'
        );

        const seedAll = db.transaction(() => {
            for (const cat of SEED_CATEGORIES) {
                insertStmt.run(cat.slug, cat.name_ar, cat.name_en, cat.sort_order);
            }
        });

        seedAll();

        // Count after insert
        const countAfter = (
            db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as {
                cnt: number;
            }
        ).cnt;

        const inserted = countAfter - countBefore;
        const skipped = SEED_CATEGORIES.length - inserted;

        console.log(
            `Seeded ${inserted} new category(ies) (${skipped} already existed).`
        );
    } catch (err) {
        console.error('Error seeding database:', err);
        process.exit(1);
    } finally {
        db.close();
    }
}

main();
