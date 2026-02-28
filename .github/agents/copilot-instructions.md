# tasteofcinemaarabi Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-28

## Active Technologies
- Python 3.10+ (Scrapling minimum) + Scrapling (Spider + Fetcher), argparse (CLI), lxml (sitemap XML parsing — included via Scrapling) (004-python-bulk-scraper)
- Local filesystem — JSON files (`scraped/articles/`), images (`scraped/images/`), manifest (`scraped/manifest.json`) (004-python-bulk-scraper)
- TypeScript 5.x (strict mode), Next.js 15.5 (App Router, Turbopack) + next-mdx-remote 6.x (RSC), better-sqlite3, openai SDK 6.x (OpenRouter), cheerio, lucide-react (005-trailer-embed)
- SQLite via better-sqlite3 (existing); new `article_trailers` table + MDX files on disk (005-trailer-embed)
- TypeScript 5.9 (Node 20, Next.js 15.5) for DB commands; Python 3.12 (Pydantic) for scraper + better-sqlite3 (DB), argparse + lxml + Pydantic (scraper) (006-db-deploy-scraper-filters)
- SQLite (`data/cinema.db`) with schema in `data/schema.sql` (006-db-deploy-scraper-filters)
- TypeScript 5 / Node.js (no pinned version) / Next.js 15.5 + React 19 + `openai` ^6.25 (pointed at OpenRouter), `better-sqlite3` ^12.6, `cheerio` ^1.2, `sharp` ^0.34 (007-certified-translation-quality)
- SQLite via `better-sqlite3` (raw SQL, no ORM) + filesystem (MDX content, JSON glossary) (007-certified-translation-quality)

- TypeScript 5.x (strict mode) on Node.js + Next.js 15.5 (App Router, Server Components), React 19, cheerio 1.2, openai SDK 6.25 (via OpenRouter), next-mdx-remote 6, better-sqlite3 (003-article-page-enhancement)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (strict mode) on Node.js: Follow standard conventions

## Recent Changes
- 007-certified-translation-quality: Added TypeScript 5 / Node.js (no pinned version) / Next.js 15.5 + React 19 + `openai` ^6.25 (pointed at OpenRouter), `better-sqlite3` ^12.6, `cheerio` ^1.2, `sharp` ^0.34
- 006-db-deploy-scraper-filters: Added TypeScript 5.9 (Node 20, Next.js 15.5) for DB commands; Python 3.12 (Pydantic) for scraper + better-sqlite3 (DB), argparse + lxml + Pydantic (scraper)
- 006-db-deploy-scraper-filters: Added TypeScript 5.9 (Node 20, Next.js 15.5) for DB commands; Python 3.12 (Pydantic) for scraper + better-sqlite3 (DB), argparse + lxml + Pydantic (scraper)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
