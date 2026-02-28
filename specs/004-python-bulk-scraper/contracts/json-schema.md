# Contract: Article JSON Output Schema

**Spec**: [../spec.md](../spec.md) | **FR**: FR-006, FR-003

## Overview

Each scraped article is saved as a JSON file at `scraped/articles/<slug>.json`. This contract defines the exact schema that the Python scraper outputs and the Node.js pipeline consumes.

---

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ScrapedArticle",
  "description": "Output format for a single scraped article from tasteofcinema.com",
  "type": "object",
  "required": ["title", "content", "author", "url", "inline_images", "movie_titles", "category", "tags", "pages_merged", "scraped_at"],
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "Original English article title"
    },
    "content": {
      "type": "string",
      "minLength": 1,
      "description": "Full HTML body content, all pages merged in order"
    },
    "author": {
      "type": "string",
      "minLength": 1,
      "description": "Author name, defaults to 'Taste of Cinema'"
    },
    "url": {
      "type": "string",
      "format": "uri",
      "description": "Canonical page-1 article URL"
    },
    "featured_image": {
      "type": ["string", "null"],
      "format": "uri",
      "description": "Absolute URL to featured/thumbnail image, null if absent"
    },
    "inline_images": {
      "type": "array",
      "items": { "type": "string", "format": "uri" },
      "description": "All inline image URLs across all pages, in order of appearance"
    },
    "movie_titles": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Extracted movie title strings from headings/bold text"
    },
    "category": {
      "type": "string",
      "minLength": 1,
      "description": "Primary category slug (e.g., 'features', 'film-lists', 'reviews')"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Tag slugs, may be empty array"
    },
    "pages_merged": {
      "type": "integer",
      "minimum": 1,
      "description": "Number of pages merged (1 = single-page article)"
    },
    "scraped_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of when article was scraped"
    }
  },
  "additionalProperties": false
}
```

---

## Example Document

```json
{
  "title": "All 25 Best Picture Winners of the 21st Century Ranked From Worst to Best",
  "content": "<p>On February 9th, 2020, the audience at the Dolby Theatre...</p>\n\n<p><strong>25. Crash (2005)</strong></p>...",
  "author": "Jack Murphy",
  "url": "https://www.tasteofcinema.com/2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/",
  "featured_image": "https://www.tasteofcinema.com/wp-content/uploads/2026/01/best-picture-winners.jpg",
  "inline_images": [
    "https://www.tasteofcinema.com/wp-content/uploads/2026/01/crash-2005.jpg",
    "https://www.tasteofcinema.com/wp-content/uploads/2026/01/the-artist.jpg"
  ],
  "movie_titles": ["Crash", "The Artist", "Green Book", "CODA", "The King's Speech"],
  "category": "film-lists",
  "tags": ["best-picture", "oscars", "ranked"],
  "pages_merged": 3,
  "scraped_at": "2026-02-28T14:32:11Z"
}
```

---

## TypeScript Consumer Mapping

The Node.js pipeline reads these JSON files and maps fields to the existing `ScrapeResponse.data` interface:

```typescript
// In modified pipeline.ts — reading from local JSON
interface LocalArticleJSON {
  title: string;
  content: string;
  author: string;
  url: string;
  featured_image: string | null;  // → featuredImage
  inline_images: string[];        // → inlineImages
  movie_titles: string[];         // → movieTitles
  category: string;               // new — passed to translate
  tags: string[];                 // new — passed to translate
  pages_merged: number;           // metadata, not passed downstream
  scraped_at: string;             // metadata, not passed downstream
}

// Conversion to ScrapeResponse.data:
function toScrapeResponseData(json: LocalArticleJSON): ScrapeResponse['data'] {
  return {
    title: json.title,
    content: json.content,
    author: json.author,
    url: json.url,
    featuredImage: json.featured_image ?? undefined,
    inlineImages: json.inline_images,
    movieTitles: json.movie_titles,
  };
}
```

---

## Manifest Contract

**File**: `scraped/manifest.json`

```json
{
  "version": 1,
  "discovered_at": "2026-02-28T12:00:00Z",
  "total": 5823,
  "completed": 5810,
  "failed": 13,
  "entries": {
    "<slug>": {
      "url": "string (URI)",
      "slug": "string (^[a-z0-9-]+$)",
      "status": "pending | completed | failed",
      "last_modified": "string (ISO 8601) | null",
      "scraped_at": "string (ISO 8601) | null",
      "error": "string | null",
      "pages_found": "integer >= 0",
      "images_found": "integer >= 0",
      "images_downloaded": "integer >= 0"
    }
  }
}
```

---

## CLI Interface Contract

```
usage: scraper.py [-h] [--discover-only] [--force] [--limit N]
                  [--delay SECONDS] [--workers N] [--output-dir DIR]
                  [--verbose]

Bulk scrape tasteofcinema.com articles and images.

options:
  -h, --help         show this help message and exit
  --discover-only    Only discover URLs and build manifest; do not scrape
  --force            Re-scrape all articles, ignoring manifest status
  --limit N          Maximum number of articles to scrape (default: all)
  --delay SECONDS    Delay between requests in seconds (default: 2.0)
  --workers N        Number of parallel workers (default: 3, max: 5)
  --output-dir DIR   Output directory (default: ./scraped)
  --verbose          Enable verbose logging
```

**Exit Codes**:
- `0`: Success (all targeted articles scraped)
- `1`: Partial failure (some articles failed, see manifest)
- `2`: Fatal error (discovery failed, invalid arguments, etc.)
