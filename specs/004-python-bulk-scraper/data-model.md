# Data Model: Python Bulk Content Scraper

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Overview

The scraper uses Pydantic models for validation and JSON serialization. All models align with the existing TypeScript `ScrapeResponse.data` interface and SQLite schema to enable seamless pipeline integration.

---

## 1. Article (Primary Entity)

**File**: `scraped/articles/<slug>.json`  
**FR**: FR-003, FR-006

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| `title` | `str` | ✅ | `<h1>` / `.entry-title` | Original English title |
| `content` | `str` | ✅ | `.entry-content` | Full HTML body, all pages merged (FR-004) |
| `author` | `str` | ✅ | `.author-name` / meta | Falls back to `"Taste of Cinema"` |
| `url` | `str` | ✅ | Sitemap / discovery | Canonical page-1 URL |
| `featured_image` | `str \| None` | ❌ | `.wp-post-image` / OG meta | Absolute URL to thumbnail |
| `inline_images` | `list[str]` | ✅ | `.entry-content img` | All image URLs across all pages |
| `movie_titles` | `list[str]` | ✅ | Bold/heading patterns | Extracted film title strings |
| `category` | `str` | ✅ | `.cat-links a` / REST API | Primary category slug |
| `tags` | `list[str]` | ✅ | `.tag-links a` / REST API | Tag slugs, may be empty |
| `pages_merged` | `int` | ✅ | Pagination detection | Number of pages merged (1 = single page) |
| `scraped_at` | `str` (ISO 8601) | ✅ | System clock | When this article was scraped |

### Pydantic Model

```python
from pydantic import BaseModel, HttpUrl
from datetime import datetime

class ArticleData(BaseModel):
    """Single scraped article — compatible with ScrapeResponse.data."""
    title: str
    content: str
    author: str
    url: str
    featured_image: str | None = None
    inline_images: list[str] = []
    movie_titles: list[str] = []
    category: str
    tags: list[str] = []
    pages_merged: int = 1
    scraped_at: str  # ISO 8601
```

### TypeScript Alignment

Maps to `ScrapeResponse.data` with additions:

| Python field | TS field | Status |
|-------------|----------|--------|
| `title` | `title` | ✅ Direct match |
| `content` | `content` | ✅ Direct match |
| `author` | `author` | ✅ Direct match |
| `url` | `url` | ✅ Direct match |
| `featured_image` | `featuredImage` | ✅ camelCase mapping |
| `inline_images` | `inlineImages` | ✅ camelCase mapping |
| `movie_titles` | `movieTitles` | ✅ camelCase mapping |
| `category` | — | 🆕 Added for pipeline enrichment |
| `tags` | — | 🆕 Added for pipeline enrichment |
| `pages_merged` | — | 🆕 Metadata only |
| `scraped_at` | — | 🆕 Metadata only |

---

## 2. Manifest Entry

**File**: `scraped/manifest.json`  
**FR**: FR-007, FR-008

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `url` | `str` | ✅ | Canonical article URL |
| `slug` | `str` | ✅ | Derived from URL path (last segment) |
| `status` | `str` enum | ✅ | `pending`, `completed`, `failed` |
| `last_modified` | `str \| None` | ❌ | From sitemap `<lastmod>` |
| `scraped_at` | `str \| None` | ❌ | ISO 8601 timestamp of last scrape |
| `error` | `str \| None` | ❌ | Error message if `failed` |
| `pages_found` | `int` | ✅ | Number of pages discovered (pagination) |
| `images_found` | `int` | ✅ | Number of images referenced |
| `images_downloaded` | `int` | ✅ | Number of images successfully saved |

### Pydantic Model

```python
from enum import Enum

class ScrapeStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"

class ManifestEntry(BaseModel):
    """Tracking entry for a single article in the manifest."""
    url: str
    slug: str
    status: ScrapeStatus = ScrapeStatus.PENDING
    last_modified: str | None = None
    scraped_at: str | None = None
    error: str | None = None
    pages_found: int = 0
    images_found: int = 0
    images_downloaded: int = 0
```

---

## 3. Manifest (Root)

**File**: `scraped/manifest.json`

```python
class Manifest(BaseModel):
    """Root manifest tracking all discovered articles."""
    version: int = 1
    discovered_at: str  # ISO 8601 — when discovery was last run
    total: int          # Total number of entries
    completed: int = 0
    failed: int = 0
    entries: dict[str, ManifestEntry]  # keyed by slug
```

### JSON Structure

```json
{
  "version": 1,
  "discovered_at": "2026-02-28T12:00:00Z",
  "total": 5823,
  "completed": 5810,
  "failed": 13,
  "entries": {
    "all-25-best-picture-winners-ranked": {
      "url": "https://www.tasteofcinema.com/2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/",
      "slug": "all-25-best-picture-winners-ranked",
      "status": "completed",
      "last_modified": "2026-01-15T00:00:00Z",
      "scraped_at": "2026-02-28T14:32:11Z",
      "error": null,
      "pages_found": 3,
      "images_found": 26,
      "images_downloaded": 26
    }
  }
}
```

---

## 4. Image Reference

Not persisted as its own file, but tracked within `ArticleData.inline_images` and the downloaded file structure.

### File Naming Convention

```
scraped/images/<slug>/
├── 00-thumbnail.jpg       # Featured image (if present)
├── 01-<sanitized-name>.jpg
├── 02-<sanitized-name>.jpg
└── ...
```

- Index prefix (`00-`, `01-`) preserves order of appearance
- Thumbnail is always `00-thumbnail.*` if featured image exists
- File extension preserved from source URL
- Filenames sanitized: lowercase, alphanumeric + hyphens only

---

## 5. Relationships

```
Manifest (1) ──contains──> ManifestEntry (N)
                                │
                                │ slug
                                ▼
                         ArticleData (1) ── scraped/articles/<slug>.json
                                │
                                │ slug
                                ▼
                         Image Files (N) ── scraped/images/<slug>/*
```

---

## 6. State Transitions

### ManifestEntry.status

```
  ┌──────────┐     scrape started     ┌──────────────┐
  │ pending  │ ───────────────────────>│  (scraping)  │
  └──────────┘                        └──────┬───────┘
       ▲                                     │
       │ --force flag                        │
       │                          ┌──────────┴──────────┐
       │                          ▼                     ▼
  ┌──────────┐            ┌───────────┐          ┌──────────┐
  │  failed  │            │ completed │          │  failed  │
  └──────────┘            └───────────┘          └──────────┘
       │                                              │
       └──────────── incremental re-run ──────────────┘
                     (only processes pending + failed)
```

**Note**: `scraping` is a transient in-memory state, not persisted. On crash/interrupt, the entry remains `pending` and will be retried on next run.

---

## 7. Validation Rules

| Rule | Model | Field | Constraint |
|------|-------|-------|------------|
| V-001 | ArticleData | `title` | Non-empty string |
| V-002 | ArticleData | `content` | Non-empty string (HTML) |
| V-003 | ArticleData | `url` | Valid HTTP(S) URL |
| V-004 | ArticleData | `category` | Non-empty string |
| V-005 | ArticleData | `pages_merged` | ≥ 1 |
| V-006 | ManifestEntry | `slug` | Non-empty, matches `^[a-z0-9-]+$` |
| V-007 | ManifestEntry | `status` | One of: `pending`, `completed`, `failed` |
| V-008 | Manifest | `total` | ≥ 0 |
