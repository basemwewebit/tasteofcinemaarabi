# Implementation Plan: Article Page Enhancement

**Branch**: `003-article-page-enhancement` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-article-page-enhancement/spec.md`

## Summary

Enhance the article page with three independently deliverable slices: (1) display the `featured_image` from the database as a responsive hero thumbnail in the article header, with the scraper updated to extract it from the source page; (2) improve CSS and layout for modern Arabic-first reading comfort — typography, spacing, visual hierarchy; (3) modify the scraping-and-translation pipeline so that movie titles are detected, extracted from structured HTML markup, and protected from translation via placeholder substitution in the AI prompt.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) on Node.js
**Primary Dependencies**: Next.js 15.5 (App Router, Server Components), React 19, cheerio 1.2, openai SDK 6.25 (via OpenRouter), next-mdx-remote 6, better-sqlite3
**Storage**: SQLite via better-sqlite3; file-based MDX content under `content/`
**Testing**: Vitest 4 with jsdom environment
**Target Platform**: Web (SSR via Next.js, deployed as Node.js server)
**Project Type**: Web application (Arabic editorial CMS)
**Performance Goals**: Lighthouse Performance ≥ 90, Core Web Vitals "Good" thresholds (per constitution)
**Constraints**: Images must be optimized (responsive, lazy-loaded); JavaScript minimized (Server Components by default); RTL first
**Scale/Scope**: Single-site editorial platform; ~100s of articles; single admin user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Arabic-First, Cinema-Native | ✅ PASS | Article page is already RTL. Design enhancements maintain Arabic-first typography. |
| II | Source Integrity | ✅ PASS | Source attribution box preserved unchanged. Featured image from source site displayed alongside existing source link. |
| III | Cinematic Editorial Identity | ✅ PASS | Design changes use existing Noir & Orange tokens. No new colors introduced. Thumbnail hero image adds cinematic visual richness. |
| IV | Content Quality Over Quantity | ⚠️ DEVIATION | Constitution says "Film names MUST preserve the original English title alongside Arabic transliteration." User requirement says movie titles must NOT be translated or transliterated — keep original language only. See Complexity Tracking for justification. |
| V | Performance is Respect | ✅ PASS | Thumbnail uses Next.js Image with `priority` (LCP preload), responsive `sizes`, and `fill` mode. No layout shift (fixed aspect-ratio container). |
| VI | Monetization Without Compromise | ✅ PASS | Ad slots remain in existing positions. No new ad placements. |
| VII | Accessibility | ✅ PASS | Thumbnail has Arabic alt text: `"صورة غلاف مقال: {title_ar}"`. Design maintains ≥ 4.5:1 contrast. Keyboard nav unchanged. |
| — | Content Ethics | ✅ PASS | Scraping remains rate-limited, respectful. Movie title extraction uses existing content structure. |
| — | Development Standards | ✅ PASS | TypeScript strict, CSS Modules, Server Components by default. One new Client Component (`ArticleThumbnail`) justified: `onError` requires DOM events for broken-image handling (FR-003). Vitest tests for scraper and translation. |

## Project Structure

### Documentation (this feature)

```text
specs/003-article-page-enhancement/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md           # Updated ScrapeResponse contract with featured_image + movieTitles
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (site)/article/[slug]/
│   │   ├── page.tsx              # MODIFY: add thumbnail image render
│   │   └── article.module.css    # MODIFY: enhanced design + thumbnail styles
│   └── api/
│       ├── scrape/route.ts       # MODIFY: pass through featured_image from scraper
│       ├── translate/route.ts    # MODIFY: accept movieTitles, update prompt
│       └── import-batch/route.ts # MODIFY: pass movieTitles through pipeline
├── lib/
│   ├── scraper/
│   │   └── tasteofcinema.ts      # MODIFY: extract featured_image + movie titles
│   └── ai/
│       └── translate.ts          # MODIFY: placeholder-based title protection
├── types/
│   ├── api.ts                    # MODIFY: update ScrapeResponse, TranslateRequest
│   └── article.ts                # NO CHANGE (featured_image already exists)
└── styles/
    └── tokens.css                # NO CHANGE (existing tokens sufficient)

tests/
└── lib/
    ├── scraper.test.ts           # MODIFY: test featured_image + movie title extraction
    └── ai/
        └── translate.test.ts     # MODIFY: test title protection in translation
```

**Structure Decision**: Existing Next.js App Router structure maintained. All changes modify existing files. No new directories or modules needed.

## Complexity Tracking

> Constitution Principle IV deviation justification:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle IV: Film titles NOT transliterated (kept in original language only, no Arabic transliteration) | User explicitly requires: "keep name movies on original lang and not translate." Cinema-literate Arabic audiences search for films by international titles (e.g., "Taxi Driver", not "تاكسي درايفر"). Transliteration creates unsearchable, ambiguous content. | Constitution's "transliterate + preserve original in parentheses" approach creates visual noise in list-format articles with 10-25 titles, and Arabic transliterations of film titles are non-standard and vary by region. Recommend a constitution amendment (Principle IV) to align with this decision. |
