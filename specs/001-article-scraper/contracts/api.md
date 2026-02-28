# API Contracts: Article Scraper & Premium UI Redesign

**Branch**: `001-article-scraper` | **Phase**: 1 | **Date**: 2026-02-28

All endpoints follow the existing project convention: Next.js App Router API routes at `src/app/api/`.
All responses use `Content-Type: application/json` and consistent error format: `{ "error": "message" }`.
All admin endpoints require an active admin session (existing `iron-session` middleware).

---

## POST /api/scrape

**Purpose**: Initiate a new scrape job for a tasteofcinema.com article URL.

**Auth**: Admin session required.

**Request Body**:
```json
{
  "url": "https://www.tasteofcinema.com/2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/"
}
```

**Validation**:
- `url` must be a non-empty string
- `url` must be a valid `https://` URL
- `url` hostname must be `tasteofcinema.com` or `www.tasteofcinema.com`

**Response — 202 Accepted** *(job created, running in background)*:
```json
{
  "jobId": 42,
  "status": "pending",
  "message": "Scrape job queued for https://www.tasteofcinema.com/..."
}
```

**Response — 400 Bad Request**:
```json
{
  "error": "Invalid URL. Only tasteofcinema.com articles are supported."
}
```

**Response — 401 Unauthorized**:
```json
{
  "error": "Authentication required."
}
```

**Behavior Notes**:
- Job runs asynchronously. Caller polls `/api/scrape/[jobId]` for status.
- Pipeline: scraping → processing-images → translating → completed.
- On completion, a new article (status: `draft`) is available in the admin panel.

---

## GET /api/scrape/[jobId]

**Purpose**: Poll the status of a specific scrape job.

**Auth**: Admin session required.

**Response — 200 OK**:
```json
{
  "id": 42,
  "targetUrl": "https://www.tasteofcinema.com/...",
  "status": "processing-images",
  "pagesFound": 3,
  "imagesFound": 28,
  "imagesSaved": 14,
  "articleId": null,
  "errorLog": [],
  "startedAt": "2026-02-28T07:45:00Z",
  "completedAt": null
}
```

**Response — 200 OK (completed)**:
```json
{
  "id": 42,
  "status": "completed",
  "pagesFound": 3,
  "imagesFound": 28,
  "imagesSaved": 27,
  "articleId": 17,
  "errorLog": ["Image download failed: https://example.com/img.jpg — 403 Forbidden"],
  "startedAt": "2026-02-28T07:45:00Z",
  "completedAt": "2026-02-28T07:46:12Z"
}
```

**Response — 404 Not Found**:
```json
{
  "error": "Scrape job not found."
}
```

---

## GET /api/scrape

**Purpose**: List recent scrape jobs (for admin panel job history display).

**Auth**: Admin session required.

**Query Params**: `?limit=20&offset=0`

**Response — 200 OK**:
```json
{
  "jobs": [
    {
      "id": 42,
      "targetUrl": "https://www.tasteofcinema.com/...",
      "status": "completed",
      "articleId": 17,
      "startedAt": "2026-02-28T07:45:00Z",
      "completedAt": "2026-02-28T07:46:12Z"
    }
  ],
  "total": 1
}
```

---

## GET /api/settings

**Purpose**: Read admin settings (including scrape delay).

**Auth**: Admin session required.

**Response — 200 OK**:
```json
{
  "scrape_delay_seconds": 2
}
```

---

## PATCH /api/settings

**Purpose**: Update one or more admin settings.

**Auth**: Admin session required.

**Request Body**:
```json
{
  "scrape_delay_seconds": 3
}
```

**Validation**:
- `scrape_delay_seconds` must be an integer between 0 and 30 (inclusive).

**Response — 200 OK**:
```json
{
  "updated": ["scrape_delay_seconds"]
}
```

**Response — 400 Bad Request**:
```json
{
  "error": "scrape_delay_seconds must be between 0 and 30."
}
```

---

## GET /api/articles (existing — documentation of current contract)

**Purpose**: List all published articles for the home page (site-facing).

**Auth**: None (public).

**Response — 200 OK**:
```json
{
  "articles": [
    {
      "id": 17,
      "slug": "25-best-picture-winners",
      "title_ar": "أفضل 25 فيلم فازوا بأوسكار أفضل فيلم...",
      "excerpt_ar": "...",
      "category": "قوائم أفلام",
      "featured_image": "/images/articles/25-best-picture-winners/00-thumbnail.webp",
      "published_at": "2026-02-28T08:00:00Z"
    }
  ]
}
```

> Note: `featured_image` path changes from external URL to local `/images/articles/...` path after this feature is implemented.
