# Quickstart: Movie Trailer Discovery & Embedding

**Branch**: `005-trailer-embed` | **Date**: 2026-02-28

## Prerequisites

- Node.js 18+ (existing project requirement)
- SQLite database initialized via `data/schema.sql`
- OpenRouter API key configured in `.env.local` as `OPENROUTER_API_KEY`
- Internet access for oEmbed validation calls (YouTube/Vimeo)

## Setup

```bash
# 1. Switch to feature branch
git checkout 005-trailer-embed

# 2. Install dependencies (no new packages required)
npm install

# 3. Apply database migration (add article_trailers table)
# Run the new migration SQL against your development database:
npx tsx scripts/setup-db.ts
# OR manually:
# sqlite3 data/cinema.db < data/migrations/005-article-trailers.sql

# 4. Start development server
npm run dev
```

## Verify Setup

1. **Database**: Confirm `article_trailers` table exists:
   ```bash
   sqlite3 data/cinema.db ".tables" | grep article_trailers
   ```

2. **CSP**: Open browser DevTools → Console. Import an article or view one with a `<TrailerEmbed>` tag. No CSP errors should appear for YouTube/Vimeo iframes.

3. **Component**: Add a test trailer embed to any MDX file:
   ```mdx
   <TrailerEmbed videoId="dQw4w9WgXcQ" platform="youtube" title="Test Movie" />
   ```
   View the article page. The trailer facade should render with a thumbnail and play button.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/trailers/validate.ts` | oEmbed URL validation for YouTube/Vimeo |
| `src/lib/trailers/insert.ts` | Auto-insert `<TrailerEmbed>` tags into MDX |
| `src/lib/db/trailers.ts` | SQLite CRUD for `article_trailers` table |
| `src/lib/ai/translate.ts` | Extended translation prompt with trailer URLs |
| `src/lib/scraper/pipeline.ts` | Pipeline with trailer discovery stage |
| `src/components/ui/TrailerEmbed.tsx` | Cinema-themed video facade component |
| `src/app/api/articles/[id]/trailers/route.ts` | Trailer management API |

## Running Tests

```bash
# Run all tests
npx vitest

# Run trailer-specific tests
npx vitest --reporter=verbose tests/lib/trailers/
npx vitest --reporter=verbose tests/lib/ai/translate-trailers.test.ts
```

## Testing the Full Pipeline

1. Navigate to `/admin/import`
2. Paste a Taste of Cinema article URL (one with named movies)
3. Click Import
4. Watch the scrape job status progress through: `pending` → `scraping` → `processing-images` → `translating` → `discovering-trailers` → `completed`
5. Navigate to `/admin/articles` → find the new article → Edit
6. Verify:
   - Trailer sidebar shows discovered trailers with thumbnails
   - MDX content contains `<TrailerEmbed>` tags
   - Preview the article to see rendered facades

## Manual Trailer Management

1. In the article editor, find the "Trailers" sidebar section
2. To add: paste a YouTube or Vimeo URL → click "Add Trailer" → enter movie title
3. To remove: click the delete icon on any trailer in the list
4. To insert into content: click the copy/insert button next to any trailer → paste into MDX textarea at desired position

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CSP blocks iframe | Check `next.config.ts` has `frame-src` with YouTube/Vimeo domains |
| oEmbed validation fails for all URLs | Check internet access; YouTube/Vimeo oEmbed endpoints may be rate-limited (unlikely at dev scale) |
| AI returns no `trailer_urls` | Check OpenRouter model supports structured JSON; verify prompt includes trailer URL instructions |
| Trailer facade shows no thumbnail | Verify `thumbnail_url` in `article_trailers` table; YouTube thumbnails use `i.ytimg.com` |
| `<TrailerEmbed>` renders as raw text | Verify `components` prop is passed to `<MDXRemote>` in article page |
