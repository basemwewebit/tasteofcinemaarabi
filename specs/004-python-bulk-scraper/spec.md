# Feature Specification: Python Bulk Content Scraper

**Feature Branch**: `004-python-bulk-scraper`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: User description: "Python bulk scraper using Scrapling to crawl all content and images from tasteofcinema.com, store locally in integration-ready format for translation and Arabic content pipeline, with incremental re-run support"

---

## Overview

A standalone Python scraper that crawls the entire tasteofcinema.com website, discovers all published articles, and extracts their full content (including paginated articles) and images. The output is stored in a structured, integration-ready format (JSON) that the existing Next.js application can consume for Arabic translation, image processing, and publishing through the current pipeline. The scraper supports incremental runs — when new content is published on tasteofcinema.com, re-running the script only processes articles not yet scraped.

### Assumptions

- **Library**: Scrapling (Python) with `StealthyFetcher` or `Fetcher` for HTTP requests, leveraging its anti-bot bypass and adaptive scraping capabilities.
- **Target site**: https://www.tasteofcinema.com/ — a WordPress-based editorial site with article listings accessible via category pages, archive pages, and pagination.
- **Article structure**: Each article has a title, author, featured image, body content (HTML with inline images), and may span multiple pages (WordPress pagination via `/2/`, `/3/` suffixes).
- **Output format**: JSON files per article (one `.json` file per article) stored under a `scraped/` directory, plus downloaded images stored under `scraped/images/`.
- **Image handling**: Images are downloaded at original quality; WEBP conversion is handled downstream by the existing Next.js pipeline (`imageProcessor.ts`).
- **Delay between requests**: Default 2 seconds per-domain, configurable via command-line argument, to respect the site and avoid throttling.
- **Concurrency**: Default 3 parallel workers for article scraping and image downloading, configurable via `--workers N` (max 5 recommended). Per-domain delay is still enforced per worker.
- **Data retention**: Incremental state is tracked via a local manifest file (`scraped/manifest.json`) that records which article URLs have been processed.
- **Integration**: The JSON output schema aligns with the existing `ScrapeResponse.data` interface (`title`, `content`, `author`, `url`, `featuredImage`, `inlineImages`, `movieTitles`) and extends it with `category` and `tags[]` fields. The existing Node.js pipeline (`pipeline.ts`) will be modified to read from locally scraped JSON files instead of calling the TypeScript `scrapeArticle()` function — effectively replacing the remote-scrape step with a local-read step while keeping translation, image processing, and publishing unchanged.
- **Python version**: 3.10 or higher (Scrapling requirement).
- **Robots.txt compliance**: The scraper respects tasteofcinema.com/robots.txt — previously verified (2026-02-28) that article paths are not disallowed.
- **Git exclusion**: The entire `scraped/` output directory (images, JSON files, manifest) MUST be excluded from git via `.gitignore`. Large binary files like images must never be committed to the repository.

---

## Clarifications

### Session 2026-02-28

- Q: How should bulk-scraped Python output enter the existing Next.js pipeline? → A: Modify existing pipeline code to read from locally scraped JSON files instead of remote-scraping — Python scraper pulls all content locally, then the Node.js pipeline reads from those local files (skipping the TypeScript `scrapeArticle()` call).
- Q: Which crawl strategy should the scraper use for article discovery? → A: Sitemap-first — parse WordPress sitemap XML (`/sitemap.xml`, `/post-sitemap.xml`) for all article URLs; fall back to category page crawling only if sitemap is unavailable.
- Q: Should the scraper support concurrent/parallel downloading? → A: Moderate concurrency (3–5 parallel workers) with per-domain delay — balances speed and politeness; configurable via CLI.
- Q: Should the Python scraper extract article category and tags from the source site? → A: Yes — extract WordPress category and tags from each article page and include them in the JSON output for downstream use.
- Q: Should scraped output (images, JSON) be tracked in git? → A: No — the entire `scraped/` directory must be in `.gitignore`. Large files like images must never be committed to the repository.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full Site Crawl & Article Discovery (Priority: P1)

As a content operator, I want to run a single command that crawls tasteofcinema.com, discovers all published article URLs, and saves them to a manifest so I know the complete inventory of content available for import.

**Why this priority**: Without article discovery, nothing else works. This is the foundation — the scraper must first know what articles exist before it can extract any content.

**Independent Test**: Run the script with `--discover-only` flag. Verify the manifest file is created with a list of all article URLs found on the site (expected: hundreds of articles). Compare a sample of URLs against the live site to confirm accuracy.

**Acceptance Scenarios**:

1. **Given** the scraper is run for the first time with `--discover-only`, **When** it completes, **Then** a `scraped/manifest.json` file is created containing all discovered article URLs, each with a status of `pending`.
2. **Given** the site exposes a WordPress sitemap (`/sitemap.xml` or `/post-sitemap.xml`), **When** the discovery crawl runs, **Then** it parses the sitemap XML to extract all article URLs as the primary discovery method.
3. **Given** the sitemap is unavailable (404 or malformed), **When** discovery falls back to category crawling, **Then** it walks all category pages and their pagination to discover articles.
4. **Given** some article URLs appear in multiple sitemap entries or category pages, **When** discovery completes, **Then** the manifest contains each URL exactly once (no duplicates).
5. **Given** the discovery crawl encounters a network error on one source, **When** the error occurs, **Then** the scraper logs the error, skips the problematic source, and continues discovering articles from remaining sources.

---

### User Story 2 - Article Content Extraction with Pagination (Priority: P1)

As a content operator, I want the scraper to extract the full content of each discovered article — including title, author, body HTML, featured image URL, inline image URLs, and movie titles — handling multi-page articles correctly by merging all pages into one document.

**Why this priority**: Content extraction is the core value of the scraper. Each extracted article produces a JSON file that feeds directly into the existing translation and publishing pipeline.

**Independent Test**: Run the scraper on a known multi-page article URL (e.g., a "Top 25" list that spans 3+ pages). Verify the output JSON contains the complete merged content from all pages, with all inline images listed and the title correctly extracted.

**Acceptance Scenarios**:

1. **Given** a single-page article, **When** the scraper processes it, **Then** a JSON file is created under `scraped/articles/<slug>.json` containing `title`, `content` (full HTML), `author`, `url`, `featuredImage`, `inlineImages[]`, `movieTitles[]`, `category`, and `tags[]`.
2. **Given** a multi-page article (e.g., `/article-name/`, `/article-name/2/`, `/article-name/3/`), **When** the scraper processes it, **Then** all pages are fetched and their content concatenated in order into a single `content` field.
3. **Given** an article contains numbered list items with movie titles (e.g., "25. The Shawshank Redemption"), **When** extracted, **Then** the `movieTitles` array contains all movie titles parsed from the article.
4. **Given** a scrape produces valid JSON output, **When** the JSON is compared to the existing `ScrapeResponse.data` TypeScript interface, **Then** all required fields are present and correctly typed (strings, arrays).
5. **Given** an article page returns a 404 or times out after retries, **When** the error occurs, **Then** the manifest entry for that URL is marked as `failed` with the error reason, and the scraper continues to the next article.

---

### User Story 3 - Image Downloading (Priority: P1)

As a content operator, I want all images referenced in scraped articles (featured images and inline images) to be downloaded locally so they are available for the downstream WEBP conversion and hosting pipeline.

**Why this priority**: Images are essential for the article display. The existing pipeline expects local image files to process. Without downloading images during scraping, the content is incomplete.

**Independent Test**: Scrape a single article with 5+ inline images. Verify all images are downloaded to `scraped/images/<slug>/` and the JSON file references the local paths.

**Acceptance Scenarios**:

1. **Given** an article has a featured image and 8 inline images, **When** scraping completes, **Then** all 9 images are downloaded to `scraped/images/<article-slug>/` with descriptive filenames.
2. **Given** an image URL returns a 403 or connection timeout, **When** the download fails, **Then** the original URL is preserved in the JSON output, the failure is logged, and scraping continues.
3. **Given** the scraper is re-run on an already-scraped article, **When** images already exist locally, **Then** existing images are skipped (not re-downloaded) to save time and bandwidth.
4. **Given** images are downloaded, **When** the JSON file is written, **Then** `featuredImage` and `inlineImages[]` contain local relative paths (e.g., `scraped/images/article-slug/00-thumbnail.jpg`) alongside the original URLs for reference.

---

### User Story 4 - Incremental Re-run Support (Priority: P2)

As a content operator, I want to re-run the scraper periodically and have it only process new articles that weren't scraped before, so I can keep the local content library up-to-date without re-downloading everything.

**Why this priority**: The site publishes new articles regularly. Re-scraping the entire site each time is wasteful. Incremental support makes the tool practical for ongoing use.

**Independent Test**: Run a full scrape, note the article count. Add a simulated new article URL to the manifest as `pending`. Re-run the scraper. Verify only the new article is processed while previously completed articles are skipped.

**Acceptance Scenarios**:

1. **Given** the manifest contains 200 articles with status `completed`, **When** the scraper runs again, **Then** it first performs discovery to find any new article URLs not in the manifest.
2. **Given** 5 new articles are discovered, **When** the scraper proceeds to extraction, **Then** only those 5 new articles are scraped, and pre-existing completed articles are not re-fetched.
3. **Given** the `--force` flag is provided, **When** the scraper runs, **Then** all articles are re-scraped regardless of their manifest status (full overwrite mode).
4. **Given** an article previously failed, **When** the scraper runs again without `--force`, **Then** failed articles are retried automatically.

---

### User Story 5 - CLI Interface & Configuration (Priority: P2)

As a content operator, I want a simple command-line interface to control the scraper's behavior — setting delay, limiting articles, running discovery only, or forcing a full re-scrape — so I can adapt the scraping to my current needs.

**Why this priority**: A well-configured CLI makes the tool usable in practice. Without it, operators would need to edit code to change behavior.

**Independent Test**: Run `python scraper.py --help` and verify all documented flags are shown. Run with `--limit 5 --delay 3` and verify only 5 articles are processed with 3-second delays between requests.

**Acceptance Scenarios**:

1. **Given** the user runs `python scraper.py --help`, **When** the help text is displayed, **Then** it lists all available options: `--discover-only`, `--force`, `--limit N`, `--delay N`, `--workers N`, `--output-dir PATH`, `--verbose`.
2. **Given** `--limit 10` is provided, **When** the scraper runs, **Then** it processes at most 10 articles (useful for testing or rate-limited environments).
3. **Given** `--delay 5` is provided, **When** requests are made, **Then** there is a 5-second pause between each HTTP request to the target site.
4. **Given** `--output-dir ./custom-output` is provided, **When** scraping completes, **Then** all output (JSON files, images, manifest) is written under `./custom-output/` instead of the default `scraped/`.
5. **Given** `--verbose` is provided, **When** the scraper runs, **Then** detailed progress logs are printed (current article, page count, image downloads, errors).

---

### Edge Cases

- What happens when the site is temporarily down? The scraper retries each request up to 3 times with exponential backoff, then marks the URL as `failed` and moves on.
- What happens when an article has no images? The scraper creates the JSON with an empty `inlineImages` array and `null` for `featuredImage`.
- What happens when the same image URL appears in multiple articles? Each article's images are stored in its own slug-based directory, so duplicates across articles are stored independently (simplicity over deduplication).
- What happens when the manifest file is corrupted or deleted? The scraper recreates it via a fresh discovery crawl, treating all articles as `pending`.
- What happens when article content contains non-English characters or special HTML entities? The scraper preserves the raw HTML as-is; character encoding is handled by the downstream translation pipeline.
- What happens when pagination links point to a redirect loop? The scraper tracks visited URLs per article and breaks out after detecting a duplicate URL.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST discover all published article URLs on tasteofcinema.com using a sitemap-first strategy: parse WordPress sitemap XML (`/sitemap.xml`, `/post-sitemap.xml`) as the primary method, falling back to category/archive page crawling if sitemap is unavailable.
- **FR-002**: System MUST follow pagination on listing pages to discover articles beyond the first page of results when using the category-crawl fallback.
- **FR-003**: System MUST extract from each article: title, author name, full body HTML content, featured image URL, all inline image URLs, movie title strings, category, and tags.
- **FR-004**: System MUST handle multi-page articles by detecting pagination links and merging all page content into a single document in correct order.
- **FR-005**: System MUST download all referenced images (featured + inline) to a local directory organized by article slug.
- **FR-006**: System MUST output one JSON file per article with a schema compatible with the existing `ScrapeResponse.data` TypeScript interface.
- **FR-007**: System MUST maintain a manifest file tracking each article URL's scrape status (`pending`, `completed`, `failed`).
- **FR-008**: System MUST support incremental re-runs by only processing articles not yet marked `completed` in the manifest.
- **FR-009**: System MUST support a `--force` flag to override incremental behavior and re-scrape all articles.
- **FR-010**: System MUST respect configurable delay between requests (default: 2 seconds per-domain) and support configurable concurrency (default: 3 parallel workers, via `--workers N`).
- **FR-011**: System MUST retry failed HTTP requests up to 3 times with exponential backoff before marking as failed.
- **FR-012**: System MUST use Scrapling library (Python) for all HTTP fetching and HTML parsing.
- **FR-013**: System MUST provide a CLI with `--help`, `--discover-only`, `--force`, `--limit`, `--delay`, `--workers`, `--output-dir`, and `--verbose` options.
- **FR-014**: System MUST log errors per article without stopping the overall scrape process (fault-tolerant crawling).
- **FR-015**: System MUST skip downloading images that already exist locally during incremental runs.
- **FR-016**: The `scraped/` output directory (images, JSON files, manifest) MUST be excluded from version control via `.gitignore`. No large binary files should be committed to the repository.

### Key Entities

- **Article**: A single piece of content from tasteofcinema.com — identified by its URL, containing title, author, HTML body content, featured image, inline images, category, tags, and optionally extracted movie titles. May span multiple paginated pages on the source site.
- **Manifest**: A persistent JSON file tracking all known article URLs and their scrape status (`pending`, `completed`, `failed`), along with timestamps and error messages for failed entries.
- **Image**: A media file (JPEG, PNG, GIF, WebP) referenced within an article's HTML content, stored locally under a directory named after the article's slug.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A full discovery crawl identifies all published articles on tasteofcinema.com (expected: 500+ articles based on site history) within a single run.
- **SC-002**: 95% or more of discovered articles are successfully scraped (content + images extracted) without manual intervention.
- **SC-003**: Multi-page articles produce a single merged JSON output with content from all pages in correct order — validated on at least 10 known multi-page articles.
- **SC-004**: An incremental re-run after a full scrape completes in under 5 minutes when no new articles exist (manifest check + discovery only, no re-downloading).
- **SC-005**: Output JSON files are directly consumable by the existing Next.js import pipeline without schema modifications — validated by importing at least 3 scraped articles through the current translate-and-publish workflow.
- **SC-006**: Image download success rate is 90% or higher (accounting for broken source URLs on the original site).
- **SC-007**: The scraper runs end-to-end without human intervention — no interactive prompts, manual page selection, or code edits required during execution.
