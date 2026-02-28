# Data Model: Article Page Enhancement

**Feature**: 003-article-page-enhancement  
**Date**: 2026-02-28

---

## Existing Entities (no schema changes)

### Article

The `articles` table already contains the `featured_image` column. No DDL changes are required.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | INTEGER | PK, auto | — |
| `slug` | TEXT | NOT NULL, UNIQUE | URL-friendly identifier |
| `title_ar` | TEXT | NOT NULL | Arabic title (may contain original-language movie names) |
| `title_en` | TEXT | nullable | Original English title |
| `excerpt_ar` | TEXT | nullable | Arabic summary |
| `category` | TEXT | NOT NULL | Category slug |
| `tags` | TEXT | nullable | JSON array of tag strings |
| **`featured_image`** | **TEXT** | **nullable** | **Absolute URL to thumbnail image. Populated by scraper from source page `og:image` meta tag.** |
| `author` | TEXT | DEFAULT 'مذاق السينما' | Attribution |
| `source_url` | TEXT | NOT NULL | Link to original English article |
| `source_site` | TEXT | DEFAULT 'tasteofcinema.com' | — |
| `markdown_path` | TEXT | nullable | Path to MDX content file |
| `status` | TEXT | DEFAULT 'draft' | draft \| published \| archived |
| `is_featured` | INTEGER | DEFAULT 0 | — |
| `view_count` | INTEGER | DEFAULT 0 | — |
| `reading_time` | INTEGER | nullable | Estimated minutes |
| `published_at` | DATETIME | nullable | — |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | — |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | — |

---

## Transient Entities (not persisted)

### MovieTitleToken

Extracted at scrape time, passed through the pipeline, but not stored in the database. Used only during the translation step.

| Field | Type | Description |
|-------|------|-------------|
| `original` | string | The movie title text as found in source HTML (e.g., `"Back to the Wall"`, `"七人の侍"`) |
| `withYear` | string \| null | Title with year suffix if present (e.g., `"Back to the Wall (1958)"`) |
| `source` | `'heading'` \| `'inline'` | Whether extracted from a numbered heading or inline emphasis tag |

### PlaceholderMapping

Created during translation preprocessing. Maps placeholder tokens to original movie titles.

| Field | Type | Description |
|-------|------|-------------|
| `placeholder` | string | The substitution token (e.g., `"[[TITLE_1]]"`) |
| `original` | string | The original movie title text to restore after translation |

---

## Type Definitions (TypeScript)

### Updated: `ScrapeResponse` (in `src/types/api.ts`)

```typescript
export interface ScrapeResponse {
  success: boolean;
  data?: {
    title: string;
    content: string;
    author: string;
    url: string;
    featuredImage?: string;   // NEW — absolute URL to article thumbnail
    movieTitles?: string[];   // NEW — extracted movie title strings
  };
  error?: string;
}
```

### Updated: `TranslateRequest` (in `src/types/api.ts`)

```typescript
export interface TranslateRequest {
  url: string;
  content: string;
  title: string;
  movieTitles?: string[];   // NEW — titles to protect from translation
}
```

### New: `PlaceholderMap` (in `src/lib/ai/translate.ts`, module-private)

```typescript
interface PlaceholderMap {
  placeholder: string;
  original: string;
}
```

---

## Data Flow

```
┌──────────────────┐
│   Scrape API     │
│ POST /api/scrape │
└────────┬─────────┘
         │ ScrapeResponse { title, content, author, url, featuredImage, movieTitles }
         ▼
┌────────────────────┐
│   Translate API    │
│ POST /api/translate│
│                    │
│ 1. insertPlaceholders(content, movieTitles) → processed + map
│ 2. AI translation (processed content with [[TITLE_N]] tokens)
│ 3. restorePlaceholders(translated, map) → final content
│ 4. saveArticleMetadata({ ..., featured_image: featuredImage })
│ 5. saveMarkdownFile(slug, finalContent)
└────────────────────┘
         │
         ▼
┌────────────────────┐
│   Article Page     │
│ /article/[slug]    │
│                    │
│ - getArticleBySlug → featured_image, title_ar, ...
│ - readMarkdownFile → MDX content (with preserved titles)
│ - Renders thumbnail if featured_image present
│ - Renders MDX with original-language movie titles
└────────────────────┘
```

---

## Validation Rules

| Rule | Where Applied | Description |
|------|---------------|-------------|
| `featured_image` must be absolute URL or empty | Scraper (`extractFeaturedImage`) | Relative URLs resolved against source URL via `new URL()`. Empty string → stored as NULL. |
| Movie titles sorted by length descending | `insertPlaceholders()` | Prevents partial matches (e.g., "The Godfather" matching inside "The Godfather Part II") |
| Regex special chars escaped in titles | `insertPlaceholders()` | Titles like "M*A*S*H" don't break regex replacement |
| Placeholder restoration is idempotent | `restorePlaceholders()` | If a placeholder appears 0 times in output (AI removed it), no error — the title is simply missing from the translation |
| `featured_image` conditional render | Article page component | `null`, `undefined`, or empty string → no `<Image>` element rendered |

---

## State Transitions

No new state transitions. The existing article lifecycle (`draft → published → archived`) is unchanged. `featured_image` is populated at creation time and does not change state.
