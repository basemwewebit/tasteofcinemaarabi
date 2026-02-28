# tasteofcinemaarabi Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-28

## Active Technologies
- Python 3.10+ (Scrapling minimum) + Scrapling (Spider + Fetcher), argparse (CLI), lxml (sitemap XML parsing — included via Scrapling) (004-python-bulk-scraper)
- Local filesystem — JSON files (`scraped/articles/`), images (`scraped/images/`), manifest (`scraped/manifest.json`) (004-python-bulk-scraper)

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
- 004-python-bulk-scraper: Added Python 3.10+ (Scrapling minimum) + Scrapling (Spider + Fetcher), argparse (CLI), lxml (sitemap XML parsing — included via Scrapling)

- 003-article-page-enhancement: Added TypeScript 5.x (strict mode) on Node.js + Next.js 15.5 (App Router, Server Components), React 19, cheerio 1.2, openai SDK 6.25 (via OpenRouter), next-mdx-remote 6, better-sqlite3

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
