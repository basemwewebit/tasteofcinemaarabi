# API Contract: POST /api/translate

**Date**: 2026-02-28 | **Branch**: `007-certified-translation-quality`

## Overview

The translation API endpoint remains backward-compatible. The response is extended with an optional `quality_report` field. The internal pipeline changes from 1 AI call to 3 sequential phases, but this is transparent to the caller.

## Request

**Method**: `POST`  
**Path**: `/api/translate`  
**Content-Type**: `application/json`

### Request Body

```json
{
  "url": "https://www.tasteofcinema.com/2026/10-great-crime-thrillers/",
  "title": "10 Great Crime Thriller Movies You Probably Haven't Seen",
  "content": "<div class=\"entry-content\">...HTML content...</div>",
  "movieTitles": ["Back to the Wall", "Death Occurred Last Night"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Source article URL |
| `title` | string | Yes | Original English title |
| `content` | string | Yes | HTML content to translate |
| `movieTitles` | string[] | No | Film titles to preserve untranslated |

**No changes from current contract.** The request interface is identical.

## Response

### Success (200)

```json
{
  "success": true,
  "data": {
    "articleId": 42,
    "slug": "10-great-crime-thriller-movies",
    "title_ar": "١٠ أفلام إثارة وجريمة رائعة ربما لم تشاهدها"
  },
  "quality_report": {
    "v": 1,
    "ts": "2026-02-28T14:30:00Z",
    "model": "google/gemini-2.5-flash-lite",
    "chunks": 1,
    "phases": {
      "translate": {
        "status": "success",
        "duration_ms": 12400,
        "tokens_in": 4200,
        "tokens_out": 5100,
        "retries": 0
      },
      "review": {
        "status": "success",
        "duration_ms": 8900,
        "tokens_in": 9800,
        "tokens_out": 6200,
        "retries": 0,
        "corrections": 7,
        "by_type": {
          "literal_translation": 3,
          "grammar": 2,
          "terminology": 1,
          "style": 1
        },
        "new_terms": 2
      },
      "proofread": {
        "status": "success",
        "duration_ms": 6100,
        "tokens_in": 5400,
        "tokens_out": 5500,
        "retries": 0,
        "polishes": 4,
        "by_type": {
          "flow": 2,
          "punctuation": 1,
          "bidi": 1
        }
      }
    },
    "totals": {
      "duration_ms": 27400,
      "tokens_in": 19400,
      "tokens_out": 16800,
      "corrections": 11,
      "new_terms": ["diegetic sound", "MacGuffin"]
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on success |
| `data.articleId` | number | Inserted/updated article ID |
| `data.slug` | string | Article slug |
| `data.title_ar` | string | Translated Arabic title |
| `quality_report` | object | **NEW** — Translation quality metrics (see data-model.md) |

### Error (500)

```json
{
  "success": false,
  "error": "Failed to translate article",
  "details": "Phase 1 translation failed after 3 retries: Empty response from OpenRouter"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` on error |
| `error` | string | Human-readable error summary |
| `details` | string | Technical error details (includes which phase failed) |

### Partial Success (200)

When Phase 2 or 3 fails but earlier phases succeeded, the API returns success with degraded quality:

```json
{
  "success": true,
  "data": { "articleId": 42, "slug": "...", "title_ar": "..." },
  "quality_report": {
    "phases": {
      "translate": { "status": "success", "..." : "..." },
      "review": { "status": "failed", "retries": 1, "..." : "..." },
      "proofread": { "status": "skipped", "..." : "..." }
    }
  }
}
```

The article is saved with the best available output (Phase 1 if Phase 2 fails, Phase 2 if Phase 3 fails).

## Internal Pipeline Contract

### TranslateRequest (unchanged)

```typescript
interface TranslateRequest {
  url: string;
  content: string;
  title: string;
  movieTitles?: string[];
}
```

### TranslateResponse (extended)

```typescript
interface TranslateResponse {
  success: boolean;
  data?: {
    title_ar: string;
    title_en: string;
    excerpt_ar: string;
    content_mdx: string;
    category: string;
    tags: string[];
    slug: string;
  };
  error?: string;
  details?: string;
  quality_report?: TranslationQualityReport;  // NEW
}
```

## Backward Compatibility

- Request contract: **Unchanged** — no migration needed for callers
- Response contract: **Additive only** — new `quality_report` field. Existing consumers that don't read it are unaffected
- Database: One `ALTER TABLE` migration adds `quality_report` column with `DEFAULT NULL` — existing rows unaffected
- Glossary file: New file, no migration. Old articles without glossary enforcement remain unchanged unless manually re-translated
