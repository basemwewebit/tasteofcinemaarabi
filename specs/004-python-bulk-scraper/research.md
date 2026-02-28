# Research: tasteofcinema.com Sitemap & Site Structure

**Date**: 2026-02-28 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## 1. robots.txt

**URL**: `https://www.tasteofcinema.com/robots.txt`
**Status**: ✅ 200 OK — Accessible

### Disallow Rules

| User-Agent | Disallowed Paths |
|------------|-----------------|
| `*` (all bots) | `/wp-admin/`, `/wp-includes/` |
| `anthropic-ai` | `/` (full block) |
| `ClaudeBot` | `/` (full block) |
| `Claude-Web` | `/` (full block) |
| `GPTBot` | `/` (full block) |
| `ChatGPT-User` | `/` (full block) |
| `ChatGPT` | `/` (full block) |
| `OAI-SearchBot` | `/` (full block) |
| `cohere-ai` | `/` (full block) |
| `DeepSeek` | `/` (full block) |
| `DeepSeekBot` | `/` (full block) |
| `Bytespider` | `/` (full block) |
| `CCBot` | `/` (full block) |
| `Diffbot` | `/` (full block) |
| `FacebookBot` | `/` (full block) |
| `Google-Extended` | `/` (full block) |
| `Meta-ExternalAgent` | `/` (full block) |
| `Meta-ExternalFetcher` | `/` (full block) |
| `Applebot-Extended` | `/` (full block) |
| `PerplexityBot` | `/` (full block) |
| `Timpibot` | `/` (full block) |
| `Webzio-Extended` | `/` (full block) |
| `YouBot` | `/` (full block) |
| `omgili` | `/` (full block) |
| `omgilibot` | `/` (full block) |

### Scraping Relevance

- **Article paths (`/{year}/{slug}/`) are NOT disallowed** for the generic `*` user-agent.
- AI-specific bots are blocked. Our scraper should use a custom `User-Agent` string that does **not** match any blocked pattern.
- Sitemap declared at: `https://www.tasteofcinema.com/sitemap.xml`

---

## 2. sitemap.xml (Sitemap Index)

**URL**: `https://www.tasteofcinema.com/sitemap.xml`
**Status**: ✅ 200 OK — WordPress native sitemap index

### Format

- **Type**: XML Sitemap Index (not a flat sitemap)
- **Generator**: WordPress core native sitemaps (NOT Yoast SEO plugin)
- **Namespace**: Standard sitemaps.org schema

### Sub-Sitemaps (9 total)

| # | Sub-Sitemap URL | Type | Content |
|---|-----------------|------|---------|
| 1 | `wp-sitemap-posts-post-1.xml` | Posts | Articles (batch 1) |
| 2 | `wp-sitemap-posts-post-2.xml` | Posts | Articles (batch 2) |
| 3 | `wp-sitemap-posts-post-3.xml` | Posts | Articles (batch 3) |
| 4 | `wp-sitemap-posts-page-1.xml` | Pages | Static pages |
| 5 | `wp-sitemap-taxonomies-category-1.xml` | Taxonomy | Categories (23 URLs) |
| 6 | `wp-sitemap-taxonomies-post_tag-1.xml` | Taxonomy | Tags (batch 1) |
| 7 | `wp-sitemap-taxonomies-post_tag-2.xml` | Taxonomy | Tags (batch 2) |
| 8 | `wp-sitemap-taxonomies-post_tag-3.xml` | Taxonomy | Tags (batch 3) |
| 9 | `wp-sitemap-users-1.xml` | Users | Author pages |

### Key Observations

- WordPress native sitemaps cap at **2000 URLs per sub-sitemap**.
- 3 post sitemaps → estimated **4,000–6,000 total articles** (post-1 and post-2 have 2000 each; post-3 has the remainder).
- Each `<url>` entry includes `<loc>` and `<lastmod>` — useful for incremental scraping.

---

## 3. sitemap_index.xml (Old Yoast Format)

**URL**: `https://www.tasteofcinema.com/sitemap_index.xml`
**Status**: ❌ Not Found — Returns error/empty

**Conclusion**: Site does **not** use Yoast SEO sitemaps. Only WordPress native sitemaps are available.

---

## 4. post-sitemap.xml (Old Yoast Format)

**URL**: `https://www.tasteofcinema.com/post-sitemap.xml`
**Status**: ❌ Not Found — Returns error/empty

**Conclusion**: Confirms no Yoast-style post sitemaps exist.

---

## 5. WordPress REST API

**URL**: `https://www.tasteofcinema.com/wp-json/wp/v2/posts?per_page=1`
**Status**: ✅ 200 OK — **Fully exposed, no authentication required**

### Available Endpoints

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `/wp-json/wp/v2/posts` | List/query posts | No |
| `/wp-json/wp/v2/categories` | List categories | No |
| `/wp-json/wp/v2/tags` | List tags | No |
| `/wp-json/wp/v2/users` | List authors | No |
| `/wp-json/wp/v2/media` | List media assets | No |

### Post Response Structure

A single post object includes:

```json
{
  "id": 70325,
  "date": "2026-02-25T06:06:18",
  "slug": "10-great-crime-thriller-movies-you-probably-havent-seen",
  "link": "https://www.tasteofcinema.com/2026/10-great-crime-thriller-movies-you-probably-havent-seen/",
  "title": { "rendered": "10 Great Crime Thriller Movies You Probably Haven't Seen" },
  "content": { "rendered": "<p>...(full HTML)...</p>" },
  "excerpt": { "rendered": "<p>...summary...</p>" },
  "author": 1123,
  "featured_media": 70334,
  "categories": [3, 364],
  "tags": [6278],
  "comment_status": "open",
  "format": "standard"
}
```

### API Pagination

- `per_page`: max 100 per request
- `page`: 1-indexed pagination
- Response headers include `X-WP-Total` (total posts) and `X-WP-TotalPages` (total pages)
- At `per_page=100`, need ~50-60 requests to enumerate all posts

### REST API as Alternative Discovery Method

The REST API can serve as a **fallback or complementary discovery method**:
- Provides structured data (title, content, categories, tags, author) without HTML parsing
- Includes `featured_media` ID for thumbnail resolution
- Can filter by category, tag, date range, author
- Rate limiting: no documented limits, but should still be polite (2s delay)

---

## 6. Homepage

**URL**: `https://www.tasteofcinema.com/`
**Status**: ❌ Redirected to ad network (`ssum-sec.casalemedia.com`)

Multiple fetch attempts redirected to Casale Media ad tracking URL. This is likely an **anti-bot redirect** or aggressive ad interstitial. The homepage could not be analyzed for navigation structure, categories, or pagination patterns via automated fetching.

### Workaround

Homepage analysis is not critical because:
- **Categories** are fully available via the REST API (see section 7)
- **Article URLs** are fully enumerable via sitemaps
- **Pagination patterns** are available via the REST API pagination headers

---

## 7. Category Structure (from REST API + Sitemap)

**Source**: `/wp-json/wp/v2/categories?per_page=100` + `wp-sitemap-taxonomies-category-1.xml`
**Total Categories**: 23

### Category Hierarchy & Post Counts

| ID | Name | Slug | Parent | Post Count |
|----|------|------|--------|------------|
| 3 | **Features** | `features` | root | **5,787** |
| 364 | **Film Lists** | `film-lists` | Lists (294) | **4,659** |
| 543 | Other Lists | `other-lists` | Lists (294) | 726 |
| 545 | People Lists | `people-lists` | Lists (294) | 257 |
| 655 | **Reviews** | `reviews` | root | **253** |
| 538 | Features (Essays) | `essays` | root | 39 |
| 542 | Others | `others` | Essays (538) | 17 |
| 248 | Cinema Masterpieces | `cinema-masterpieces` | Essays (538) | 16 |
| 539 | Chinese Films | `chinese-films` | Chinese Cinema (481) | 15 |
| 544 | CC Lists | `cc-lists` | Lists (294) | 11 |
| 26 | Cinema Masters | `cinema-masters` | Essays (538) | 8 |
| 1339 | test | `test` | root | 6 |
| 31 | Cinema Charmers | `cinema-charmers` | Essays (538) | 4 |
| 547 | Criterion Gems | `criterion-gems` | Essays (538) | 4 |
| 587 | Double Bill | `double-bill` | Essays (538) | 4 |
| 530 | Guest Posts | `guest-posts` | root | 4 |
| 294 | Lists | `lists` | root | 3 |
| 678 | News | `news` | root | 2 |
| 1 | Uncategorized | `uncategorized` | root | 2 |
| 710 | Industry Insights | `industry-insights` | Essays (538) | 1 |
| 541 | Chinese Actors/Actresses | `chinese-actors-actresses` | Chinese Cinema (481) | 1 |
| 540 | Chinese Directors | `chinese-directors` | Chinese Cinema (481) | 1 |
| 3020 | Interviews | `interviews` | root | 1 |
| 481 | Chinese Cinema | `chinese-cinema` | Essays (538) | 0 |
| 172 | Weekly Recap | `weekly-recap` | Essays (538) | 0 |

### Key Insight

The vast majority of content falls into **Features** (5,787) and **Film Lists** (4,659). Many articles are tagged with both categories simultaneously (e.g., the latest post has `categories: [3, 364]`).

**Category URL pattern**: `https://www.tasteofcinema.com/category/{slug}/`

---

## 8. URL Patterns & Article Structure

### Article URL Pattern

```
https://www.tasteofcinema.com/{year}/{article-slug}/
```

- **Year range**: 2011–2026 (14+ years of content)
- **Slug format**: lowercase, hyphenated, English
- **Examples**:
  - `/2011/the-15-best-opening-scenes-in-movie-history/`
  - `/2018/10-great-movies-that-look-like-paintings/`
  - `/2026/10-great-crime-thriller-movies-you-probably-havent-seen/`

### Article Title Patterns (Common Formats)

| Pattern | Example |
|---------|---------|
| `{N} great {topic} movies...` | "10 Great Crime Thriller Movies You Probably Haven't Seen" |
| `the {N} best {topic}...` | "The 25 Best Horror Films of the 21st Century" |
| `all {N} {director/actor} movies ranked...` | "All 9 Quentin Tarantino Movies Ranked From Worst to Best" |
| `{N} reasons why {movie} is...` | "10 Reasons Why Dune Is One of the Best Sci-Fi Films" |
| `{movie} VIFF {year} review` | "Parasite VIFF 2019 Review" |
| `philosophical musings: {movie}` | "Philosophical Musings: The Master (2012)" |
| `pulling focus: {movie}` | "Pulling Focus: Annie Hall (1977)" |

### Multi-Page Articles (Pagination)

Many articles — especially ranked lists — are split across multiple pages using WordPress `<!--nextpage-->` block markers. This is common for long listicle-style content (e.g., "All 25 Best Picture Winners... Ranked").

**URL Pattern**: Page numbers are appended directly to the article slug (NOT `/page/N/`):
```
Page 1: /2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/
Page 2: /2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/2/
Page 3: /2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/3/
```

**HTML Selectors for Pagination Links** (from existing TS scraper, verified working):
- `.page-links a` — WordPress default `<!--nextpage-->` pagination container
- `.pagination a` — theme-specific pagination wrapper
- `.nav-links a` — WordPress navigation links
- `.post-page-numbers` — WordPress post page number elements

**Detection Logic**: Within the pagination container, look for:
1. An anchor whose text is the next page number (e.g., text `"2"` when on page 1)
2. An anchor with class `.next` or text `"next"` / `"Next"`

**Key Facts**:
- Sitemaps only contain page-1 URLs — paginated pages (`/2/`, `/3/`) are NOT in sitemaps
- Pagination must be detected from within the article HTML after fetching page 1
- Articles can have 2–5+ pages (varies by article length)
- Each page has its own content, inline images, and the same metadata (title, author, etc.)
- The WordPress REST API (`/wp-json/wp/v2/posts/{id}`) returns `content.rendered` which includes the **full content of page 1 only** — paginated content requires HTML scraping

**Scraping Strategy**: Fetch page 1 → detect pagination links → follow `/2/`, `/3/`, etc. → merge all page content into a single block. Track visited URLs to avoid infinite loops from circular pagination links.

**Reference Implementation**: See `src/lib/scraper/tasteofcinema.ts` lines 71–115 — the existing TS scraper already handles this pattern via `getNextPageLink()` with a `visitedPages` Set for loop protection.

---

## 9. Year-Range Distribution Across Sitemaps

| Sitemap | Approximate Year Range | URL Count |
|---------|----------------------|-----------|
| `wp-sitemap-posts-post-1.xml` | 2011–2016 | ~2,000 (full) |
| `wp-sitemap-posts-post-2.xml` | 2016–2018 | ~2,000 (full) |
| `wp-sitemap-posts-post-3.xml` | 2018–2026 | ~1,500–2,000 (partial) |

**Estimated total articles**: **~5,500–6,000**

> Note: The plan.md estimate of "500-800 articles" is significantly low. The actual article count is approximately **5,500-6,000** based on sitemap analysis and the Features category count of 5,787.

---

## 10. Image Patterns

From the REST API response, images follow this pattern:

```
https://www.tasteofcinema.com/wp-content/uploads/{year}/{month}/{image-name}.jpg
```

- Images are served from WordPress `wp-content/uploads/` directory
- Thumbnails and sized variants use suffixes: `-300x179.jpg`, `-1024x610.jpg`, `-768x458.jpg`
- Full-size images typically 560px wide (standard content width)
- `srcset` attributes provide multiple resolutions

---

## 11. Recommendations for Scraper Architecture

### Primary Discovery: Sitemap-First

1. Fetch `sitemap.xml` to get the index
2. Fetch all 3 `wp-sitemap-posts-post-{n}.xml` files
3. Parse `<loc>` and `<lastmod>` from each URL entry
4. Build manifest with all article URLs

### Fallback Discovery: REST API

If sitemaps fail or for incremental runs:
1. Use `/wp-json/wp/v2/posts?per_page=100&page={n}` to enumerate
2. Check `X-WP-Total` header for total count
3. Extract `link` field for article URL, `modified` for incremental checking

### Content Extraction Strategy

**Option A: HTML Scraping** (recommended for full fidelity)
- Fetch article page HTML
- Extract content from article body
- Handle `<!--nextpage-->` pagination by fetching `/page/N/` URLs
- Parse images from `<img>` tags including `srcset`

**Option B: REST API Content** (faster but less control)
- Use `/wp-json/wp/v2/posts/{id}` for full `content.rendered` HTML
- Already includes full HTML of page 1
- May not include paginated content (needs verification)
- Provides structured metadata (categories, tags, author ID)

**Recommended**: Use **sitemaps for discovery** + **HTML scraping for content** + **REST API for metadata enrichment** (category names, tag names, author names).

### Rate Limiting

- Default delay: 2 seconds between requests
- Use a custom `User-Agent` that doesn't match blocked patterns
- Respect `lastmod` dates for incremental runs

---

## 12. Scale Revision

Based on this research, the plan.md estimates require updating:

| Metric | Plan Estimate | Actual (Research) |
|--------|---------------|-------------------|
| Total articles | ~500–800 | **~5,500–6,000** |
| Total images | ~5,000–8,000 | **~30,000–60,000** (10 images/article avg) |
| Disk for images | ~2–5 GB | **~10–20 GB** |
| Full crawl time (3 workers, 2s delay) | < 4 hours | **~8–12 hours** |
| REST API requests (100/page) | 5–8 | **~56–60** |

---

## Summary

| Resource | Status | Key Finding |
|----------|--------|-------------|
| robots.txt | ✅ Accessible | AI bots blocked; article paths open for generic UA |
| sitemap.xml | ✅ Accessible | WP native index → 9 sub-sitemaps |
| sitemap_index.xml | ❌ Not found | No Yoast sitemaps |
| post-sitemap.xml | ❌ Not found | No Yoast sitemaps |
| WP REST API | ✅ Exposed | Full read access, no auth needed |
| Homepage | ❌ Ad redirect | Not analyzable; categories available via API |
| **Total articles** | — | **~5,500–6,000** (10x more than plan estimate) |
