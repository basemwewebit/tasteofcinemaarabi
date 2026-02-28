# API Contracts: Article Page Enhancement

**Feature**: 003-article-page-enhancement  
**Date**: 2026-02-28

---

## Modified Endpoints

### POST /api/scrape

Scrapes a tasteofcinema.com article URL. Returns title, content, author, and now also the featured image URL and extracted movie title strings.

**Request** (unchanged):

```json
{
  "url": "https://www.tasteofcinema.com/2024/10-great-crime-thriller-movies/"
}
```

**Response** (updated — two new fields in `data`):

```json
{
  "success": true,
  "data": {
    "title": "10 Great Crime Thriller Movies You Probably Haven't Seen",
    "content": "<p>Here is an introduction.</p>\n<h2>1. Back to the Wall (1958)</h2>\n...",
    "author": "Taste of Cinema",
    "url": "https://www.tasteofcinema.com/2024/10-great-crime-thriller-movies/",
    "featuredImage": "https://www.tasteofcinema.com/wp-content/uploads/2024/02/great-crime-thriller-movie.jpg",
    "movieTitles": [
      "Back to the Wall",
      "Headhunters",
      "A Prophet",
      "The Secret in Their Eyes",
      "Marshland",
      "Sleep Tight",
      "Guilty of Romance",
      "Memories of Murder",
      "Cure",
      "Joint Security Area"
    ]
  }
}
```

**New fields**:
| Field | Type | Description |
|-------|------|-------------|
| `data.featuredImage` | `string \| undefined` | Absolute URL to article thumbnail, extracted from `og:image` meta tag with fallback to first `<img>` in `.entry-content`. Empty/undefined if not found. |
| `data.movieTitles` | `string[] \| undefined` | Array of movie title strings extracted from numbered headings and inline emphasis in the source HTML. Empty array if none found. |

**Error response** (unchanged):

```json
{
  "success": false,
  "error": "Failed to scrape article"
}
```

---

### POST /api/translate

Translates scraped content into Arabic. Now accepts `movieTitles` to protect from translation via placeholder substitution.

**Request** (updated — one new field):

```json
{
  "url": "https://www.tasteofcinema.com/2024/10-great-crime-thriller-movies/",
  "title": "10 Great Crime Thriller Movies You Probably Haven't Seen",
  "content": "<p>Here is an introduction.</p>\n<h2>1. Back to the Wall (1958)</h2>\n...",
  "movieTitles": ["Back to the Wall", "Headhunters", "A Prophet"]
}
```

**New field**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `movieTitles` | `string[]` | No | Movie titles to protect from translation. If omitted, translation proceeds without title protection (backward-compatible). |

**Response** (unchanged structure — content now contains original-language movie titles):

```json
{
  "success": true,
  "data": {
    "articleId": 42,
    "slug": "10-great-crime-thriller-movies",
    "title_ar": "10 أفلام جريمة وإثارة رائعة ربما لم تشاهدها"
  }
}
```

The `title_ar` and stored MDX content will contain movie titles in their original language (e.g., `"Back to the Wall"` appears as-is in the Arabic text).

---

### POST /api/import-batch

Batch import pipeline. No change to request/response contract. Internal behavior changes: the pipeline now passes `featuredImage` and `movieTitles` from the scrape result through to the translate and save steps.

**Request** (unchanged):

```json
{
  "urls": [
    "https://www.tasteofcinema.com/2024/article-one/",
    "https://www.tasteofcinema.com/2024/article-two/"
  ]
}
```

**Response** (unchanged):

```json
{
  "success": true,
  "batchId": 5,
  "message": "Batch processing started"
}
```

**Internal change**: Each URL in the batch now goes through:
1. `scrapeArticle(url)` → returns `{ ..., featuredImage, movieTitles }`
2. `translateArticle({ ..., movieTitles })` → placeholder-protected translation
3. `saveArticleMetadata({ ..., featured_image: featuredImage })` → stores image URL

---

## Backward Compatibility

All changes are **additive**:
- `ScrapeResponse.data.featuredImage` is optional — existing consumers ignore it
- `ScrapeResponse.data.movieTitles` is optional — existing consumers ignore it
- `TranslateRequest.movieTitles` is optional — if omitted, translation works as before (no placeholder substitution)
- No fields removed from any existing type
- No request fields changed from required to optional or vice versa
