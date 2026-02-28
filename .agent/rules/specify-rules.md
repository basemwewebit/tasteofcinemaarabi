# tasteofcinemaarabi Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-28

## Active Technologies
- TypeScript 5, Node.js 20+ + Next.js 15.5 (App Router), React 19, `iron-session` v8, `bcryptjs`, `openai` (existing) (002-admin-auth-openrouter)
- SQLite via `better-sqlite3` (articles only, no auth tables needed — iron-session uses cookies) (002-admin-auth-openrouter)
- TypeScript (Next.js Application) & Python 3.x (Agent Scripts) + Next.js App Router (React), Database (SQLite assumed), DOMPurify (for XSS fix) (001-fix-security-scan)
- SQLite (`tasteofcinema.db` detected) (001-fix-security-scan)

- TypeScript (strict) + Next.js 15 (App Router), `better-sqlite3`, `cheerio`, `openai`, `next-mdx-remote`, `fuse.js`, `lucide-react` (001-cinema-cms)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript (strict): Follow standard conventions

## Recent Changes
- 001-fix-security-scan: Added TypeScript (Next.js Application) & Python 3.x (Agent Scripts) + Next.js App Router (React), Database (SQLite assumed), DOMPurify (for XSS fix)
- 001-article-scraper: Added [if applicable, e.g., PostgreSQL, CoreData, files or N/A]
- 002-admin-auth-openrouter: Added TypeScript 5, Node.js 20+ + Next.js 15.5 (App Router), React 19, `iron-session` v8, `bcryptjs`, `openai` (existing)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
