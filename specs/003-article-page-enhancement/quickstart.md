# Quickstart: Article Page Enhancement

**Feature**: 003-article-page-enhancement  
**Branch**: `003-article-page-enhancement`

---

## Prerequisites

- Node.js 18+
- pnpm or npm
- Repository cloned and on the `003-article-page-enhancement` branch

```bash
git checkout 003-article-page-enhancement
npm install
```

---

## Development Setup

```bash
# Start the dev server
npm run dev

# Run tests
npx vitest run

# Run tests in watch mode
npx vitest
```

---

## What This Feature Changes

### 1. Article Page Thumbnail (P1)

**Files modified**:
- `next.config.ts` — add `images.remotePatterns` for tasteofcinema.com
- `src/app/(site)/article/[slug]/page.tsx` — render `<ArticleThumbnail>` in header
- `src/app/(site)/article/[slug]/article.module.css` — thumbnail + design styles
- `src/components/ui/ArticleThumbnail.tsx` — NEW Client Component for image with error handling

**How to verify**:
1. Start dev server: `npm run dev`
2. Navigate to an article page that has a `featured_image` value in the database
3. Confirm the thumbnail image renders at the top of the article
4. Test an article without `featured_image` — confirm no broken image or empty space

### 2. Design Enhancement (P2)

**Files modified**:
- `src/app/(site)/article/[slug]/article.module.css` — improved spacing, typography, visual hierarchy

**How to verify**:
1. Open any article page on desktop (1280px) and mobile (375px)
2. Compare against the existing design — headings, spacing, and source box should look more polished
3. No horizontal scrolling on mobile

### 3. Movie Title Preservation (P3)

**Files modified**:
- `src/lib/scraper/tasteofcinema.ts` — extract `featuredImage` + `movieTitles` from HTML
- `src/lib/ai/translate.ts` — placeholder substitution for title protection
- `src/types/api.ts` — updated `ScrapeResponse` and `TranslateRequest` types
- `src/app/api/scrape/route.ts` — pass through new fields
- `src/app/api/translate/route.ts` — pass `movieTitles` to translate function
- `src/app/api/import-batch/route.ts` — pass `movieTitles` + `featuredImage` through pipeline

**How to verify**:
1. Run the scraper test: `npx vitest run tests/lib/scraper.test.ts`
2. Run the translation test: `npx vitest run tests/lib/ai/translate.test.ts`
3. Manual test: scrape a tasteofcinema.com listicle URL via the admin import page and inspect the translated MDX output — movie titles should appear in their original language

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `next/image` with `fill` + `aspect-ratio: 16/9` | Consistent container regardless of source image dimensions |
| Client Component for thumbnail | `onError` handler needs DOM events (not available in Server Components) |
| Placeholder substitution (`[[TITLE_N]]`) | Zero-trust approach — AI never sees title text, cannot translate it |
| Movie titles sorted by length descending | Prevents partial matches (e.g., "The Godfather" inside "The Godfather Part II") |
| Constitution Principle IV deviation | User explicitly requires original-language titles only, no transliteration |

---

## Testing Strategy

| Test | File | Scope |
|------|------|-------|
| Featured image extraction | `tests/lib/scraper.test.ts` | Extracts `og:image`, falls back to first `.entry-content img` |
| Movie title extraction | `tests/lib/scraper.test.ts` | Extracts numbered heading titles and inline emphasis titles |
| Placeholder insertion | `tests/lib/ai/translate.test.ts` | Titles replaced with `[[TITLE_N]]` tokens correctly |
| Placeholder restoration | `tests/lib/ai/translate.test.ts` | Tokens restored to original titles after translation |
| Article page rendering | Manual | Thumbnail displays, design is polished, no broken images |
