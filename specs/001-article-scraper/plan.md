# Implementation Plan: Article Scraper & Premium UI Redesign

**Branch**: `001-article-scraper` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-article-scraper/spec.md`

---

## Summary

Build a multi-page article scraper for tasteofcinema.com that handles pagination, downloads and converts images to WEBP at quality 60, auto-triggers Arabic translation, and surfaces the content through a redesigned editorial masonry landing page and a polished Arabic article reading page. All work extends the existing Next.js 15 / better-sqlite3 / Cheerio / CSS Modules stack with the only new dependency being `sharp` for image conversion.

---

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Node.js 20+  
**Primary Dependencies**: Next.js 15.5 (App Router), Cheerio 1.2, better-sqlite3 12.6, sharp (NEW), iron-session  
**Storage**: SQLite via better-sqlite3 at `data/cinema.db`; static images at `public/images/articles/`  
**Testing**: Vitest 4  
**Target Platform**: Linux VPS (self-hosted Next.js)  
**Project Type**: Web application (full-stack Next.js)  
**Performance Goals**: Lighthouse ≥ 90 (constitution override of spec SC-004 ≥ 85); scrape 5+ pages in < 60s  
**Constraints**: TypeScript strict (no `any`), CSS Modules only (no Tailwind), Server Components by default  
**Scale/Scope**: Dozens of articles, single-admin operation

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Arabic-First (RTL, typography) | ✅ Pass | All article/landing page work includes RTL + Arabic fonts |
| Source Integrity (attribution) | ✅ Pass | `sourceBox` component with original author + URL preserved |
| Cinematic Identity (Noir & Gold, no purple) | ✅ Pass | CSS Custom Properties palette enforced; no purple |
| Content Quality (draft before publish) | ✅ Pass | Auto-translate produces `draft` — human reviews before publish |
| Performance (Lighthouse ≥ 90) | ✅ Pass (constitution override) | Implementation targets 90; SC-004 spec value of 85 is superseded |
| Monetization (AdSense no layout shift) | ✅ Pass | Existing AdSlot components unchanged |
| Accessibility (WCAG 2.1 AA) | ✅ Pass | Article page redesign includes semantic HTML + alt tags |
| Dev Standards (TS strict, CSS Modules, Server Components) | ✅ Pass | All new code follows these conventions |
| Scrape Politeness (rate limiting + User-Agent) | ✅ Pass | Configurable delay (FR-015) + User-Agent already in scraper |
| No prohibited content sources | ✅ Pass | Domain whitelist enforced in API validation |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-article-scraper/
├── plan.md              ← This file
├── spec.md              ← Feature specification
├── research.md          ← Phase 0 research findings
├── data-model.md        ← Phase 1 data model
├── quickstart.md        ← Phase 1 developer guide
├── contracts/
│   └── api.md           ← Phase 1 API contracts
├── checklists/
│   └── requirements.md  ← Spec quality checklist
└── tasks.md             ← Phase 2 output (from /speckit.tasks)
```

### Source Code Changes (repository root)

```text
src/
├── lib/
│   ├── scraper/
│   │   ├── tasteofcinema.ts        MODIFY — add inline image extraction + page-rewind logic
│   │   ├── imageProcessor.ts       NEW — download images + convert to WEBP via sharp
│   │   └── pipeline.ts             NEW — orchestrate: scrape → images → translate → save
│   └── db/
│       ├── index.ts                MODIFY — add migrations for settings + scrape_jobs tables
│       ├── articles.ts             MODIFY — add upsert (overwrite) function + page_count/scraped_at fields
│       ├── settings.ts             NEW — get/set settings key-value pairs
│       └── scrapeJobs.ts           NEW — create/update/list scrape job lifecycle
├── app/
│   ├── api/
│   │   ├── scrape/
│   │   │   ├── route.ts            NEW — POST /api/scrape (create job)
│   │   │   └── [jobId]/
│   │   │       └── route.ts        NEW — GET /api/scrape/[jobId] (poll status)
│   │   └── settings/
│   │       └── route.ts            NEW — GET + PATCH /api/settings
│   └── (site)/
│       ├── page.tsx                MODIFY — add thumbnail <Image> to article cards
│       ├── page.module.css         MODIFY — implement editorial masonry grid CSS
│       └── article/[slug]/
│           ├── page.tsx            MODIFY — hero image + source attribution + refined layout
│           └── article.module.css  MODIFY — Arabic typography, numbered items, hero styles
│
public/
└── images/
    └── articles/                   NEW directory (created at runtime by imageProcessor)
        └── {article-slug}/
            ├── 00-thumbnail.webp
            ├── 01-*.webp
            └── ...

tests/
├── unit/
│   └── scraper/
│       ├── tasteofcinema.test.ts   NEW — pagination + image extraction unit tests
│       └── imageProcessor.test.ts  NEW — WEBP conversion unit tests
└── integration/
    └── scraper/
        └── pipeline.test.ts        NEW — end-to-end pipeline integration test
```

**Structure Decision**: Single project (Option 1). No new directories at the repo root level — all new files fit within the existing `src/lib/`, `src/app/api/`, and `public/` structure. The `tests/` directory expands with new scraper-specific tests.

---

## Complexity Tracking

No constitution violations. No complexity justification required.

---

## Phase Breakdown

### Phase 0 ✅ Research (Complete)

See [research.md](./research.md).

**Key findings**:
- `sharp` is the only new dependency needed.
- Existing scraper handles pagination correctly; needs inline image extraction added.
- Overwrite on re-scrape: delete `/public/images/articles/{slug}/` directory + update article record.
- Auto-translation: call existing translation function directly after pipeline completion.
- CSS Grid (no JS library) sufficient for editorial masonry layout.

---

### Phase 1 ✅ Design & Contracts (Complete)

See [data-model.md](./data-model.md) and [contracts/api.md](./contracts/api.md).

**Deliverables**:
- 2 new DB tables: `settings`, `scrape_jobs`
- 2 new columns on `articles`: `page_count`, `scraped_at`
- 5 new API routes: POST/GET `/api/scrape`, GET `/api/scrape/[jobId]`, GET+PATCH `/api/settings`
- Image naming convention established

---

### Phase 2: Implementation *(handled by /speckit.tasks)*

Tasks will cover these implementation groups in dependency order:

**Group A — Database Foundation** (no dependencies)
- Migration: add `settings` table + seed delay default
- Migration: add `scrape_jobs` table
- Migration: add `page_count` + `scraped_at` columns to `articles`
- New: `src/lib/db/settings.ts`
- New: `src/lib/db/scrapeJobs.ts`
- Modify: `src/lib/db/articles.ts` — add `upsertArticle()` (overwrite semantics)

**Group B — Scraper Core** (depends on A)
- Install `sharp`
- New: `src/lib/scraper/imageProcessor.ts` — download + WEBP convert at q60
- Modify: `src/lib/scraper/tasteofcinema.ts` — add inline image extraction, add page-rewind logic
- New: `src/lib/scraper/pipeline.ts` — orchestrate full pipeline with job status updates

**Group C — API Routes** (depends on A + B)
- New: `src/app/api/scrape/route.ts` — POST start job
- New: `src/app/api/scrape/[jobId]/route.ts` — GET poll status
- New: `src/app/api/settings/route.ts` — GET + PATCH settings

**Group D — UI: Landing Page** (depends on A)
- Modify: `src/app/(site)/page.tsx` — render `<Image>` for thumbnails
- Modify: `src/app/(site)/page.module.css` — editorial masonry grid

**Group E — UI: Article Page** (depends on A)
- Modify: `src/app/(site)/article/[slug]/page.tsx` — hero image, author attribution, layout
- Modify: `src/app/(site)/article/[slug]/article.module.css` — Arabic typography, numbered items

**Group F — Tests** (depends on B + C)
- New: `tests/unit/scraper/tasteofcinema.test.ts`
- New: `tests/unit/scraper/imageProcessor.test.ts`
- New: `tests/integration/scraper/pipeline.test.ts`
