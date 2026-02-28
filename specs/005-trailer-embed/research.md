# Research: Movie Trailer Discovery & Embedding

**Branch**: `005-trailer-embed` | **Date**: 2026-02-28 | **Plan**: [plan.md](plan.md)

---

## Research Task 1: YouTube oEmbed API for URL Validation

### Endpoint

```
GET https://www.youtube.com/oembed?url={VIDEO_URL}&format=json
```

### Parameters

| Parameter     | Required | Description                                      |
|---------------|----------|--------------------------------------------------|
| `url`         | Yes      | URL-encoded YouTube video URL                    |
| `format`      | No       | `json` or `xml`. If omitted, defaults to JSON    |
| `maxwidth`    | No       | Maximum width of the embed in pixels              |
| `maxheight`   | No       | Maximum height of the embed in pixels             |

### Accepted URL Formats (verified via live testing)

| URL Format                                         | oEmbed Status |
|----------------------------------------------------|:-------------:|
| `https://www.youtube.com/watch?v=VIDEO_ID`         | **200** ✅    |
| `https://youtu.be/VIDEO_ID`                        | **200** ✅    |
| `https://www.youtube.com/shorts/VIDEO_ID`          | **200** ✅    |
| `https://m.youtube.com/watch?v=VIDEO_ID`           | **200** ✅    |
| `https://www.youtube.com/embed/VIDEO_ID`           | **404** ❌    |
| `https://www.youtube-nocookie.com/embed/VIDEO_ID`  | **404** ❌    |
| `https://www.youtube.com/v/VIDEO_ID`               | **404** ❌    |

**Key finding**: YouTube's oEmbed endpoint does NOT accept embed-format URLs or youtube-nocookie.com URLs. Only `watch?v=`, `youtu.be/`, `shorts/`, and `m.youtube.com/watch?v=` are supported.

### Successful Response (HTTP 200)

```json
{
  "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
  "author_name": "Rick Astley",
  "author_url": "https://www.youtube.com/@RickAstleyYT",
  "type": "video",
  "height": 113,
  "width": 200,
  "version": "1.0",
  "provider_name": "YouTube",
  "provider_url": "https://www.youtube.com/",
  "thumbnail_height": 360,
  "thumbnail_width": 480,
  "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "html": "<iframe width=\"200\" height=\"113\" src=\"https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen title=\"...\"></iframe>"
}
```

### Fields We Need

| Field           | Our Use                                    |
|-----------------|--------------------------------------------|
| `title`         | Display below trailer embed                |
| `thumbnail_url` | Facade pattern — display before iframe load|
| `html`          | Extract embed `src` URL; not used directly |
| `type`          | Must be `"video"` for valid embeds         |
| `author_name`   | Optional: show channel name                |

### Error Responses (verified via live testing)

| Scenario                         | HTTP Status | Body           |
|----------------------------------|:-----------:|----------------|
| Valid format, nonexistent video  | **400**     | `Bad Request`  |
| Invalid/unrecognized URL scheme  | **404**     | `Not Found`    |
| Valid video, existing            | **200**     | JSON response  |
| Embedding disabled (rare)        | **401**     | `Unauthorized` |

**Important**: YouTube returns **400** (not 404) for a well-formed YouTube URL with a nonexistent video ID. Our validator must treat both 400 and 404 as "video not found."

### Rate Limits

YouTube's oEmbed endpoint has **no documented rate limits** — it is not part of the YouTube Data API v3 quota system. However:
- It is a public endpoint subject to Google's general abuse protections.
- Aggressive polling (hundreds of requests/second) may result in temporary IP blocks.
- For our use case (~1-10 trailers per article, 1-5 imports/day), rate limiting is a **non-issue**.
- Recommendation: Add a modest delay (200ms) between sequential oEmbed calls during batch validation.

### Thumbnail URL Structure

YouTube thumbnails follow a predictable pattern: `https://i.ytimg.com/vi/{VIDEO_ID}/{quality}.jpg`

| Quality        | URL Suffix          | Dimensions  |
|----------------|---------------------|-------------|
| Default        | `default.jpg`       | 120×90      |
| Medium         | `mqdefault.jpg`     | 320×180     |
| High           | `hqdefault.jpg`     | 480×360     |
| Standard       | `sddefault.jpg`     | 640×480     |
| Max Resolution | `maxresdefault.jpg` | 1280×720    |

The oEmbed response returns `hqdefault.jpg`. For our facade, we should use `maxresdefault.jpg` with `hqdefault.jpg` as fallback (not all videos have max-res thumbnails).

### Decision

**Use YouTube oEmbed for validation.** It confirms that a video ID exists, is publicly accessible, and returns the title + thumbnail in a single HTTP request. No API key needed.

**Rationale**: Simpler than YouTube Data API v3 (which requires an API key + quota). The oEmbed endpoint gives us everything we need: existence check, title, and thumbnail. The only limitation is that it doesn't directly tell us if embedding is disabled, but a 401 response indicates this.

**Alternative Rejected**: YouTube Data API v3 — requires API key provisioning, quota management, and OAuth complexity. Overkill for URL validation when oEmbed does the job.

---

## Research Task 2: Vimeo oEmbed API for URL Validation

### Endpoint

```
GET https://vimeo.com/api/oembed.json?url={VIDEO_URL}
```

### Parameters

| Parameter     | Required | Description                                      |
|---------------|----------|--------------------------------------------------|
| `url`         | Yes      | URL-encoded Vimeo video URL                      |
| `width`       | No       | Width of the embed in pixels                     |
| `height`      | No       | Height of the embed in pixels                    |
| `maxwidth`    | No       | Maximum width (won't exceed native)              |
| `maxheight`   | No       | Maximum height (won't exceed native)             |
| `responsive`  | No       | `true` for responsive embed code                 |
| `autoplay`    | No       | `true`/`false`                                   |
| `dnt`         | No       | `true` to disable tracking (privacy mode)        |

### Accepted URL Formats

| URL Format                                         | Description              |
|----------------------------------------------------|--------------------------|
| `https://vimeo.com/{video_id}`                     | Standard video URL       |
| `https://vimeo.com/album/{album_id}/video/{id}`    | Video in a showcase      |
| `https://vimeo.com/channels/{channel_id}/{id}`     | Video on a channel       |
| `https://vimeo.com/groups/{group_id}/videos/{id}`  | Video in a group         |
| `https://vimeo.com/ondemand/{name}/{id}`           | On Demand video          |
| `https://player.vimeo.com/video/{id}`              | Player embed URL         |

**Note**: For unlisted videos, the full URL (including the `h` hash parameter) must be provided.

### Successful Response (HTTP 200)

```json
{
  "type": "video",
  "version": "1.0",
  "provider_name": "Vimeo",
  "provider_url": "https://vimeo.com/",
  "title": "The New Vimeo Player (You Know, For Videos)",
  "author_name": "Vimeo",
  "author_url": "https://vimeo.com/staff",
  "is_plus": "0",
  "account_type": "enterprise",
  "html": "<iframe src=\"https://player.vimeo.com/video/76979871?app_id=122963\" width=\"480\" height=\"270\" frameborder=\"0\" allow=\"autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" title=\"...\"></iframe>",
  "width": 480,
  "height": 270,
  "duration": 62,
  "description": "It may look (mostly) the same on the surface...",
  "thumbnail_url": "https://i.vimeocdn.com/video/452001751-...-d_295x166?region=us",
  "thumbnail_width": 295,
  "thumbnail_height": 166,
  "thumbnail_url_with_play_button": "https://i.vimeocdn.com/filter/overlay?src0=...",
  "upload_date": "2013-10-15 14:08:29",
  "video_id": 76979871,
  "uri": "/videos/76979871"
}
```

### Vimeo-Specific Fields (vs YouTube)

| Field                           | Description                             |
|---------------------------------|-----------------------------------------|
| `duration`                      | Video length in seconds (YouTube lacks) |
| `description`                   | Full video description                  |
| `video_id`                      | Numeric Vimeo ID                        |
| `account_type`                  | Owner's membership tier                 |
| `thumbnail_url_with_play_button`| Thumbnail with overlay play icon        |

### Error Responses (verified via live testing)

| Scenario                              | HTTP Status | Description                                           |
|---------------------------------------|:-----------:|-------------------------------------------------------|
| Nonexistent video ID                  | **404**     | Not Found                                             |
| Embedding disabled by video owner     | **403**     | Forbidden — embed permissions disabled                |
| Privacy/permissions restricted        | **404**     | Not accessible due to privacy settings                |
| Video still transcoding               | **404**     | Not yet available                                     |
| Not modified since If-Modified-Since  | **304**     | Use cached version                                    |

**Key difference from YouTube**: Vimeo returns a clean 404 for missing videos (vs YouTube's 400).

### Rate Limits

Vimeo oEmbed **does not require authentication** and has no documented rate limits for the oEmbed endpoint specifically. Vimeo's API rate limiting (for their authenticated REST API) is separate. Similar to YouTube, reasonable usage won't trigger limits.

### Decision

**Use Vimeo oEmbed for validation**, same pattern as YouTube. The endpoint provides title, thumbnail, duration, and embed validation in a single request.

**Rationale**: No authentication needed. Returns richer data than YouTube's oEmbed (includes duration, description). Error codes are cleaner (404 = not found, 403 = no embed permission).

**Alternative Rejected**: Vimeo REST API — requires OAuth token, rate limit tracking, and additional dependency. Unnecessary for URL validation.

---

## Research Task 3: YouTube Video ID Extraction from URLs

### All Valid YouTube URL Formats

| # | Pattern                                          | Example                                               |
|---|--------------------------------------------------|-------------------------------------------------------|
| 1 | `youtube.com/watch?v=ID`                         | `https://www.youtube.com/watch?v=dQw4w9WgXcQ`        |
| 2 | `youtu.be/ID`                                    | `https://youtu.be/dQw4w9WgXcQ`                       |
| 3 | `youtube.com/embed/ID`                           | `https://www.youtube.com/embed/dQw4w9WgXcQ`          |
| 4 | `youtube.com/v/ID`                               | `https://www.youtube.com/v/dQw4w9WgXcQ`              |
| 5 | `youtube-nocookie.com/embed/ID`                  | `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ` |
| 6 | `m.youtube.com/watch?v=ID`                       | `https://m.youtube.com/watch?v=dQw4w9WgXcQ`          |
| 7 | `youtube.com/shorts/ID`                          | `https://www.youtube.com/shorts/dQw4w9WgXcQ`         |
| 8 | `youtube.com/live/ID`                            | `https://www.youtube.com/live/dQw4w9WgXcQ`           |
| 9 | `youtube.com/watch?v=ID&t=120` (with params)    | `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120`  |
| 10| `youtube.com/watch?feature=...&v=ID` (v not first)| `https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ` |

### Video ID Format

- Always **11 characters**
- Character set: `[A-Za-z0-9_-]` (Base64url alphabet)
- Examples: `dQw4w9WgXcQ`, `M7lc1UVf-VE`, `_OBlgSz8sSM`

### Comprehensive Regex Pattern

```typescript
const YOUTUBE_VIDEO_ID_REGEX = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&]|$)/;
```

**Breakdown:**
```
(?:
  youtube(?:-nocookie)?\.com\/   # youtube.com or youtube-nocookie.com
  (?:
    watch\?(?:.*&)?v=            # /watch?v= or /watch?feature=...&v=
    |embed\/                     # /embed/
    |v\/                         # /v/
    |shorts\/                    # /shorts/
    |live\/                      # /live/
  )
  |youtu\.be\/                   # youtu.be/
)
([A-Za-z0-9_-]{11})             # Capture group 1: 11-char video ID
(?:[?&#]|$)                      # Followed by query param, hash, or end of string
```

### Normalizing to oEmbed-Compatible URL

Since YouTube oEmbed only accepts `watch?v=` and `youtu.be/` formats (not `/embed/` or `/v/`), we should **normalize all extracted URLs** to `https://www.youtube.com/watch?v={VIDEO_ID}` before calling oEmbed.

```typescript
function normalizeYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
```

### Decision

**Extract video ID with comprehensive regex, then normalize to `watch?v=` format for oEmbed validation.**

**Rationale**: The regex handles all known URL formats including edge cases (Shorts, nocookie, mobile, `v` parameter at non-first position). Normalizing to `watch?v=` avoids the oEmbed 404 issue with `/embed/` URLs.

**Alternative Rejected**: Using URL parsing library (like the `URL` constructor) for each format — more code, same result, and the regex approach is battle-tested in production across the industry.

---

## Research Task 4: Vimeo Video ID Extraction

### All Valid Vimeo URL Formats

| # | Pattern                                     | Example                                                 |
|---|---------------------------------------------|---------------------------------------------------------|
| 1 | `vimeo.com/ID`                              | `https://vimeo.com/76979871`                            |
| 2 | `player.vimeo.com/video/ID`                 | `https://player.vimeo.com/video/76979871`               |
| 3 | `vimeo.com/album/AID/video/ID`              | `https://vimeo.com/album/123/video/76979871`            |
| 4 | `vimeo.com/channels/CID/ID`                 | `https://vimeo.com/channels/staffpicks/76979871`        |
| 5 | `vimeo.com/groups/GID/videos/ID`            | `https://vimeo.com/groups/cinema/videos/76979871`       |
| 6 | `vimeo.com/ondemand/NAME/ID`                | `https://vimeo.com/ondemand/myfilm/76979871`            |
| 7 | `vimeo.com/ID?h=HASH` (unlisted)            | `https://vimeo.com/76979871?h=fd61acd044`               |

### Video ID Format

- Purely **numeric** (digits only)
- Variable length (typically 6-10 digits, growing over time)
- Examples: `76979871`, `286898202`

### Comprehensive Regex Pattern

```typescript
const VIMEO_VIDEO_ID_REGEX = /(?:vimeo\.com\/(?:video\/|album\/\d+\/video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|ondemand\/[\w-]+\/)?|player\.vimeo\.com\/video\/)(\d+)/;
```

**Breakdown:**
```
(?:
  vimeo\.com\/                   # vimeo.com/
  (?:
    video\/                      # /video/ (rare direct format)
    |album\/\d+\/video\/         # /album/{id}/video/
    |channels\/[\w-]+\/          # /channels/{name}/
    |groups\/[\w-]+\/videos\/    # /groups/{name}/videos/
    |ondemand\/[\w-]+\/          # /ondemand/{name}/
  )?                             # All the above are optional (plain vimeo.com/ID)
  |player\.vimeo\.com\/video\/   # player.vimeo.com/video/
)
(\d+)                            # Capture group 1: numeric video ID
```

### Normalizing to oEmbed-Compatible URL

```typescript
function normalizeVimeoUrl(videoId: string): string {
  return `https://vimeo.com/${videoId}`;
}
```

### Decision

**Extract numeric ID with regex, normalize to `https://vimeo.com/{ID}` for oEmbed.**

**Rationale**: All Vimeo URL formats ultimately resolve to a numeric video ID. oEmbed accepts the simplest `vimeo.com/{id}` format for public videos. For unlisted videos, we'd need the full URL with `h` parameter — but AI-discovered trailers should only return public URLs.

---

## Research Task 5: next-mdx-remote Custom Components in RSC

### How It Works in the Existing Codebase

Current usage in `src/app/(site)/article/[slug]/page.tsx`:
```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
// ...
<MDXRemote source={fallbackMdx} />
```

No custom components are currently registered.

### Registering Custom Components

```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
import { TrailerEmbed } from '@/components/ui/TrailerEmbed';

// In the Server Component:
<MDXRemote 
  source={mdxContent} 
  components={{ 
    TrailerEmbed: TrailerEmbed,
    // ... more custom components
  }} 
/>
```

### Can Client Components Be Passed to Server Component MDXRemote?

**Yes, confirmed.** From the next-mdx-remote documentation:

> Client Components can be passed as custom components. The MDXRemote component (RSC) compiles MDX on the server and resolves component references. When a component is marked `"use client"`, it renders as a Client Component island within the Server Component tree.

This is exactly what we need: `TrailerEmbed` will be a Client Component (requires click handler + state for facade-to-iframe swap), but it's passed to the Server Component `MDXRemote` via the `components` prop.

### The `components` Prop Signature

```typescript
components?: Record<string, React.ComponentType<any>>
```

Each key maps an MDX tag name to a React component. When the MDX content contains `<TrailerEmbed videoId="abc" />`, MDXRemote resolves it to the `TrailerEmbed` component from the `components` prop.

### Recommended Wrapper Pattern

Create a reusable wrapper to centralize component registration:

```tsx
// src/components/mdx/ArticleMDX.tsx
import { MDXRemote, MDXRemoteProps } from 'next-mdx-remote/rsc';
import { TrailerEmbed } from '@/components/ui/TrailerEmbed';

const mdxComponents = {
  TrailerEmbed,
};

export function ArticleMDX(props: MDXRemoteProps) {
  return (
    <MDXRemote
      {...props}
      components={{ ...mdxComponents, ...(props.components || {}) }}
    />
  );
}
```

### MDX Tag Format in Article Content

```mdx
## Movie Section Title

Some text about the movie...

<TrailerEmbed videoId="dQw4w9WgXcQ" platform="youtube" title="Movie Title" />

## Next Movie Section
```

### Decision

**Use the `components` prop on `MDXRemote` to register `TrailerEmbed` as a Client Component. Create an `ArticleMDX` wrapper.**

**Rationale**: The pattern is officially supported and documented. Client Components as MDX custom components work correctly as component islands in the RSC tree. The wrapper pattern centralizes registration and makes it easy to add future components.

**Alternative Rejected**: Using `compileMDX` + manual `evaluate` from `@mdx-js/mdx` — more complex, no benefit for our use case since `MDXRemote` handles the compilation transparently.

---

## Research Task 6: AI Trailer URL Discovery via OpenRouter

### Current AI Integration

The codebase uses OpenRouter (OpenAI-compatible API) via the `openai` SDK:
- **Endpoint**: `https://openrouter.ai/api/v1`
- **Model**: `openai/gpt-4o` (configurable via `OPENROUTER_MODEL` env var)
- **Pattern**: JSON structured output with `response_format: { type: 'json_object' }`
- **Temperature**: `0.3` (low for consistency)
- **Retries**: 3 attempts with exponential backoff

### Prompt Strategy for Trailer Discovery

**Key Insight**: We should NOT ask the AI to return YouTube URLs directly. LLMs frequently hallucinate video IDs. Instead, use a two-stage approach:

#### Stage 1: Ask AI for Search-Friendly Movie Identifiers
```
For each movie title in this article, provide the exact official English movie title 
and release year. This will be used to find trailers.

Movie titles found in article: [list from existing pipeline]

Return JSON: { "movies": [{ "title": "...", "year": 2024 }] }
```

#### Stage 2: Construct Search URLs & Validate via oEmbed
Use the AI-provided titles to construct YouTube search-like queries, **then validate every URL via oEmbed** before storing.

### Why NOT to Ask AI for Video IDs Directly

| Approach                         | Hallucination Risk | Recommendation |
|----------------------------------|:------------------:|:--------------:|
| Ask for full YouTube URLs        | **Very High**      | ❌ DO NOT USE  |
| Ask for video IDs only           | **Very High**      | ❌ DO NOT USE  |
| Ask for movie title + year       | **Low**            | ✅ USE THIS    |

LLMs do not have a live index of YouTube. They may return:
- Plausible-looking but nonexistent video IDs
- Outdated URLs (video deleted/privated since training data)
- URLs for the wrong movie (similar titles)

### Revised Prompt Design

Since we already have movie titles from the scraper pipeline, the AI's role should be **enhanced title normalization**, not URL discovery. The actual URL discovery should be handled programmatically:

```typescript
// Extend the existing translation prompt to also return normalized movie titles
const trailerDiscoverySection = `
Additionally, for each movie mentioned in this article, provide:
- The exact official English title
- The release year
- Whether this is a well-known film (true/false)

Add this to your JSON response:
"movies_for_trailers": [
  { "original_mention": "The mentioned text", "official_title": "Official English Title", "year": 2024, "well_known": true }
]
`;
```

### Programmatic URL Discovery (Post-AI)

```typescript
// For each movie identified by AI:
// 1. Construct a YouTube search URL (not oEmbed — this is for searching)
//    OR directly try known common patterns:
//    "{Movie Title} ({Year}) Official Trailer"
// 2. Use YouTube oEmbed to validate any candidate URLs

// Option A: Direct video ID guessing is unreliable — DON'T DO THIS
// Option B: Use the AI to search its training data — that's what we'll do
```

### Practical Recommendation: Ask AI for URLs, But ALWAYS Validate

Despite hallucination risks, asking the AI for YouTube URLs is the most pragmatic approach **when combined with mandatory oEmbed validation**:

```
For each movie title, try to recall the YouTube URL for its official trailer.
Return the URL in the format: https://www.youtube.com/watch?v=VIDEO_ID

If you are not confident about the URL, set "confidence": "low".
If you cannot recall a trailer URL at all, set "url": null.

CRITICAL: These URLs will be validated. Do not guess or make up video IDs.
It is better to return null than to return an incorrect URL.
```

**Validation pipeline**:
1. AI returns candidate URLs (some may be hallucinated)
2. Extract video ID from each URL
3. Call YouTube oEmbed to validate
4. If oEmbed returns 200 + title contains a relevant keyword → **accept**
5. If oEmbed returns 400/404 → **discard** (hallucinated)
6. If oEmbed returns 200 but title is unrelated → **discard** (wrong video)

### Handling "No Trailer Found"

```json
{
  "movies_for_trailers": [
    { "title": "Citizen Kane", "year": 1941, "trailer_url": "https://www.youtube.com/watch?v=...", "confidence": "high" },
    { "title": "Some Obscure Film", "year": 1965, "trailer_url": null, "confidence": "none" }
  ]
}
```

Null URLs are silently skipped. No error, no retry. The admin can manually add trailers later.

### Decision

**Ask AI for trailer URLs in the translation prompt, but mandate oEmbed validation for every URL. Discard any URL that fails validation.**

**Rationale**: Two-stage approach (AI suggests, oEmbed validates) gives us the best balance of automation and reliability. The AI's training data includes many well-known trailer URLs, so a significant percentage will validate successfully. For those that don't, we fail gracefully.

**Alternative Considered**: YouTube Data API search — would be more reliable but requires an API key and quota management. Saved as a future enhancement if AI validation rates are too low.

**Alternative Rejected**: Asking AI only for movie titles + using a scraping approach to find trailers — adds latency and complexity with no clear reliability advantage.

---

## Research Task 7: YouTube Privacy-Enhanced Embed (youtube-nocookie.com)

### What Is It?

`youtube-nocookie.com` is YouTube's **privacy-enhanced mode** domain for embedded videos. When you use this domain instead of `youtube.com` for the iframe `src`:

```html
<!-- Standard embed -->
<iframe src="https://www.youtube.com/embed/VIDEO_ID"></iframe>

<!-- Privacy-enhanced embed -->
<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID"></iframe>
```

### How It Differs from Standard Embeds

| Aspect                    | `youtube.com`                           | `youtube-nocookie.com`                   |
|---------------------------|-----------------------------------------|------------------------------------------|
| Cookies set on page load  | Yes (tracking cookies)                  | **No** — only set if user clicks play    |
| GDPR compliance           | Requires cookie consent banner          | **Reduced consent requirements**         |
| Video functionality       | Full                                    | Full (identical playback)                |
| Player parameters         | All supported                           | All supported (same API)                 |
| Thumbnail loading         | Same                                    | Same                                     |
| oEmbed compatibility      | Yes (as source URL)                     | **No** (returns 404)                     |
| Embed URL format          | `youtube.com/embed/ID`                  | `youtube-nocookie.com/embed/ID`          |

### Privacy Compliance Recommendation

**Yes, use `youtube-nocookie.com` for all embeds.** Since our site targets Arabic-speaking audiences worldwide (including EU residents), privacy-enhanced mode reduces GDPR/cookie consent friction.

However, our facade pattern provides **even better privacy** than `youtube-nocookie.com`:
- With our facade, **no YouTube iframe is loaded at all** until the user clicks play
- This means zero YouTube cookies, zero YouTube tracking on page load
- The `youtube-nocookie.com` domain is a bonus defense-in-depth when the iframe does load

### CSP Configuration

Both domains must be whitelisted in `frame-src`:

```typescript
// next.config.ts CSP directive
"frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com;"
```

| Domain                            | Purpose                        |
|-----------------------------------|--------------------------------|
| `https://www.youtube.com`         | Standard YouTube embeds        |
| `https://www.youtube-nocookie.com`| Privacy-enhanced YouTube embeds|
| `https://player.vimeo.com`        | Vimeo player embeds            |

### Current CSP in the Codebase

```typescript
// next.config.ts (current — no frame-src)
value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:;",
```

**Required change**: Add `frame-src` directive. Without `frame-src`, the `default-src 'self'` will block all third-party iframes.

Also need to add to `img-src` for thumbnail loading:
- `https://i.ytimg.com` (YouTube thumbnails)
- `https://i.vimeocdn.com` (Vimeo thumbnails)

(Current `img-src` already includes `https:` so these are already covered.)

### Decision

**Use `youtube-nocookie.com` for embed iframe `src`, but validate URLs via oEmbed using standard `youtube.com/watch?v=` URLs. Whitelist both domains in CSP `frame-src`.**

**Rationale**: Privacy-enhanced mode + facade pattern = maximum privacy protection. Users see zero YouTube content/cookies until they explicitly click play, and even then, the nocookie domain minimizes tracking.

**Alternative Rejected**: Using standard `youtube.com` for embeds — works functionally but offers less privacy protection. No additional effort to use `youtube-nocookie.com`, so there's no reason not to.

---

## Cross-Cutting Decisions Summary

| # | Topic                  | Decision                                                                                    |
|---|------------------------|---------------------------------------------------------------------------------------------|
| 1 | YouTube validation     | oEmbed at `youtube.com/oembed`, normalize all URLs to `watch?v=` format                     |
| 2 | Vimeo validation       | oEmbed at `vimeo.com/api/oembed.json`, normalize to `vimeo.com/{id}`                        |
| 3 | YouTube ID extraction  | Single comprehensive regex covering all 10 URL formats, always extract 11-char ID           |
| 4 | Vimeo ID extraction    | Regex for all 7 URL formats, extract numeric ID                                             |
| 5 | MDX custom components  | `components` prop on `MDXRemote` with `ArticleMDX` wrapper; `TrailerEmbed` as Client Component |
| 6 | AI trailer discovery   | Ask AI for URLs in translation prompt + mandatory oEmbed validation; discard failures silently |
| 7 | Privacy-enhanced embed | Use `youtube-nocookie.com` for iframe `src`; CSP: `frame-src` for 3 domains                 |

## Implementation Implications

### Validation Flow

```
AI returns candidate URL
  → Extract video ID (regex)
  → Normalize to oEmbed-compatible URL
  → Call oEmbed endpoint
  → HTTP 200? → Check title relevance → Store in article_trailers
  → HTTP 400/403/404? → Discard, mark as "not found"
```

### CSP Changes Required

```diff
- "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:;"
+ "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com;"
```

### Embed URL Construction (at render time)

```typescript
function getEmbedUrl(platform: 'youtube' | 'vimeo', videoId: string): string {
  switch (platform) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${videoId}?dnt=1`;
  }
}
```

### Facade Thumbnail URL Construction

```typescript
function getThumbnailUrl(platform: 'youtube' | 'vimeo', videoId: string, oembedData?: OEmbedResponse): string {
  switch (platform) {
    case 'youtube':
      // Use maxres with hqdefault fallback
      return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    case 'vimeo':
      // Must use oEmbed-provided thumbnail URL (no predictable pattern)
      return oembedData?.thumbnail_url || '';
  }
}
```
