# Contracts: Movie Trailer Discovery & Embedding

**Branch**: `005-trailer-embed` | **Date**: 2026-02-28

---

## 1. Trailer API Contract

### `GET /api/articles/[id]/trailers`

Returns all trailers associated with an article.

**Request**: No body. Article ID in URL path.

**Response** (200):
```json
{
  "trailers": [
    {
      "id": 1,
      "article_id": 42,
      "platform": "youtube",
      "video_id": "dQw4w9WgXcQ",
      "movie_title": "Never Gonna Give You Up",
      "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "video_title": "Rick Astley - Never Gonna Give You Up (Official Video)",
      "duration": null,
      "source": "ai",
      "is_valid": 1,
      "created_at": "2026-02-28T12:00:00Z"
    }
  ]
}
```

**Response** (404):
```json
{ "error": "Article not found" }
```

---

### `POST /api/articles/[id]/trailers`

Add a trailer manually (admin pastes a URL).

**Request**:
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "movie_title": "Never Gonna Give You Up"
}
```

**Validation**:
- `url`: Required. Must be a valid YouTube or Vimeo video URL.
- `movie_title`: Required. Non-empty string.

**Processing**:
1. Extract `platform` and `video_id` from URL via regex
2. Validate via oEmbed (fetch thumbnail, video title)
3. UPSERT into `article_trailers` (source='manual')

**Response** (201):
```json
{
  "trailer": {
    "id": 2,
    "article_id": 42,
    "platform": "youtube",
    "video_id": "dQw4w9WgXcQ",
    "movie_title": "Never Gonna Give You Up",
    "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    "video_title": "Rick Astley - Never Gonna Give You Up (Official Video)",
    "source": "manual",
    "is_valid": 1
  }
}
```

**Response** (400):
```json
{ "error": "Invalid video URL or unsupported platform" }
```

**Response** (422):
```json
{ "error": "Video not found or not embeddable" }
```

---

### `DELETE /api/articles/[id]/trailers/[trailerId]`

Remove a trailer from an article.

**Response** (200):
```json
{ "ok": true }
```

**Response** (404):
```json
{ "error": "Trailer not found" }
```

---

## 2. oEmbed Validation Contract (External)

### YouTube oEmbed

**Endpoint**: `GET https://www.youtube.com/oembed?url={encoded_url}&format=json`

**Input URL format** (must normalize to one of these before calling):
- `https://www.youtube.com/watch?v={VIDEO_ID}`
- `https://youtu.be/{VIDEO_ID}`

**Success response** (200):
```json
{
  "title": "Video Title",
  "author_name": "Channel Name",
  "author_url": "https://www.youtube.com/@channel",
  "type": "video",
  "height": 113,
  "width": 200,
  "version": "1.0",
  "provider_name": "YouTube",
  "provider_url": "https://www.youtube.com/",
  "thumbnail_height": 360,
  "thumbnail_width": 480,
  "thumbnail_url": "https://i.ytimg.com/vi/{VIDEO_ID}/hqdefault.jpg",
  "html": "<iframe ...></iframe>"
}
```

**Error responses**:
- `400 Bad Request`: Video does not exist or is private
- `401 Unauthorized`: Video requires authentication
- `404 Not Found`: Unrecognized URL format

**Validation logic**: HTTP status 200 = valid and embeddable. Any other status = invalid.

### Vimeo oEmbed

**Endpoint**: `GET https://vimeo.com/api/oembed.json?url={encoded_url}`

**Input URL format**: `https://vimeo.com/{VIDEO_ID}`

**Success response** (200):
```json
{
  "type": "video",
  "version": "1.0",
  "provider_name": "Vimeo",
  "provider_url": "https://vimeo.com/",
  "title": "Video Title",
  "author_name": "Author",
  "author_url": "https://vimeo.com/author",
  "is_plus": "0",
  "account_type": "basic",
  "html": "<iframe ...></iframe>",
  "width": 1920,
  "height": 1080,
  "duration": 180,
  "description": "Video description",
  "thumbnail_url": "https://i.vimeocdn.com/video/{id}_1280x720.jpg",
  "thumbnail_width": 1280,
  "thumbnail_height": 720,
  "thumbnail_url_with_play_button": "https://...",
  "upload_date": "2024-01-01 12:00:00",
  "video_id": 123456789,
  "uri": "/videos/123456789"
}
```

**Error responses**:
- `404 Not Found`: Video does not exist
- `403 Forbidden`: Video exists but embedding is disabled

**Validation logic**: HTTP status 200 = valid and embeddable. 403 = exists but cannot embed. 404 = does not exist.

---

## 3. AI Translation Prompt Extension Contract

### Extended Response Schema

The existing translation prompt's JSON response is extended with a new `trailer_urls` field:

```json
{
  "title_ar": "عنوان المقال بالعربي",
  "title_en": "English Article Title",
  "excerpt_ar": "ملخص قصير...",
  "content_mdx": "...",
  "category": "category-slug",
  "tags": ["tag1", "tag2"],
  "slug": "url-slug",
  "trailer_urls": [
    {
      "movie_title": "The Shawshank Redemption",
      "url": "https://www.youtube.com/watch?v=6hB3S9bIaco"
    },
    {
      "movie_title": "Fight Club",
      "url": "https://www.youtube.com/watch?v=SUXWAEX2jlg"
    },
    {
      "movie_title": "Obscure Film Title",
      "url": null
    }
  ]
}
```

### Contract Rules

- `trailer_urls` is an array, one entry per movie title (up to 10)
- Each entry has `movie_title` (string, matching an extracted title) and `url` (string|null)
- `url` is `null` when the AI cannot confidently provide a trailer URL
- URLs MUST be full YouTube or Vimeo URLs (not just video IDs)
- All URLs are treated as **suggestions** and MUST be validated via oEmbed before storage
- If the AI omits `trailer_urls` entirely, the pipeline continues without trailers

---

## 4. MDX Component Contract

### Tag Format in MDX Content

```mdx
<TrailerEmbed videoId="dQw4w9WgXcQ" platform="youtube" title="The Shawshank Redemption" />
```

### Props Interface

```typescript
interface TrailerEmbedProps {
  videoId: string;       // Platform-specific video identifier
  platform: 'youtube' | 'vimeo';  // Video platform
  title: string;         // Movie title (displayed above player)
}
```

### Embed URLs Generated by Component

| Platform | Embed URL Pattern |
|----------|-------------------|
| YouTube | `https://www.youtube-nocookie.com/embed/{videoId}?rel=0&modestbranding=1` |
| Vimeo | `https://player.vimeo.com/video/{videoId}?dnt=1` |

### Thumbnail URLs Used by Facade

| Platform | Thumbnail URL Pattern |
|----------|----------------------|
| YouTube | `https://i.ytimg.com/vi/{videoId}/hqdefault.jpg` |
| Vimeo | Stored `thumbnail_url` from oEmbed (no predictable pattern) |

---

## 5. CSP Directive Contract

### Required Addition to `next.config.ts`

Current CSP (no frame-src):
```
default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ...
```

Required CSP:
```
default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ...; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com;
```

### Domains Whitelisted

| Domain | Purpose |
|--------|---------|
| `https://www.youtube.com` | YouTube standard embeds |
| `https://www.youtube-nocookie.com` | YouTube privacy-enhanced embeds (preferred) |
| `https://player.vimeo.com` | Vimeo embeds |

### Existing `img-src: https:` already covers:
- `https://i.ytimg.com` (YouTube thumbnails)
- `https://i.vimeocdn.com` (Vimeo thumbnails)
