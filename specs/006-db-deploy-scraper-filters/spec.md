# Feature Specification: Database Deploy Commands & Scraper Sort/Filter Options

**Feature Branch**: `006-db-deploy-scraper-filters`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: User description: "we need deploy for database migrate and migrate:fresh and seed ..etc and we want our scraper system to work with sort latest to oldest not oldest to latest and we need if can specify one article or month or year ..etc"

## Clarifications

### Session 2026-02-28

- Q: How should `--month` filtering work given URLs only contain year, not month? → A: Use `lastmod` month as best-available approximation combined with URL year for the year component.
- Q: What should seed data contain? → A: Seed categories only (features, film-lists, reviews, editorial) — lightweight and essential for scraping to work.
- Q: How should `--article <slug>` resolve a slug to a URL? → A: Look up the slug in the existing manifest; if not found, require the full URL.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Database Migration Commands (Priority: P1)

As a developer deploying the cinema CMS, I need CLI commands to manage my database schema so I can safely set up, reset, and seed the database in development and production environments without manual SQL execution.

**Why this priority**: Database management is foundational — every other feature (scraping, CMS, content) depends on a correctly structured database. Without proper migration commands, deployments are manual, error-prone, and irreversible.

**Independent Test**: Can be fully tested by running each command in sequence against a fresh SQLite database and verifying the schema state after each operation.

**Acceptance Scenarios**:

1. **Given** a fresh project clone with no database file, **When** the developer runs the migrate command, **Then** the database file is created and all tables from the schema are present.
2. **Given** an existing database with data, **When** the developer runs the migrate:fresh command, **Then** all tables are dropped and recreated from the schema, and all existing data is removed.
3. **Given** a database with the schema applied, **When** the developer runs the seed command, **Then** predefined sample data (categories, sample articles) is inserted into the database.
4. **Given** a database with existing data, **When** the developer runs the seed command, **Then** seed data is inserted without duplicating already-present records (idempotent seeding).
5. **Given** any migration command, **When** it completes, **Then** a summary is printed showing what was done (tables created, rows seeded, etc.).
6. **Given** a database in an unknown state, **When** the developer runs migrate:status, **Then** the current schema state is displayed (tables present, row counts).

---

### User Story 2 — Scraper Sort Order: Latest to Oldest (Priority: P2)

As a content operator, I want the scraper to process articles from newest to oldest so that the most recent content is available first, allowing me to publish timely content without waiting for the entire backlog to finish.

**Why this priority**: The current oldest-to-latest order means hundreds of older articles must be scraped before reaching recent, high-value content. Reversing the order delivers immediate value by prioritizing fresh material.

**Independent Test**: Can be tested by running the scraper with `--discover-only` and verifying the manifest entries are ordered by date descending, then scraping with `--limit 5` and confirming the 5 most recent articles are processed.

**Acceptance Scenarios**:

1. **Given** the scraper discovers articles from the sitemap, **When** it builds the manifest, **Then** entries are sorted from most recent (newest `lastmod` date) to oldest.
2. **Given** articles without a `lastmod` date (category fallback), **When** sorting is applied, **Then** articles without dates are placed at the end of the list.
3. **Given** the scraper runs with `--limit 5`, **When** articles are sorted latest-first, **Then** only the 5 most recently published articles are processed.
4. **Given** the `--sort oldest` flag is passed, **When** the scraper runs, **Then** articles are processed from oldest to newest (backward-compatible fallback).

---

### User Story 3 — Filter by Specific Article (Priority: P3)

As a content operator, I want to scrape a single specific article by its slug or URL so that I can quickly import one piece of content without running the entire pipeline.

**Why this priority**: Single-article targeting is the most common ad-hoc operation — a new article is published or a previously failed article needs retrying.

**Independent Test**: Can be tested by providing a known article slug/URL and verifying only that one article is scraped, with the resulting JSON in the output directory.

**Acceptance Scenarios**:

1. **Given** a valid article URL, **When** the operator runs the scraper with `--article <URL>`, **Then** only that article is scraped and saved.
2. **Given** a valid article slug that exists in the manifest, **When** the operator runs the scraper with `--article <slug>`, **Then** the slug is resolved to its URL via the manifest and only that article is scraped.
3. **Given** a slug that does not exist in the manifest, **When** the operator runs `--article <slug>`, **Then** an error message is shown instructing the user to provide the full URL instead.
4. **Given** the `--article` flag with a full URL, **When** the scraper runs, **Then** the full discovery phase is skipped (no sitemap/category requests).

---

### User Story 4 — Filter by Year (Priority: P4)

As a content operator, I want to scrape only articles from a specific year so I can selectively import content by publication period.

**Why this priority**: Year filtering enables batch imports of content by era, useful for building out specific sections of the archive.

**Independent Test**: Can be tested by running the scraper with `--year 2024` and verifying only articles with a 2024 publication date appear in the processing queue.

**Acceptance Scenarios**:

1. **Given** a discovered manifest with articles from multiple years, **When** the operator runs `--year 2024`, **Then** only articles published in 2024 are processed.
2. **Given** an article whose URL contains the year (e.g., `/2024/article-slug/`), **When** `--year 2024` is used, **Then** the article is included based on its URL path year.
3. **Given** `--year 2024 --limit 10`, **When** the scraper runs, **Then** at most 10 articles from 2024 are processed, prioritized by most recent first.
4. **Given** an invalid year value (e.g., `--year abc`), **When** the scraper runs, **Then** a validation error is shown and the scraper exits.

---

### User Story 5 — Filter by Month (Priority: P5)

As a content operator, I want to filter articles by a specific month (and year) so I can import content for a particular time window.

**Why this priority**: Month filtering provides finer-grained control than year filtering, useful for incremental content imports.

**Independent Test**: Can be tested by running the scraper with `--year 2024 --month 6` and verifying only June 2024 articles are queued.

**Acceptance Scenarios**:

1. **Given** a discovered manifest, **When** the operator runs `--year 2024 --month 6`, **Then** only articles from June 2024 are processed.
2. **Given** `--month 6` without `--year`, **When** the scraper runs, **Then** articles from month 6 of every year are processed.
3. **Given** an invalid month value (e.g., `--month 13`), **When** the scraper runs, **Then** a validation error is shown and the scraper exits.
4. **Given** `--month 1 --year 2023 --sort oldest`, **When** the scraper runs, **Then** articles from January 2023 are processed in oldest-first order.

---

### Edge Cases

- What happens when `--article` is combined with `--year` or `--month`? The `--article` flag takes precedence and other filters are ignored (with a warning).
- What happens when `migrate:fresh` is run accidentally in production? A confirmation prompt is shown unless `--force` is passed.
- What happens when `seed` is run on a database that already has seed data? Seeding is idempotent — existing records are not duplicated.
- What happens when the year/month filter matches zero articles? A clear message is shown: "No articles found matching filters" and exit code 0.
- What happens when `--sort` receives an invalid value? A validation error lists allowed values (`latest`, `oldest`).
- What happens when `lastmod` dates are missing during sorting? Articles without dates are sorted to the end.

## Requirements *(mandatory)*

### Functional Requirements

#### Database Deploy Commands

- **FR-001**: System MUST provide a `db:migrate` command that creates the database file and applies the full schema from `data/schema.sql`.
- **FR-002**: System MUST provide a `db:migrate:fresh` command that drops all existing tables, then re-applies the full schema.
- **FR-003**: System MUST provide a `db:seed` command that inserts the canonical category records (features, film-lists, reviews, editorial) with Arabic and English names into the `categories` table.
- **FR-004**: Seeding MUST be idempotent — running `db:seed` multiple times MUST NOT create duplicate records.
- **FR-005**: `db:migrate:fresh` MUST require a `--force` flag or interactive confirmation before executing, to prevent accidental data loss.
- **FR-006**: System MUST provide a `db:migrate:status` command that displays current database state (tables present, row counts per table).
- **FR-007**: All database commands MUST be registered as npm scripts in `package.json` for consistent invocation (e.g., `npm run db:migrate`).
- **FR-008**: All database commands MUST print a human-readable summary upon completion (tables affected, rows inserted, time taken).

#### Scraper Sort Order

- **FR-009**: The scraper MUST sort discovered articles from latest (newest) to oldest by default.
- **FR-010**: Sorting MUST use the `lastmod` date from the sitemap when available.
- **FR-011**: For articles discovered via category fallback (no `lastmod`), the system MUST extract the year from the URL path (e.g., `/2024/slug/`) for sorting purposes.
- **FR-012**: Articles without any determinable date MUST be placed at the end of the sorted list.
- **FR-013**: The scraper MUST accept a `--sort` flag with values `latest` (default) or `oldest` for backward compatibility.

#### Scraper Filtering

- **FR-014**: The scraper MUST accept an `--article` flag that takes a slug or full URL to target a single article. When a slug is provided, it is resolved to a URL via the existing manifest; if the slug is not in the manifest, the scraper MUST exit with an error instructing the user to provide the full URL.
- **FR-015**: When `--article` is used with a full URL, the discovery phase MUST be skipped; the scraper directly fetches and processes the specified article. When a slug is provided, the manifest is loaded (but no discovery network requests are made).
- **FR-016**: The scraper MUST accept a `--year` flag that filters articles to only those from the specified publication year.
- **FR-017**: The scraper MUST accept a `--month` flag (1–12) that filters articles by the month component of their `lastmod` date (best-available approximation; URL paths do not contain month).
- **FR-018**: `--month` used without `--year` MUST filter across all years for that month, using the `lastmod` month. Articles without a `lastmod` date are excluded when `--month` is used.
- **FR-019**: `--year` and `--month` MUST be combinable (e.g., `--year 2024 --month 6` for June 2024).
- **FR-020**: When `--article` is combined with `--year` or `--month`, `--article` takes precedence and a warning is printed that filters are ignored.
- **FR-021**: Year MUST be extracted from the article URL path pattern (e.g., `tasteofcinema.com/YYYY/slug/`) for `--year` filtering. Month MUST be extracted from `lastmod` for `--month` filtering (best-available source; URL paths contain only year).
- **FR-022**: Invalid filter values (non-numeric year, month outside 1–12) MUST produce a clear validation error and exit code 2.

### Key Entities

- **Migration**: A schema change applied to the database; in this system, the full `schema.sql` file serves as the single migration source.
- **Seed Data**: The canonical set of categories (features, film-lists, reviews, editorial) with Arabic/English names, required for the scraping pipeline to function correctly.
- **Manifest Entry**: A record of a discovered article in the scraper manifest, containing URL, slug, lastmod date, and scrape status.
- **Article Date**: The publication year (and optionally month) derived from the article URL path, used for filtering and sorting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can set up a working database from scratch in under 30 seconds using a single command.
- **SC-002**: A developer can completely reset and reseed the database in under 30 seconds using two commands.
- **SC-003**: The scraper processes the 10 most recent articles first when run with `--limit 10`, instead of the 10 oldest.
- **SC-004**: A content operator can import a single specific article in under 60 seconds, without running full discovery.
- **SC-005**: Filtering by year reduces the processing queue to only articles matching the specified year, with zero false positives or false negatives.
- **SC-006**: All CLI commands provide clear, human-readable feedback on success or failure with appropriate exit codes.
- **SC-007**: The sort and filter options work correctly in combination (e.g., `--year 2024 --sort oldest --limit 5` processes the 5 oldest articles from 2024).

## Assumptions

- The project uses SQLite via `better-sqlite3` for database storage, and the schema lives in `data/schema.sql`.
- The existing `scripts/setup-db.ts` serves as the starting point for migration commands and will be refactored/extended.
- Article publication year can be reliably extracted from the URL path pattern `tasteofcinema.com/YYYY/slug/` used by TasteOfCinema.
- The scraper's `lastmod` field from WordPress sitemaps reflects the last modification date, which may differ from the original publication date; URL-embedded year is used for publication year filtering.
- Seed data will include the standard category set and a small number of representative article records for development.
- Database commands target the development workflow; production deployment considerations (backups, rollback) are out of scope for this feature.
