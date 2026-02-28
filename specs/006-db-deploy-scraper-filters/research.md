# Research: Database Deploy Commands & Scraper Sort/Filter Options

**Feature**: 006-db-deploy-scraper-filters  
**Date**: 2026-02-28

## R1: SQLite Migration CLI Architecture with better-sqlite3

**Decision**: Standalone `scripts/*.ts` files run via `npx tsx`, wired as colon-namespaced npm scripts.

**Rationale**: Consistent with existing `scripts/setup-db.ts` pattern. Each command is a standalone CLI entry point — no framework overhead (Knex, Drizzle) needed for this project size. The project already has an inline migration system in `src/lib/db/index.ts` (`DB_MIGRATIONS[]` + `app_migrations` tracking table) which serves as incremental forward-only patches.

**Architecture**:
| Layer | File | Purpose |
|-------|------|---------|
| Schema baseline | `data/schema.sql` | Creates all tables from scratch (idempotent via `IF NOT EXISTS`) |
| Incremental migrations | `src/lib/db/index.ts` `DB_MIGRATIONS[]` | Forward-only patches tracked in `app_migrations` |
| CLI commands | `scripts/db-*.ts` | npm script entry points |

**Alternatives considered**:
- Drizzle/Knex migrations: Overkill for single-file SQLite with ~8 tables.
- Single CLI with subcommands: npm colon-namespaced scripts are more standard for this project size.

## R2: Safe Table Drop for migrate:fresh

**Decision**: Query `sqlite_master` → drop triggers → views → regular tables (all with `IF EXISTS`), foreign keys OFF/ON.

**Rationale**: FTS5 virtual tables appear in `sqlite_master` with `type = 'table'` and `DROP TABLE` on FTS5 parent automatically cleans shadow tables. `IF EXISTS` handles any cascading removal. System tables (`sqlite_*`) are excluded from the drop list.

**Drop order**: triggers → views → regular tables (includes FTS5 virtual tables).

**Alternatives considered**:
- Delete `.db` file and recreate: Loses WAL state, fails if file locked. Less robust.
- `PRAGMA writable_schema`: Dangerous, can corrupt database.

## R3: Idempotent Seeding Pattern

**Decision**: `INSERT OR IGNORE` keyed on `slug` UNIQUE constraint, wrapped in `db.transaction()`.

**Rationale**: Matches existing project pattern (see `INSERT OR IGNORE INTO settings` in `src/lib/db/index.ts`). Categories use `slug TEXT UNIQUE NOT NULL` as natural dedup key. `INSERT OR IGNORE` silently skips if constraint is violated — user customizations are preserved.

**Alternatives considered**:
- `ON CONFLICT DO UPDATE`: Overwrites user changes, not desired for seed data.
- `ON CONFLICT DO NOTHING`: SQL-standard equivalent, identical behavior. `INSERT OR IGNORE` is more idiomatic for SQLite + better-sqlite3.

## R4: npm Colon Scripts Cross-Platform Safety

**Decision**: Colons in npm script names are fully supported and safe on all platforms (Linux, macOS, Windows CMD/PowerShell/Git Bash).

**Rationale**: Colons are the de facto namespacing convention. No shell interprets colons as special characters. Tab completion works in bash/zsh. Pre/post lifecycle hooks work (e.g., `predb:migrate`).

## R5: Manifest Sorting Strategy

**Decision**: Sort at **processing time** (in `get_pending_entries` or new helper), not at discovery time.

**Rationale**: Manifest dict order reflects insertion (discovery) order — useful for reproducibility and git diffing. Sorting 5,982 entries is ~1ms, negligible at processing time. Keeps `Manifest` model a pure data container.

**Implementation**: New `get_sorted_entries()` function in `manifest.py` that accepts `reverse: bool` parameter.

**Critical detail**: `last_modified` values contain timezone offsets (e.g., `2012-09-14T17:49:54-08:00`). Lexicographic sort is NOT safe across different offsets. Must parse to `datetime` objects for correct UTC ordering.

**Alternatives considered**:
- Sort on save (OrderedDict): Couples serialization to sort key, noisy diffs.
- Sort at discovery time: Breaks insertion order stability.

## R6: URL-Based Year Extraction

**Decision**: Regex `^/(\d{4})/` applied to `urlparse(url).path`.

**Rationale**: TasteOfCinema URLs are uniform: `https://www.tasteofcinema.com/YYYY/slug/`. Anchoring to first path segment prevents false matches on years embedded in slugs (e.g., `10-best-american-movies-2012-roundup-four`).

**Edge cases**:
| URL | Result |
|-----|--------|
| `https://www.tasteofcinema.com/2024/my-article/` | `2024` |
| `https://www.tasteofcinema.com/category/features/` | `None` |
| `https://www.tasteofcinema.com/` | `None` |

## R7: argparse Filter Combination Pattern

**Decision**: Manual validation with argument group, not mutually exclusive groups.

**Rationale**: `--year` + `--month` are composable. `--article` preempts others (precedence, not mutual exclusion). argparse can't express "A preempts B+C". Manual validation gives better error messages.

**Filter application order**: article (short-circuit) → year (URL) → month (lastmod) → sort (last).

## R8: Month Extraction from lastmod

**Decision**: `datetime.fromisoformat(s).month` using local time (no UTC conversion).

**Rationale**: Native in Python 3.11+. Using local time (no `.astimezone()`) matches user expectations — the month as it appears in the date string. Edge case: `2012-12-31T23:00:00-08:00` is January 1 in UTC, but December 31 in Pacific. Local time is more intuitive.

**Requirement**: Python >= 3.11 (for `fromisoformat` with offset support).

**Alternatives considered**:
- UTC normalization: Correct but counterintuitive for month boundaries.
- Manual regex parsing: Unnecessary complexity when targeting Python 3.11+.
