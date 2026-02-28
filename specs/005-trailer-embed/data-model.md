# Data Model: Movie Trailer Discovery & Embedding

**Branch**: `005-trailer-embed` | **Date**: 2026-02-28 | **Plan**: [plan.md](plan.md)

## Entity: article_trailers

Stores validated trailer metadata discovered via AI or manually added by admin. Each row links a single video to an article.

### Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS article_trailers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK(platform IN ('youtube', 'vimeo')),
    video_id TEXT NOT NULL,
    movie_title TEXT NOT NULL,
    thumbnail_url TEXT,
    video_title TEXT,
    duration INTEGER,
    source TEXT DEFAULT 'ai' CHECK(source IN ('ai', 'manual')),
    is_valid INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, platform, video_id)
);

CREATE INDEX IF NOT EXISTS idx_trailers_article ON article_trailers(article_id);
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | Auto | Primary key |
| `article_id` | INTEGER | Yes | Foreign key to `articles.id`. CASCADE on delete. |
| `platform` | TEXT | Yes | Video platform: `'youtube'` or `'vimeo'` |
| `video_id` | TEXT | Yes | Platform-specific video identifier (YouTube: 11-char alphanumeric; Vimeo: numeric) |
| `movie_title` | TEXT | Yes | The movie title this trailer belongs to (English, as extracted from article) |
| `thumbnail_url` | TEXT | No | URL to video thumbnail (from oEmbed response). YouTube: `https://i.ytimg.com/vi/{id}/hqdefault.jpg`. Vimeo: from oEmbed `thumbnail_url`. |
| `video_title` | TEXT | No | Title of the video as returned by oEmbed (for display/debugging) |
| `duration` | INTEGER | No | Video duration in seconds (Vimeo oEmbed provides this; YouTube does not via oEmbed) |
| `source` | TEXT | Yes | How the trailer was discovered: `'ai'` (via OpenRouter translation) or `'manual'` (admin pasted URL) |
| `is_valid` | INTEGER | Yes | Whether the video was validated as embeddable via oEmbed. Default: 1. Set to 0 if re-validation fails later. |
| `created_at` | DATETIME | Auto | Timestamp of creation |

### Uniqueness Constraint

`UNIQUE(article_id, platform, video_id)` — prevents duplicate trailers per article. If an admin manually adds a trailer that was already AI-discovered, it replaces the existing row (UPSERT).

### Relationships

```
articles 1 ──── * article_trailers
   │                    │
   │ id ←──── article_id │
```

- **articles** → **article_trailers**: One-to-many. An article can have 0–N trailers.
- Deletion cascades: when an article is deleted, all its trailers are removed.

## Entity: Article (existing — extended)

No schema changes to the `articles` table. Trailers are accessed via JOIN on `article_trailers.article_id`.

The article's trailers are loaded lazily in the editor and on the API response.

## Entity: TrailerEmbed (MDX Component — not a DB entity)

Represents a trailer embed tag in MDX content. Not stored in the database; exists only in the `.mdx` file and rendered at view time.

### MDX Tag Format

```mdx
<TrailerEmbed videoId="dQw4w9WgXcQ" platform="youtube" title="Never Gonna Give You Up" />
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `videoId` | string | Yes | Platform-specific video ID |
| `platform` | `'youtube' \| 'vimeo'` | Yes | Video platform |
| `title` | string | Yes | Movie title (displayed above the player) |

### Rendering Behavior

1. **Facade state** (default): Shows thumbnail image + movie title + play button overlay
2. **Playing state** (after click): Replaces thumbnail with platform iframe (`youtube-nocookie.com` or `player.vimeo.com`)
3. **Error state**: If iframe fails to load, shows Arabic fallback message

## State Transitions

### Trailer Discovery Flow

```
[Article imported] 
    → AI translation prompt includes trailer URL request
    → AI returns JSON with trailer_urls array
    → For each URL:
        → Extract video ID + platform via regex
        → Validate via oEmbed (YouTube/Vimeo)
        → If valid: INSERT into article_trailers (source='ai')
        → If invalid: discard silently
    → Auto-insert <TrailerEmbed> tags into MDX content
    → Save MDX file
```

### Trailer States

| State | `is_valid` | Description |
|-------|-----------|-------------|
| Discovered (valid) | 1 | AI-suggested, oEmbed validated |
| Discovered (invalid) | — | AI-suggested, oEmbed failed → not stored |
| Manual (valid) | 1 | Admin-pasted URL, oEmbed validated |
| Stale | 0 | Previously valid, re-validation failed (video removed) |

## Validation Rules

- `platform` must be exactly `'youtube'` or `'vimeo'`
- `video_id` for YouTube: 11 characters, `[A-Za-z0-9_-]`
- `video_id` for Vimeo: numeric only, 1+ digits
- `movie_title` must be non-empty string
- `article_id` must reference an existing article
- `thumbnail_url` must be a valid HTTPS URL if present
- Maximum 10 AI-discovered trailers per article (enforced at pipeline level, not DB level)
