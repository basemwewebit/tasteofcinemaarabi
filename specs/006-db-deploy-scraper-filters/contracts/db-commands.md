# CLI Contract: Database Deploy Commands

**Feature**: 006-db-deploy-scraper-filters  
**Interface type**: npm scripts (invoked via `npm run <command>`)

## Commands

### `npm run db:migrate`

**Implementation**: `npx tsx scripts/setup-db.ts`  
**Purpose**: Create database file and apply full schema.

| Aspect | Detail |
|--------|--------|
| Arguments | None |
| Input | `data/schema.sql` (read-only) |
| Output file | `data/cinema.db` (created or updated) |
| Side effects | Applies `data/schema.sql` via `CREATE TABLE IF NOT EXISTS`; runs incremental migrations from `src/lib/db/index.ts` |
| Exit code 0 | Schema applied successfully |
| Exit code 1 | Error (file not found, SQL syntax error, permission denied) |

**stdout example**:
```
Database initialized successfully with schema at data/cinema.db
Applied 5 incremental migrations.
Tables: categories, articles, comments, subscribers, import_batches, search_articles, settings, scrape_jobs
```

---

### `npm run db:migrate:fresh`

**Implementation**: `npx tsx scripts/db-migrate-fresh.ts`  
**Purpose**: Drop all tables and recreate from schema.

| Aspect | Detail |
|--------|--------|
| Arguments | `--force` (required to execute) |
| Input | `data/schema.sql` (read-only) |
| Output file | `data/cinema.db` (wiped and rebuilt) |
| Side effects | Drops ALL user tables, triggers, views. Recreates from schema. Clears `app_migrations`. |
| Exit code 0 | Fresh migration completed |
| Exit code 1 | Error or `--force` not provided |

**Without `--force` (exit 1)**:
```
⚠️  This will DROP ALL TABLES and recreate from schema.
   All data in data/cinema.db will be permanently deleted.
   Run with --force to confirm.
```

**With `--force` (exit 0)**:
```
Dropped 8 tables, 3 triggers.
Schema reapplied from data/schema.sql.
Tables: categories, articles, comments, subscribers, import_batches, search_articles, settings, scrape_jobs
Fresh migration complete.
```

---

### `npm run db:seed`

**Implementation**: `npx tsx scripts/db-seed.ts`  
**Purpose**: Insert canonical category records.

| Aspect | Detail |
|--------|--------|
| Arguments | None |
| Input | Hardcoded seed data (4 categories) |
| Prereq | Database must exist with schema applied |
| Side effects | Inserts categories via `INSERT OR IGNORE` |
| Exit code 0 | Seeding completed |
| Exit code 1 | Error (database not found, table missing) |

**stdout example (first run)**:
```
Seeded 4 new categories (0 already existed).
```

**stdout example (idempotent re-run)**:
```
Seeded 0 new categories (4 already existed).
```

---

### `npm run db:migrate:status`

**Implementation**: `npx tsx scripts/db-migrate-status.ts`  
**Purpose**: Display current database state (read-only).

| Aspect | Detail |
|--------|--------|
| Arguments | None |
| Input | `data/cinema.db` (read-only) |
| Side effects | None (read-only) |
| Exit code 0 | Status displayed |
| Exit code 1 | Database file not found |

**stdout example**:
```
Database: data/cinema.db (245 KB)

Tables:
  categories       4 rows
  articles        127 rows
  comments          0 rows
  subscribers       0 rows
  import_batches    3 rows
  search_articles 127 rows
  settings          1 rows
  scrape_jobs      15 rows
  app_migrations    5 rows

Migrations applied: 5
Last migration: 20260228_articles_scrape_fields
```

**stdout when no database**:
```
Database not found at data/cinema.db
Run 'npm run db:migrate' to create it.
```
