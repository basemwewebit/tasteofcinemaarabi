# Data Model: Article Scraper & Premium UI Redesign

**Branch**: `001-article-scraper` | **Phase**: 1 | **Date**: 2026-02-28

---

## Existing Schema Context

The project uses `better-sqlite3` with a single database at `data/cinema.db`. Migrations are applied at startup via `src/lib/db/index.ts`.

The existing `articles` table has:
```sql
slug TEXT, title_ar TEXT, title_en TEXT, excerpt_ar TEXT, category TEXT, tags TEXT,
featured_image TEXT, author TEXT, source_url TEXT, source_site TEXT,
markdown_path TEXT, status TEXT, published_at DATETIME, created_at DATETIME, updated_at DATETIME
```

---

## Changes Required

### 1. New: `settings` Table

Stores admin-configurable key-value pairs. Required for FR-015 (configurable scrape delay).

```sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default scrape delay
INSERT OR IGNORE INTO settings (key, value) VALUES ('scrape_delay_seconds', '2');
```

**Keys defined by this feature**:

| Key | Default | Description |
|-----|---------|-------------|
| `scrape_delay_seconds` | `'2'` | Seconds to wait between page/image fetches |

---

### 2. New: `scrape_jobs` Table

Tracks each scrape invocation with its lifecycle status. Required for FR-013, FR-014, and admin observability.

```sql
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_url   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
               -- values: pending | scraping | processing-images | translating | completed | failed
  pages_found  INTEGER DEFAULT 0,
  images_found INTEGER DEFAULT 0,
  images_saved INTEGER DEFAULT 0,
  article_id   INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  error_log    TEXT,            -- JSON array of error strings
  started_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

**State Transitions**:
```
pending → scraping → processing-images → translating → completed
                                                      ↘ failed (at any step)
```

---

### 3. Articles Table: `page_count` Column (New)

Add `page_count INTEGER DEFAULT 1` to the existing `articles` table to record how many source pages were scraped (informational, helps diagnose partial scrapes).

```sql
ALTER TABLE articles ADD COLUMN page_count INTEGER DEFAULT 1;
ALTER TABLE articles ADD COLUMN scraped_at DATETIME;
```

---

## Entity Summary

### Article *(existing + extended)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | Auto |
| `slug` | TEXT UNIQUE | URL-safe, derived from English title |
| `title_ar` | TEXT | Arabic title (from translation) |
| `title_en` | TEXT | Original English title (source integrity) |
| `excerpt_ar` | TEXT | Arabic excerpt (from translation) |
| `category` | TEXT | e.g. "قوائم أفلام" |
| `featured_image` | TEXT | Local path: `/images/articles/{slug}/thumbnail.webp` |
| `author` | TEXT | Original author name (source integrity) |
| `source_url` | TEXT | Original tasteofcinema.com URL |
| `markdown_path` | TEXT | Relative path to `.mdx` file |
| `status` | TEXT | `draft` | `published` |
| `page_count` | INTEGER | **NEW** — number of source pages scraped |
| `scraped_at` | DATETIME | **NEW** — timestamp of last successful scrape |
| `published_at` | DATETIME | When published |
| `created_at` | DATETIME | Record creation |
| `updated_at` | DATETIME | Last update |

---

### ScrapeJob *(new)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | Auto |
| `target_url` | TEXT | Input URL from admin |
| `status` | TEXT | Enum: see state transitions above |
| `pages_found` | INTEGER | Total pages discovered |
| `images_found` | INTEGER | Total images extracted from HTML |
| `images_saved` | INTEGER | Successfully converted to WEBP |
| `article_id` | INTEGER FK | Links to resulting article (null if failed) |
| `error_log` | TEXT | JSON array of error strings |
| `started_at` | DATETIME | Job creation time |
| `completed_at` | DATETIME | When status hit `completed` or `failed` |

---

### Settings *(new)*

| Field | Type | Notes |
|-------|------|-------|
| `key` | TEXT PK | Unique setting identifier |
| `value` | TEXT | String-encoded value |
| `updated_at` | DATETIME | Last modified |

---

## Image File Naming Convention

```
/public/images/articles/{article-slug}/{index:02d}-{slugified-original-name}.webp
```

**Examples**:
```
/public/images/articles/25-best-picture-winners/00-thumbnail.webp   ← featured image
/public/images/articles/25-best-picture-winners/01-moonlight-2016.webp
/public/images/articles/25-best-picture-winners/02-parasite-poster.webp
```

**Rules**:
- Index 00 is always reserved for the featured/thumbnail image.
- Index increments per inline content image (01, 02, ...).
- Filename is slugified from the original filename or URL path segment.
- All files are `.webp` regardless of source format.

---

## Validation Rules

| Rule | Entity | Constraint |
|------|--------|------------|
| `target_url` must be a valid `https://` URL | ScrapeJob | Validated in API route before job creation |
| `target_url` must belong to `tasteofcinema.com` | ScrapeJob | Domain whitelist check |
| `slug` must be unique | Article | DB UNIQUE constraint + `slugify()` collision resolution |
| `scrape_delay_seconds` must be 0–30 | Settings | API route validator |
| `status` must be one of the defined enum values | ScrapeJob | Application-level enum check |
