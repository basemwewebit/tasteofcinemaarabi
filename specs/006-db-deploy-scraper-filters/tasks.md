# Tasks: Database Deploy Commands & Scraper Sort/Filter Options

**Input**: Design documents from `/specs/006-db-deploy-scraper-filters/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/db-commands.md, contracts/scraper-flags.md

**Tests**: Included — constitution check requires tests for DB queries and scraper parsing.

**Organization**: Two independent tracks (Track 1: DB commands in TypeScript, Track 2: Scraper sort/filter in Python). Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to user story from spec.md (US1–US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Wire npm scripts so all DB commands are invocable via `npm run db:*`

- [X] T001 Register npm scripts in package.json: `db:migrate` → `npx tsx scripts/setup-db.ts`, `db:migrate:fresh` → `npx tsx scripts/db-migrate-fresh.ts`, `db:seed` → `npx tsx scripts/db-seed.ts`, `db:migrate:status` → `npx tsx scripts/db-migrate-status.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No cross-track blocking prerequisites exist — Track 1 (TypeScript DB commands) and Track 2 (Python scraper) are fully independent. Proceed directly to user stories.

**Checkpoint**: Phase 1 complete → user story implementation can begin. Track 1 and Track 2 can proceed in parallel.

---

## Phase 3: User Story 1 — Database Migration Commands (Priority: P1) 🎯 MVP

**Goal**: Provide `db:migrate`, `db:migrate:fresh`, `db:seed`, and `db:migrate:status` npm scripts so a developer can set up, reset, seed, and inspect the database without manual SQL.

**Independent Test**: Run each command in sequence against a fresh SQLite database and verify schema state, row counts, and summary output after each operation.

### Implementation for User Story 1

- [X] T002 [P] [US1] Refactor scripts/setup-db.ts as the db:migrate entry point — read and execute data/schema.sql via better-sqlite3, run existing migrations from src/lib/db/index.ts, print human-readable summary (tables created, migrations applied, time taken), exit 0 on success / exit 1 on error per contracts/db-commands.md
- [X] T003 [P] [US1] Create scripts/db-migrate-fresh.ts — require --force flag (exit 1 if missing), disable foreign keys, query sqlite_master for triggers → views → tables, drop all with IF EXISTS (exclude sqlite_* system tables), re-enable foreign keys, re-apply data/schema.sql, re-run migrations, print summary per contracts/db-commands.md and research R2
- [X] T004 [P] [US1] Create scripts/db-seed.ts — INSERT OR IGNORE the 4 canonical category records (features/مقالات مميزة, film-lists/قوائم أفلام, reviews/مراجعات, editorial/تحريري) into categories table, wrap in db.transaction(), print summary (inserted vs skipped counts) per contracts/db-commands.md, data-model.md, and research R3
- [X] T005 [P] [US1] Create scripts/db-migrate-status.ts — open DB read-only, list all tables from sqlite_master, query row count per table, display as formatted table with total, exit 0 per contracts/db-commands.md

### Tests for User Story 1

- [X] T006 [P] [US1] Write tests for db:migrate in tests/lib/db-migrate.test.ts — verify DB file creation, all schema tables present, migrations applied, idempotent on re-run, summary output format
- [X] T007 [P] [US1] Write tests for db:migrate:fresh in tests/lib/db-migrate-fresh.test.ts — verify --force required, all tables dropped and recreated, existing data removed, summary output
- [X] T008 [P] [US1] Write tests for db:seed in tests/lib/db-seed.test.ts — verify 4 categories inserted, idempotent on re-run (no duplicates), transaction rollback on error
- [X] T009 [P] [US1] Write tests for db:migrate:status in tests/lib/db-migrate-status.test.ts — verify table list matches schema, row counts accurate, read-only (no side effects)

**Checkpoint**: `npm run db:migrate && npm run db:seed && npm run db:migrate:status` works end-to-end. `npm run db:migrate:fresh -- --force && npm run db:seed` resets cleanly.

---

## Phase 4: User Story 2 — Scraper Sort Order: Latest to Oldest (Priority: P2)

**Goal**: Default scraper processing order becomes newest-first so `--limit 10` scrapes the 10 most recent articles instead of the 10 oldest.

**Independent Test**: Run `python scraper.py --discover-only`, then `python scraper.py --limit 5 --verbose` and confirm the 5 articles processed have the most recent `lastmod` dates.

### Implementation for User Story 2

- [X] T010 [P] [US2] Add get_sorted_entries() function to scraper/manifest.py — accept sort direction parameter (latest/oldest), parse last_modified to datetime via datetime.fromisoformat() for correct UTC ordering (not lexicographic — see research R5), entries without last_modified placed at end regardless of direction, return sorted list of ManifestEntry
- [X] T011 [P] [US2] Add --sort {latest,oldest} flag (default: latest) to build_parser() in scraper/scraper.py per contracts/scraper-flags.md
- [X] T012 [US2] Integrate sort into scrape phase pipeline in scraper/scraper.py — replace direct get_pending_entries() call with get_sorted_entries() passing the --sort value, then apply existing --limit truncation after sort

### Tests for User Story 2

- [X] T013 [US2] Write sort unit tests in scraper/tests/test_sort.py — verify latest ordering (newest first), oldest ordering, null-date entries placed last, correct handling of different timezone offsets in lastmod values, --limit applied after sort

**Checkpoint**: `python scraper.py --limit 5 --verbose` processes the 5 newest articles. `python scraper.py --sort oldest --limit 5` processes the 5 oldest (backward-compatible).

---

## Phase 5: User Story 3 — Filter by Specific Article (Priority: P3)

**Goal**: A content operator can scrape a single article by slug (manifest lookup) or full URL (skip discovery) without running the entire pipeline.

**Independent Test**: Run `python scraper.py --article <known-slug> --verbose` and verify only that one article is scraped with JSON output in scraped/articles/.

### Implementation for User Story 3

- [X] T014 [P] [US3] Add --article SLUG_OR_URL flag to build_parser() in scraper/scraper.py per contracts/scraper-flags.md
- [X] T015 [P] [US3] Add lookup_slug() function to scraper/manifest.py — load manifest from disk (no network), search entries dict for matching slug, return URL if found, raise descriptive error with full-URL hint if not found per contracts/scraper-flags.md error format
- [X] T016 [US3] Implement single-article mode in scraper/scraper.py — if --article starts with http: skip discovery phase entirely and use URL directly; if slug: call lookup_slug() to resolve; if combined with --year/--month: print warning and ignore filters per FR-020; create single-entry manifest for scrape phase

### Tests for User Story 3

- [X] T017 [US3] Write article filter tests in scraper/tests/test_filter.py — slug found in manifest resolves to URL, slug not found produces error with hint, URL mode skips discovery, --article + --year/--month prints warning and ignores filters

**Checkpoint**: `python scraper.py --article 10-best-actors-of-all-time-relay-race --verbose` scrapes only that article. `python scraper.py --article https://www.tasteofcinema.com/2024/some-article/ --verbose` works without discovery.

---

## Phase 6: User Story 4 — Filter by Year (Priority: P4)

**Goal**: A content operator can scrape only articles from a specific publication year using `--year YYYY`.

**Independent Test**: Run `python scraper.py --year 2024 --verbose` and verify only articles with `/2024/` in their URL path are processed.

### Implementation for User Story 4

- [X] T018 [P] [US4] Add extract_year_from_url() helper to scraper/manifest.py — use regex `^/(\d{4})/` on urlparse(url).path per research R6, return int or None
- [X] T019 [P] [US4] Add --year YYYY flag with validation (type=int, must be ≥ 2000) to build_parser() in scraper/scraper.py per contracts/scraper-flags.md, exit 2 on invalid value
- [X] T020 [US4] Integrate year filter into processing pipeline in scraper/scraper.py — after discovery and before sort (filter application order step 2 per contracts/scraper-flags.md), filter entries where extract_year_from_url() matches --year value

### Tests for User Story 4

- [X] T021 [US4] Add year filter tests to scraper/tests/test_filter.py — URL year extraction from various URL patterns (with year, without year, category URLs), year filter reduces entry set correctly, combined with --sort and --limit, invalid year validation error

**Checkpoint**: `python scraper.py --year 2024 --limit 10 --verbose` processes at most 10 articles from 2024, newest first.

---

## Phase 7: User Story 5 — Filter by Month (Priority: P5)

**Goal**: A content operator can filter articles by month (optionally combined with year) for fine-grained time-window imports.

**Independent Test**: Run `python scraper.py --year 2024 --month 6 --verbose` and verify only June 2024 articles are queued.

### Implementation for User Story 5

- [X] T022 [P] [US5] Add extract_month_from_lastmod() helper to scraper/manifest.py — use datetime.fromisoformat(last_modified).month with local time (no UTC conversion) per research R8, return int or None for entries without lastmod
- [X] T023 [P] [US5] Add --month M flag with validation (type=int, choices 1–12) to build_parser() in scraper/scraper.py per contracts/scraper-flags.md, exit 2 on invalid value
- [X] T024 [US5] Integrate month filter into processing pipeline in scraper/scraper.py — after year filter and before sort (filter application order step 3 per contracts/scraper-flags.md), exclude entries without lastmod when --month is active per FR-018
- [X] T025 [US5] Add month filter tests to scraper/tests/test_filter.py — month extraction from various lastmod values, month-only filtering across all years, month + year combined filter, entries without lastmod excluded, invalid month validation error

**Checkpoint**: `python scraper.py --month 6 --verbose` processes June articles across all years. `python scraper.py --year 2023 --month 1 --sort oldest` processes January 2023 articles oldest-first.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, end-to-end validation, and combined-filter verification

- [X] T026 [P] Update scraper/README.md with new --sort, --article, --year, --month flags, usage examples, and filter application order
- [X] T027 Run quickstart.md validation end-to-end — execute every command from specs/006-db-deploy-scraper-filters/quickstart.md for both Track 1 and Track 2, verify expected output
- [X] T028 Verify combined filter scenarios work correctly — test `--year 2024 --month 6 --sort oldest --limit 5`, `--article <slug> --year 2024` (warning + article precedence), zero-match filters print clear message per edge cases in spec.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Skipped — no cross-track blocking prerequisites
- **US1 (Phase 3)**: Depends on Phase 1 (npm scripts registered)
- **US2 (Phase 4)**: No dependency on Track 1 — can start immediately after Phase 1
- **US3 (Phase 5)**: Depends on Phase 4 (sort integration must be in place before adding article filter that short-circuits it)
- **US4 (Phase 6)**: Depends on Phase 4 (filter pipeline builds on sorted flow)
- **US5 (Phase 7)**: Depends on Phase 6 (month filter inserts after year filter in pipeline)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### Track Independence

```
Track 1 (TypeScript):  Phase 1 → Phase 3 (US1)
Track 2 (Python):      Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5)

Track 1 and Track 2 can proceed in parallel — no shared code or data dependencies.
```

### Within Each User Story

1. Helper functions (manifest.py) and argparse flags (scraper.py) can be parallel [P]
2. Pipeline integration depends on helpers + flags being complete
3. Tests come after implementation within each story
4. Story checkpoint must pass before moving to next priority

### Parallel Opportunities

**Track-level parallelism**:
- Track 1 (US1) and Track 2 (US2–US5) can run fully in parallel

**Within US1 (Phase 3)**:
- T002, T003, T004, T005 are all standalone scripts in separate files — all [P]
- T006, T007, T008, T009 are all separate test files — all [P] (after their corresponding script)

**Within US2–US5 (Phases 4–7)**:
- In each story: manifest.py helper [P] with scraper.py argparse flag [P]
- Integration task depends on both; tests follow integration

---

## Parallel Example: User Story 1

```
# Group 1 — All scripts in parallel (separate files):
T002: Refactor scripts/setup-db.ts
T003: Create scripts/db-migrate-fresh.ts
T004: Create scripts/db-seed.ts
T005: Create scripts/db-migrate-status.ts

# Group 2 — All tests in parallel (after scripts complete):
T006: tests/lib/db-migrate.test.ts
T007: tests/lib/db-migrate-fresh.test.ts
T008: tests/lib/db-seed.test.ts
T009: tests/lib/db-migrate-status.test.ts
```

## Parallel Example: User Story 2

```
# Group 1 — Helper + flag in parallel (different files):
T010: scraper/manifest.py (get_sorted_entries)
T011: scraper/scraper.py (--sort flag)

# Group 2 — Sequential:
T012: scraper/scraper.py (pipeline integration, depends on T010 + T011)
T013: scraper/tests/test_sort.py (depends on T012)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 3: User Story 1 (T002–T009)
3. **STOP and VALIDATE**: Run `npm run db:migrate && npm run db:seed && npm run db:migrate:status`
4. Deploy if ready — database commands are immediately useful

### Incremental Delivery

1. Phase 1 → Phase 3 (US1) → **DB commands working** (MVP)
2. Phase 4 (US2) → **Scraper sorts newest-first** (high-value quick win)
3. Phase 5 (US3) → **Single-article scraping** (most common ad-hoc operation)
4. Phase 6 (US4) → **Year filtering** (batch import by era)
5. Phase 7 (US5) → **Month filtering** (fine-grained time windows)
6. Phase 8 → Polish, docs, end-to-end validation

Each story adds independently valuable functionality without breaking previous stories.

### Parallel Track Strategy

```
Developer A (Track 1):  T001 → T002–T009 → done
Developer B (Track 2):  T010–T013 → T014–T017 → T018–T021 → T022–T025 → done
Both:                   T026–T028 (Polish)
```

---

## Notes

- All DB scripts use `npx tsx` and import `getDb()` from `src/lib/db/index.ts` for database access
- All scraper changes maintain backward compatibility (existing CLI still works, new flags are additive)
- Filter application order is strict: article → year → month → sort → limit → pending (per contracts/scraper-flags.md)
- `last_modified` must be parsed to datetime objects for sorting — lexicographic sort is NOT safe across timezone offsets (research R5)
- Seed data uses `INSERT OR IGNORE` on `slug` UNIQUE constraint — never overwrites user customizations (research R3)
- Commit after each task or logical group; stop at any checkpoint to validate independently
