# Implementation Plan: Python Bulk Content Scraper

**Branch**: `004-python-bulk-scraper` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-python-bulk-scraper/spec.md`

## Summary

A standalone Python CLI scraper using Scrapling's Spider framework to bulk-crawl tasteofcinema.com — discovering all articles via WordPress sitemap, extracting full content (with multi-page merge), downloading images, and outputting integration-ready JSON files. The existing Node.js pipeline will be modified to read from these local JSON files instead of remote-scraping. Supports incremental runs via manifest tracking and configurable concurrency (3–5 workers).

## Technical Context

**Language/Version**: Python 3.10+ (Scrapling minimum)
**Primary Dependencies**: Scrapling (Spider + Fetcher), argparse (CLI), lxml (sitemap XML parsing — included via Scrapling)
**Storage**: Local filesystem — JSON files (`scraped/articles/`), images (`scraped/images/`), manifest (`scraped/manifest.json`)
**Testing**: pytest with mocked HTTP responses
**Target Platform**: Linux / macOS (developer machine CLI)
**Project Type**: CLI tool (standalone Python script within existing Next.js project)
**Performance Goals**: Full site crawl (~5,500–6,000 articles) in ~8–12 hours with 3 workers and 2s delay
**Constraints**: Per-domain delay ≥ 2s, max 5 concurrent workers, respect robots.txt
**Scale/Scope**: ~5,500–6,000 articles (many multi-page), ~30,000–60,000 images, ~10–20 GB disk for images

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Arabic-First, Cinema-Native | ✅ PASS | Scraper extracts English source content; Arabic translation happens downstream in existing pipeline. No UI involved. |
| II. Source Integrity | ✅ PASS | Scraper preserves `source_url` and `author` in every JSON output. Existing pipeline already credits original authors and links to source. |
| III. Cinematic Editorial Identity | ✅ PASS | N/A — no UI components in this feature. |
| IV. Content Quality Over Quantity | ✅ PASS | Scraper feeds into existing draft→review→publish workflow. No auto-publish. |
| V. Performance is Respect | ✅ PASS | Rate-limited with configurable delay (default 2s). Respects robots.txt. |
| VI. Monetization Without Compromise | ✅ PASS | N/A — no ad placement involved. |
| VII. Accessibility is Universal | ✅ PASS | N/A — CLI tool, no UI. |
| Content Ethics | ✅ PASS | Scraping is rate-limited, uses proper User-Agent. robots.txt verified — article paths not disallowed. Source attribution preserved. |
| Development Standards | ⚠️ DEVIATION | Python codebase within a TypeScript project. Justified: user requirement to use Scrapling (Python-only library). Python code is isolated in `scraper/` directory, does not touch TypeScript codebase. |

**GATE RESULT**: PASS (1 justified deviation — Python in a TS project)

## Constitution Check — Post-Design Re-evaluation

*Re-evaluated after Phase 1 design (data-model.md, contracts/, quickstart.md)*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Arabic-First | ✅ PASS | No change — scraper is infrastructure. |
| II. Source Integrity | ✅ PASS | Confirmed: `ArticleData` model includes `url` (source link) and `author` (original credit) as required fields. JSON contract enforces `minLength: 1`. |
| III. Cinematic Editorial Identity | ✅ PASS | N/A — CLI tool. |
| IV. Content Quality Over Quantity | ✅ PASS | No change — output feeds draft→review→publish. |
| V. Performance is Respect | ✅ PASS | CLI contract defines `--delay` (default 2s) and `--workers` (max 5). |
| VI. Monetization Without Compromise | ✅ PASS | N/A. |
| VII. Accessibility is Universal | ✅ PASS | N/A. |
| Content Ethics | ✅ PASS | Research confirmed: robots.txt allows article paths for generic UA. Rate-limiting is built into CLI contract. REST API is publicly exposed (no auth bypass). |
| Development Standards | ⚠️ DEVIATION | Same deviation as pre-Phase-0. Python code uses Pydantic models (type-safe), pytest tests required in `scraper/tests/`. |

**POST-DESIGN GATE RESULT**: PASS — No new violations. Original deviation remains justified.

## Project Structure

### Documentation (this feature)

```text
specs/004-python-bulk-scraper/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── json-schema.md   # Article JSON output contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
scraper/                        # Python scraper — isolated from Next.js src/
├── pyproject.toml              # Python project config + dependencies
├── README.md                   # Usage documentation
├── scraper.py                  # CLI entry point (argparse)
├── discover.py                 # Sitemap parsing + category fallback discovery
├── extract.py                  # Article content extraction + pagination merge
├── images.py                   # Image downloading with skip-existing logic
├── manifest.py                 # Manifest CRUD (load/save/update status)
├── models.py                   # Pydantic data models (Article, ManifestEntry)
└── tests/
    ├── test_discover.py        # Discovery unit tests (mocked sitemap XML)
    ├── test_extract.py         # Extraction tests (mocked article HTML)
    ├── test_images.py          # Image download tests
    └── test_manifest.py        # Manifest CRUD tests

scraped/                        # Output directory (gitignored)
├── manifest.json               # Discovery + status tracking
├── articles/                   # One .json per article
│   └── <slug>.json
└── images/                     # Downloaded images per article
    └── <slug>/
        ├── 00-thumbnail.jpg
        ├── 01-image-name.jpg
        └── ...

# Existing Next.js (modified files)
src/lib/scraper/pipeline.ts     # Modified: add local-JSON-read path
src/types/api.ts                # Modified: extend ScrapeResponse.data with category/tags
```

**Structure Decision**: Isolated `scraper/` directory at project root. Python code does not mix with `src/`. The only integration touchpoints are the JSON output schema and 2 modified TypeScript files.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Python in a TypeScript project | Scrapling is Python-only; user requirement | A TS-only scraper (current `tasteofcinema.ts`) already exists but doesn't support bulk crawling with concurrency, pause/resume, or sitemap-first discovery. Rewriting Scrapling's capabilities in TS would be extensive. |
