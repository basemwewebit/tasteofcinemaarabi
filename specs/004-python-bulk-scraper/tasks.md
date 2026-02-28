# Tasks: Python Bulk Content Scraper

**Input**: Design documents from `/specs/004-python-bulk-scraper/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/json-schema.md, quickstart.md

**Tests**: Included — plan.md specifies pytest with mocked HTTP responses and lists 4 test files.

**Organization**: Tasks grouped by user story for independent implementation and testing. 5 user stories mapped from spec.md (3× P1, 2× P2).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story (US1–US5) this task belongs to
- Exact file paths included in every description

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create the isolated Python scraper directory and configure tooling

- [ ] T001 Create `scraper/` directory structure with `__init__.py` and `tests/__init__.py` per plan.md project structure
- [ ] T002 Create Python project config with scrapling, pydantic, pytest, pytest-asyncio dependencies in `scraper/pyproject.toml`
- [ ] T003 [P] Verify `.gitignore` includes `/scraped/` and `scraper/.venv/` exclusions (FR-016)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared data models, manifest CRUD, and test infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement Pydantic data models (`ArticleData`, `ManifestEntry`, `Manifest`, `ScrapeStatus` enum) in `scraper/models.py`
- [ ] T005 Implement manifest CRUD operations (load from disk, save to disk, add entries, update entry status, compute summary counts) in `scraper/manifest.py`
- [ ] T006 [P] Create pytest configuration and shared fixtures (mock sitemap XML, mock article HTML, temp output dirs) in `scraper/tests/conftest.py`
- [ ] T007 Write unit tests for manifest CRUD (create, load, update status, add new entries, handle missing file) in `scraper/tests/test_manifest.py`

**Checkpoint**: Models validated, manifest read/write working, test harness ready — user story implementation can begin

---

## Phase 3: User Story 1 — Full Site Crawl & Article Discovery (Priority: P1) 🎯 MVP

**Goal**: Discover all published article URLs from tasteofcinema.com via sitemap parsing and populate the manifest with ~5,500–6,000 entries

**Independent Test**: Run discovery module directly → verify manifest.json created with all article URLs, each marked `pending`. Cross-check sample URLs against live sitemaps.

### Implementation for User Story 1

- [ ] T008 [US1] Implement WordPress sitemap index fetching and sub-sitemap URL extraction (parse `sitemap.xml` → find `wp-sitemap-posts-post-{1,2,3}.xml`) in `scraper/discover.py`
- [ ] T009 [US1] Implement post sub-sitemap parsing (extract `<loc>` article URLs and `<lastmod>` dates from each sub-sitemap XML) in `scraper/discover.py`
- [ ] T010 [US1] Implement category page fallback discovery with listing pagination (FR-001, FR-002) in `scraper/discover.py`
- [ ] T011 [US1] Add URL deduplication and manifest population (merge discovered URLs into Manifest, skip existing slugs) in `scraper/discover.py`
- [ ] T012 [P] [US1] Write discovery unit tests (sitemap index parsing, sub-sitemap parsing, category fallback, deduplication, error handling) in `scraper/tests/test_discover.py`

**Checkpoint**: Running discovery produces a manifest.json with ~5,500+ article URLs, all status `pending`

---

## Phase 4: User Story 2 — Article Content Extraction with Pagination (Priority: P1)

**Goal**: Extract full article content from each discovered URL — title, author, body HTML (all pages merged), featured image, inline images, movie titles, category, tags — and output one JSON file per article

**Independent Test**: Run extraction on a known multi-page article (e.g., "All 25 Best Picture Winners..." — 3 pages). Verify output JSON has merged content from all pages, correct title, author, all inline image URLs listed, and movie titles extracted.

### Implementation for User Story 2

- [ ] T013 [US2] Implement single-page article content extraction (title from `.entry-title`, author from `.author-name`, content HTML from `.entry-content`, featured image from `.wp-post-image`) in `scraper/extract.py`
- [ ] T014 [US2] Implement multi-page pagination detection and content merging (follow `.page-links a` / `.pagination a` / `.post-page-numbers` selectors, merge content from `/2/`, `/3/` URLs, track visited URLs for loop protection) in `scraper/extract.py`
- [ ] T015 [US2] Implement movie title extraction from article content (parse bold headings, numbered list patterns like "25. Movie Name") in `scraper/extract.py`
- [ ] T016 [US2] Implement category and tag extraction from article HTML (`.cat-links a` for category slug, `.tag-links a` for tag slugs) in `scraper/extract.py`
- [ ] T017 [US2] Add HTTP retry logic with exponential backoff (3 retries per request, FR-011) and fault-tolerant error handling (FR-014) in `scraper/extract.py`
- [ ] T018 [US2] Add JSON output writing (serialize `ArticleData` to `scraped/articles/<slug>.json`, update manifest entry to `completed` with stats) in `scraper/extract.py`
- [ ] T019 [P] [US2] Write extraction tests (single-page, multi-page merge, movie title parsing, category/tag extraction, retry on failure, JSON output validation against contract schema) in `scraper/tests/test_extract.py`

**Checkpoint**: Given a manifest with article URLs, extraction produces valid JSON files per article with all fields populated. Multi-page articles have merged content.

---

## Phase 5: User Story 3 — Image Downloading (Priority: P1)

**Goal**: Download all referenced images (featured + inline) to local filesystem organized by article slug, with skip-existing support

**Independent Test**: Run image downloader on a single article JSON with 5+ images. Verify all images saved to `scraped/images/<slug>/` with correct naming. Re-run and verify no re-downloads.

### Implementation for User Story 3

- [ ] T020 [US3] Implement image downloading with per-article directory creation (`scraped/images/<slug>/`) and HTTP error handling in `scraper/images.py`
- [ ] T021 [US3] Add filename sanitization (lowercase, alphanumeric + hyphens), index-prefix ordering (`00-thumbnail`, `01-name`, `02-name`), and file extension preservation in `scraper/images.py`
- [ ] T022 [US3] Add skip-existing logic to avoid re-downloading images that already exist locally during incremental runs (FR-015) in `scraper/images.py`
- [ ] T023 [P] [US3] Write image download tests (successful download, skip-existing, HTTP error handling, filename sanitization, thumbnail ordering) in `scraper/tests/test_images.py`

**Checkpoint**: Image downloading works end-to-end. Existing images are skipped on re-run. Files organized by slug with correct naming.

---

## Phase 6: User Story 4 — Incremental Re-run Support (Priority: P2)

**Goal**: Re-running the scraper only processes new/failed articles. Provides `--force` to override.

**Independent Test**: After a full scrape, add a simulated new URL to manifest as `pending`. Re-run — verify only that URL is processed. Run with `--force` — verify all articles re-processed.

### Implementation for User Story 4

- [ ] T024 [US4] Add incremental filtering to manifest (return only `pending` and `failed` entries for processing, skip `completed`) in `scraper/manifest.py`
- [ ] T025 [US4] Add `--force` override logic (reset all entries to `pending` status before processing) in `scraper/manifest.py`
- [ ] T026 [P] [US4] Add re-discovery logic to detect new article URLs not yet in manifest and append them as `pending` in `scraper/discover.py`

**Checkpoint**: Incremental runs skip completed articles. `--force` re-scrapes all. New articles discovered and added on re-run.

---

## Phase 7: User Story 5 — CLI Interface & Configuration (Priority: P2)

**Goal**: Provide a complete CLI that orchestrates discovery → extraction → image download with all configurable flags

**Independent Test**: Run `python scraper.py --help` — verify all flags shown. Run `python scraper.py --limit 5 --delay 3 --verbose` — verify only 5 articles processed with 3s delay and verbose output.

### Implementation for User Story 5

- [ ] T027 [US5] Implement argparse CLI definition with all flags (`--help`, `--discover-only`, `--force`, `--limit N`, `--delay N`, `--workers N`, `--output-dir PATH`, `--verbose`) per contracts/json-schema.md CLI contract in `scraper/scraper.py`
- [ ] T028 [US5] Wire CLI to discovery pipeline (parse args → run sitemap discovery → save manifest → exit if `--discover-only`) in `scraper/scraper.py`
- [ ] T029 [US5] Wire CLI to extraction and image pipeline (read manifest → filter by incremental status → extract articles → download images → update manifest) in `scraper/scraper.py`
- [ ] T030 [US5] Add verbose progress logging (current article N/total, page count, image downloads, errors) and final summary output in `scraper/scraper.py`
- [ ] T031 [US5] Implement exit code handling (0 = all success, 1 = partial failure, 2 = fatal error) per contracts/json-schema.md in `scraper/scraper.py`

**Checkpoint**: Full CLI works end-to-end. `--discover-only` builds manifest. Default run discovers + scrapes + downloads. All flags respected.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: TypeScript pipeline integration and documentation

- [ ] T032 [P] Extend `ScrapeResponse.data` interface with optional `category` and `tags` fields in `src/types/api.ts`
- [ ] T033 Add local-JSON-read path to import pipeline (read `scraped/articles/<slug>.json`, convert snake_case → camelCase, skip remote scrape step) in `src/lib/scraper/pipeline.ts`
- [ ] T034 [P] Create usage documentation with examples and troubleshooting in `scraper/README.md`
- [ ] T035 Run quickstart.md validation end-to-end (setup venv, install deps, `--discover-only`, scrape `--limit 5`, verify JSON output matches contract schema)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──────────────────────────────────────────────> (no deps)
Phase 2: Foundational ───────────────────────────────────────> depends on Phase 1
Phase 3: US1 (Discovery) ───────────────────────────────────> depends on Phase 2
Phase 4: US2 (Extraction) ──────────────────────────────────> depends on Phase 2 (+ US1 for real data)
Phase 5: US3 (Images) ─────────────────────────────────────> depends on Phase 2 (+ US2 for real data)
Phase 6: US4 (Incremental) ────────────────────────────────> depends on Phase 2 + Phase 3
Phase 7: US5 (CLI) ────────────────────────────────────────> depends on Phases 3, 4, 5, 6
Phase 8: Polish ───────────────────────────────────────────> depends on Phases 3–7
```

### User Story Dependencies

- **US1 (Discovery)**: Foundational only — fully independent, MVP entry point
- **US2 (Extraction)**: Foundational only for unit testing. Real data flow needs US1 manifest output.
- **US3 (Images)**: Foundational only for unit testing. Real data flow needs US2 article JSON.
- **US4 (Incremental)**: Depends on US1 (manifest exists) — extends manifest.py and discover.py
- **US5 (CLI)**: Integrates US1–US4 — depends on all prior stories being implemented

### Within Each User Story

- Implementation tasks are sequential within the same file (e.g., T013 → T014 → T015 in extract.py)
- Test tasks ([P]) can be written in parallel with implementation since they use mocked data
- Update manifest status after each article completes

### Parallel Opportunities

**Phase 1**: T003 [P] parallel with T001+T002
**Phase 2**: T006 [P] parallel with T005 (both depend only on T004)
**Phase 3**: T012 [P] test file parallel with T008–T011 implementation
**Phase 4**: T019 [P] test file parallel with T013–T018 implementation
**Phase 5**: T023 [P] test file parallel with T020–T022 implementation
**Phase 6**: T026 [P] in discover.py parallel with T024–T025 in manifest.py
**Phase 8**: T032 [P] and T034 [P] parallel with T033

---

## Parallel Example: User Story 2 (Extraction)

```
# These can run in parallel (different files):
Worker A: T013 → T014 → T015 → T016 → T017 → T018  (scraper/extract.py)
Worker B: T019                                        (scraper/tests/test_extract.py)
```

## Parallel Example: Phase 2 (Foundational)

```
# After T004 (models.py) completes:
Worker A: T005  (scraper/manifest.py)
Worker B: T006  (scraper/tests/conftest.py)
# Then after both complete:
Worker A: T007  (scraper/tests/test_manifest.py)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T007)
3. Complete Phase 3: User Story 1 — Discovery (T008–T012)
4. **STOP and VALIDATE**: Run discovery, verify manifest has ~5,500+ URLs
5. This alone provides a complete inventory of available content

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Discovery) → Test independently → **MVP: site inventory complete**
3. Add US2 (Extraction) → Test with sample articles → Content extraction working
4. Add US3 (Images) → Test with sample articles → Full content + images
5. Add US4 (Incremental) → Test re-run behavior → Production-ready tool
6. Add US5 (CLI) → Wire everything → Operator-friendly interface
7. Polish → TS integration → Pipeline reads from local JSON

### Each Story Adds Independent Value

| After Story | What You Can Do |
|-------------|-----------------|
| US1 | Know exactly what content exists (~5,500 URLs in manifest) |
| US2 | Extract and read any article's full content as JSON |
| US3 | Have all images downloaded locally for any article |
| US4 | Re-run without re-scraping completed articles |
| US5 | Single command to run the whole pipeline with tuning |
| Polish | Import scraped articles directly into the existing Next.js pipeline |

---

## Notes

- All Python files are in the isolated `scraper/` directory — no changes to `src/` until Phase 8
- Only 2 TypeScript files modified (T032, T033) — minimal integration footprint
- Scrapling handles anti-bot bypass internally — no manual User-Agent rotation needed
- Multi-page pagination selectors (`.page-links a`, `.pagination a`, `.post-page-numbers`) are validated in research.md and match existing TS scraper
- Manifest is the single source of truth for scrape progress — crash recovery is automatic (unfinished articles remain `pending`)
- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps each task to its user story for traceability
- Commit after each task or logical group
