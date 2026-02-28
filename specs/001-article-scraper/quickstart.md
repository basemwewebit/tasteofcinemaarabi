# Quick Start: Article Scraper Feature

**Branch**: `001-article-scraper`

## Prerequisites

```bash
# Ensure you're on the correct branch
git checkout 001-article-scraper

# Install new dependency
npm install sharp

# Verify dev server works
npm run dev
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/lib/scraper/tasteofcinema.ts` | Existing scraper — extend for image extraction |
| `src/lib/scraper/imageProcessor.ts` | **NEW** — download + WEBP conversion pipeline |
| `src/lib/scraper/pipeline.ts` | **NEW** — orchestrates scrape → images → translate |
| `src/lib/db/index.ts` | Add migrations for `settings` and `scrape_jobs` tables |
| `src/lib/db/settings.ts` | **NEW** — settings CRUD |
| `src/lib/db/scrapeJobs.ts` | **NEW** — scrape job lifecycle management |
| `src/app/api/scrape/route.ts` | **NEW** — POST to start a job |
| `src/app/api/scrape/[jobId]/route.ts` | **NEW** — GET job status |
| `src/app/api/settings/route.ts` | **NEW** — GET/PATCH admin settings |
| `src/app/(site)/page.tsx` | Landing page — add thumbnail images to cards |
| `src/app/(site)/page.module.css` | Landing page styles — editorial masonry grid |
| `src/app/(site)/article/[slug]/page.tsx` | Article page — hero image + body polish |
| `src/app/(site)/article/[slug]/article.module.css` | Article page styles |

## Running the Scraper (Once API is Built)

In the admin panel, navigate to **Import → New Article** and paste a tasteofcinema.com URL.
Monitor progress in the Jobs tab. When `status: completed`, the article appears in the articles list as a `draft`.

## Image Files Location

```bash
ls public/images/articles/{article-slug}/
# 00-thumbnail.webp     ← featured image (used on home page cards)
# 01-first-image.webp
# 02-second-image.webp
# ...
```

## Testing

```bash
# Unit tests
npx vitest run tests/unit/scraper

# Integration test (requires internet)
npx vitest run tests/integration/scraper
```
