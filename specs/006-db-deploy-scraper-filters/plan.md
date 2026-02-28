# Implementation Plan: Database Deploy Commands & Scraper Sort/Filter Options

**Branch**: `006-db-deploy-scraper-filters` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-db-deploy-scraper-filters/spec.md`

## Summary

Two-track feature: (1) Add npm-script database lifecycle commands (`db:migrate`, `db:migrate:fresh`, `db:seed`, `db:migrate:status`) built on the existing `better-sqlite3` + `data/schema.sql` setup, and (2) Enhance the Python bulk scraper with default latest-to-oldest sort order plus `--sort`, `--article`, `--year`, and `--month` filtering flags. Both tracks are independent and can be developed/tested in parallel.

## Technical Context

**Language/Version**: TypeScript 5.9 (Node 20, Next.js 15.5) for DB commands; Python 3.12 (Pydantic) for scraper  
**Primary Dependencies**: better-sqlite3 (DB), argparse + lxml + Pydantic (scraper)  
**Storage**: SQLite (`data/cinema.db`) with schema in `data/schema.sql`  
**Testing**: Vitest (TypeScript), pytest (Python scraper)  
**Target Platform**: Linux (development + deployment)  
**Project Type**: Web application (Next.js) + CLI tools (npm scripts + Python scraper)  
**Performance Goals**: DB commands complete in <30s; single-article scrape in <60s  
**Constraints**: No new dependencies unless justified; scraper must remain backward-compatible  
**Scale/Scope**: ~700 discovered articles in manifest; 6 database tables + FTS

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Arabic-First | ✅ PASS | DB commands are developer-facing CLI (English OK). Seed data includes Arabic category names (`name_ar`). |
| II. Source Integrity | ✅ PASS | No content changes. Scraper filters don't alter attribution. |
| III. Cinematic Editorial Identity | ✅ PASS | No UI changes in this feature. |
| IV. Content Quality Over Quantity | ✅ PASS | Sort order change prioritizes recent high-quality content first. |
| V. Performance is Respect | ✅ PASS | DB commands are offline CLI. Scraper performance unchanged. |
| VI. Monetization Without Compromise | ✅ PASS | No ad-related changes. |
| VII. Accessibility | ✅ PASS | No UI changes. |
| Content Ethics | ✅ PASS | Scraper already rate-limits with `--delay`. Filtering reduces requests. |
| Development Standards | ✅ PASS | TypeScript strict mode, parameterized SQL, conventional commits. Tests required for DB queries and scraper parsing. |

**Gate result**: PASS — no violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/006-db-deploy-scraper-filters/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (CLI contract schemas)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Track 1: Database Deploy Commands (TypeScript)
scripts/
├── setup-db.ts          # Existing — refactored to db:migrate
├── db-migrate-fresh.ts  # New — drop-all + re-apply schema
├── db-seed.ts           # New — insert canonical categories
└── db-migrate-status.ts # New — display table/row state

data/
├── schema.sql           # Existing — single source of truth for schema
└── cinema.db            # Created by db:migrate

# Track 2: Scraper Sort & Filter (Python)
scraper/
├── scraper.py           # Modified — new CLI flags, sort logic, filter dispatch
├── discover.py          # Modified — sort discovered entries after population
├── manifest.py          # Modified — add sort/filter helper functions
├── models.py            # Modified — add url_year/url_month parsed fields
└── tests/
    ├── test_sort.py     # New — unit tests for sort logic
    └── test_filter.py   # New — unit tests for filter logic

# Track 1: Tests (TypeScript)
tests/
└── lib/
    ├── db-migrate.test.ts       # New
    ├── db-migrate-fresh.test.ts # New
    ├── db-seed.test.ts          # New
    └── db-migrate-status.test.ts # New
```

**Structure Decision**: Extends existing `scripts/` directory for DB commands (consistent with `setup-db.ts` pattern) and existing `scraper/` directory for Python changes. No new top-level directories needed.

## Complexity Tracking

No constitution violations detected — this section is not needed.
