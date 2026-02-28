# Data Model: Database Deploy Commands & Scraper Sort/Filter Options

**Feature**: 006-db-deploy-scraper-filters  
**Date**: 2026-02-28

## Existing Entities (unchanged)

### categories (SQLite table)

Already defined in `data/schema.sql`. Seed target for `db:seed`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| slug | TEXT | UNIQUE NOT NULL | Dedup key for idempotent seeding |
| name_ar | TEXT | NOT NULL | Arabic name (seed data) |
| name_en | TEXT | nullable | English name (seed data) |
| description_ar | TEXT | nullable | |
| parent_id | INTEGER | FK → categories(id) | |
| sort_order | INTEGER | DEFAULT 0 | |
| article_count | INTEGER | DEFAULT 0 | |

### app_migrations (SQLite table)

Already defined in `src/lib/db/index.ts`. Tracks applied incremental migrations.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TEXT | PK | Migration identifier (e.g., `20260228_fix_articles_au_trigger`) |
| applied_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### ManifestEntry (Pydantic model — `scraper/models.py`)

Existing model. Used for filtering and sorting.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| url | str | required | Full article URL (contains year in path) |
| slug | str | required | Article identifier |
| status | ScrapeStatus | PENDING | pending / completed / failed |
| last_modified | str \| None | None | ISO 8601 from sitemap (contains month) |
| scraped_at | str \| None | None | |
| error | str \| None | None | |
| pages_found | int | 0 | |
| images_found | int | 0 | |
| images_downloaded | int | 0 | |

## New Data: Canonical Category Seed Records

4 records inserted by `db:seed`:

| slug | name_ar | name_en | sort_order |
|------|---------|---------|------------|
| `features` | مقالات مميزة | Features | 1 |
| `film-lists` | قوائم أفلام | Film Lists | 2 |
| `reviews` | مراجعات | Reviews | 3 |
| `editorial` | تحريري | Editorial | 4 |

**Insertion rule**: `INSERT OR IGNORE` — skip if slug already exists.

## Derived/Computed Data (not persisted)

### Article Year (from URL)

Extracted at filter/sort time, not stored in the manifest.

| Source | Extraction | Example |
|--------|-----------|---------|
| `ManifestEntry.url` | Regex `^/(\d{4})/` on parsed URL path | `https://www.tasteofcinema.com/2024/slug/` → `2024` |

### Article Month (from lastmod)

Extracted at filter time, not stored in the manifest.

| Source | Extraction | Example |
|--------|-----------|---------|
| `ManifestEntry.last_modified` | `datetime.fromisoformat(s).month` (local time) | `2012-09-14T17:49:54-08:00` → `9` |

## State Transitions

### Database State Machine (migrate commands)

```
[No DB file] --db:migrate--> [Schema applied, empty tables]
                                  |
                                  +--db:seed--> [Schema + categories seeded]
                                  |
                                  +--db:migrate:fresh--> [All tables dropped + recreated, empty]
                                  |                          |
                                  |                          +--db:seed--> [Freshly seeded]
                                  |
                                  +--db:migrate:status--> [Read-only: display table state]
```

### Manifest Entry Filter Pipeline

```
[All entries in manifest]
    |
    +--if --article: lookup slug/URL -> [single entry] -> process
    |
    +--if --year: filter by URL year -> [year-matching entries]
    |     |
    |     +--if --month: filter by lastmod month -> [year+month entries]
    |
    +--if --month only: filter by lastmod month -> [month-matching entries]
    |
    +--sort by --sort (latest|oldest) or default (latest)
    |
    +--apply --limit
    |
    +--filter to pending/failed only (existing get_pending_entries logic)
    |
    -> [final processing queue]
```

## Validation Rules

| Input | Valid Range | Error |
|-------|------------|-------|
| `--year` | Integer ≥ 2000 | "error: --year must be ≥ 2000" |
| `--month` | Integer 1–12 | argparse `choices=range(1,13)` auto-validates |
| `--sort` | `latest` \| `oldest` | argparse `choices` auto-validates |
| `--article` (slug) | Must exist in manifest `entries` dict | "Slug not found in manifest. Provide the full URL instead." |
| `--article` (URL) | Must start with `http` | Directly used, no manifest lookup |
| `migrate:fresh` | Requires `--force` flag | "Run with --force to confirm" |
