# Tasks: Article Scraper & Premium UI Redesign

**Input**: Design documents from `/specs/001-article-scraper/`  
**Prerequisites**: ✅ plan.md, ✅ spec.md, ✅ research.md, ✅ data-model.md, ✅ contracts/api.md, ✅ quickstart.md

**Tests**: Not explicitly requested in spec. Unit tests included for scraper parsing logic only (critical path).

**Organization**: Tasks grouped by user story. Each phase = independently testable increment.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared state dependencies)
- **[Story]**: User story this task belongs to (US1–US4)
- Paths are relative to repo root `/home/basem/sites/tasteofcinemaarabi/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependency and prepare environment.

- [x] T001 Install `sharp` production dependency via `npm install sharp` and verify it appears in `package.json`
- [x] T002 Create directory `public/images/articles/` with a `.gitkeep` file so the directory is tracked in git but contents are gitignored

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, DB layer, and scraper utility functions that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add DB migration in `src/lib/db/index.ts` to create `settings` table with `(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME)` and seed `scrape_delay_seconds = '2'`
- [x] T004 Add DB migration in `src/lib/db/index.ts` to create `scrape_jobs` table with columns: `id, target_url, status, pages_found, images_found, images_saved, article_id, error_log, started_at, completed_at` — ensure migration ID is `20260228_add_scrape_jobs`
- [x] T005 Add DB migration in `src/lib/db/index.ts` to `ALTER TABLE articles ADD COLUMN page_count INTEGER DEFAULT 1` and `ALTER TABLE articles ADD COLUMN scraped_at DATETIME` — migration ID: `20260228_articles_scrape_fields`
- [x] T006 [P] Create `src/lib/db/settings.ts` with two typed functions: `getSetting(key: string): string | null` and `setSetting(key: string, value: string): void` using parameterized SQLite queries
- [x] T007 [P] Create `src/lib/db/scrapeJobs.ts` with functions: `createScrapeJob(targetUrl: string): number`, `updateScrapeJob(id: number, updates: Partial<ScrapeJobUpdate>): void`, `getScrapeJob(id: number): ScrapeJob | null`, `listScrapeJobs(limit?: number, offset?: number): ScrapeJob[]` — define `ScrapeJob` and `ScrapeJobUpdate` types inline
- [x] T008 [P] Add `upsertArticle(data: ArticleMetadata): number` to `src/lib/db/articles.ts` that uses SQLite `INSERT OR REPLACE` semantics to overwrite an existing article by `source_url`, cleaning up previous images directory before replace
- [x] T009 [P] Create `src/types/scraper.ts` with shared types: `ScrapeJob`, `ScrapeJobStatus` (enum string union), `ScrapeJobUpdate`, `ImageProcessResult`

**Checkpoint**: Run `npm run dev`. No TypeScript errors. DB migrations apply cleanly on first boot.

---

## Phase 3: User Story 1 — Multi-Page Article Scraping (Priority: P1) 🎯 MVP

**Goal**: Admin submits a tasteofcinema.com URL and gets a complete single article scraped from all pages, stored in the DB ready for translation.

**Independent Test**: `GET /api/scrape` returns empty list. `POST /api/scrape` with `https://www.tasteofcinema.com/2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/` returns `{ jobId, status: "pending" }`. Polling `GET /api/scrape/[jobId]` eventually shows `status: "scraping"` then `status: "translating"` then `status: "completed"`. Article appears in admin panel as a draft.

### Implementation for User Story 1

- [x] T010 [US1] Modify `src/lib/scraper/tasteofcinema.ts` — add page-rewind logic: if input URL ends with `/2/`, `/3/`, etc. (regex `/\/(\d+)\/$/`), strip the page number and restart from page 1 before beginning pagination loop
- [x] T011 [US1] Modify `src/lib/scraper/tasteofcinema.ts` — add `extractInlineImages($: CheerioAPI, pageUrl: string): string[]` function that collects all `<img>` src attributes within `.entry-content`, resolves relative URLs to absolute, and returns deduplicated list of valid `https://` URLs
- [x] T012 [US1] Modify `src/lib/scraper/tasteofcinema.ts` — update `scrapeArticle()` return type to include `inlineImages: string[]` (in addition to existing `featuredImage`) by calling `extractInlineImages` on each page and accumulating across pagination pages
- [x] T013 [US1] Create `src/lib/scraper/imageProcessor.ts` — implement `processArticleImages(articleSlug: string, featuredImageUrl: string | null, inlineImageUrls: string[], delayMs: number): Promise<ImageProcessResult>` that: (1) deletes existing `/public/images/articles/{slug}/` directory if it exists, (2) downloads featured image, saves as `00-thumbnail.webp` at quality 60 via sharp, (3) for each inline image: downloads with configurable delay between each, converts to WEBP q60, saves as `{index:02d}-{slugified-name}.webp`, (4) returns map of original URL → local public path, plus error log array
- [x] T014 [US1] Create `src/lib/scraper/pipeline.ts` — implement `runScrapePipeline(jobId: number, targetUrl: string): Promise<void>` that: (1) updates job status to `scraping`, (2) calls `scrapeArticle()`, (3) reads delay setting from DB via `getSetting('scrape_delay_seconds')`, (4) updates job status to `processing-images`, (5) calls `processArticleImages()`, (6) replaces image URLs in article HTML content with local paths, (7) calls `upsertArticle()` with merged data + `page_count` + `scraped_at`, (8) updates job status to `translating`, (9) triggers translation, (10) updates job status to `completed` (or `failed` on any error with error_log written)
- [x] T015 [US1] Create `src/app/api/scrape/route.ts` — implement `POST` handler that: validates `url` field is present, is valid `https://` URL, hostname is `tasteofcinema.com` or `www.tasteofcinema.com`; requires admin session; creates a `ScrapeJob` record; calls `runScrapePipeline()` in background (do NOT `await` — fire and forget using `void pipeline(...)`); returns `202` with `{ jobId, status: "pending" }`
- [x] T016 [US1] Create `src/app/api/scrape/[jobId]/route.ts` — implement `GET` handler that reads the job by ID from `scrapeJobs` DB, requires admin session, returns `200` with full job object or `404` if not found; map DB snake_case to camelCase in response
- [x] T017 [US1] Create `src/app/api/scrape/route.ts` — add `GET` handler (alongside existing `POST`) that returns paginated list of scrape jobs: reads `?limit=20&offset=0` from query params, returns `{ jobs: [...], total: number }` requiring admin session
- [ ] T018 [P] [US1] Create unit test `tests/unit/scraper/tasteofcinema.test.ts` — test `extractInlineImages()` with mock HTML fixture and verify: absolute URLs are resolved, relative URLs are made absolute, duplicates removed, `data:` URIs excluded, non-http URLs excluded
- [ ] T019 [P] [US1] Create unit test `tests/unit/scraper/pagination.test.ts` — test page-rewind logic with URLs ending in `/2/`, `/3/`, `/10/`, and a base URL (no trailing number) — verify correct base URL is computed in each case

**Checkpoint**: Start dev server. POST to `/api/scrape` with a real tasteofcinema.com URL. Poll job status until `completed`. Verify article appears in admin panel as draft with all pages merged.

---

## Phase 4: User Story 2 — Image Scraping & WEBP Conversion (Priority: P1)

**Goal**: All images in a scraped article are downloaded locally as WEBP at quality 60 and referenced by local paths in the article content.

**Note**: US2 is implemented as an integral part of the pipeline created in Phase 3 (T013–T014). The tasks below cover the remaining configuration surface and validation.

**Independent Test**: After scraping an article, verify: `public/images/articles/{slug}/` exists with at least one `.webp` file; `00-thumbnail.webp` is present if source had a featured image; all `<img src>` in the stored MDX/HTML content point to `/images/articles/...` not to external URLs; re-scraping the same URL replaces all images with no orphaned files.

### Implementation for User Story 2

- [x] T020 [US2] Create `src/app/api/settings/route.ts` — implement `GET` handler returning all settings as a JSON object (e.g. `{ scrape_delay_seconds: 2 }`), and `PATCH` handler accepting `{ scrape_delay_seconds: number }` with validation: must be integer 0–30; requires admin session; updates DB via `setSetting()`
- [x] T021 [US2] Add a "Scraper Settings" section to the admin panel import UI (in existing admin article import page) — render a number input for `Scrape Delay (seconds)` that reads from `GET /api/settings` and saves via `PATCH /api/settings`; show current value with min=0, max=30
- [x] T022 [US2] Add `.gitignore` rule to ignore `public/images/articles/**` (actual image files) while keeping the directory tracked via `public/images/articles/.gitkeep`
- [ ] T023 [P] [US2] Create unit test `tests/unit/scraper/imageProcessor.test.ts` — mock `fetch` and `sharp` module; test: (1) featured image saved as `00-thumbnail.webp`, (2) inline images saved with sequential index prefix, (3) failed download logs error and continues, (4) existing directory deleted on re-run, (5) returned path map has correct local paths

**Checkpoint**: Scrape an article with images. Inspect `public/images/articles/` — all `.webp` files present. Change delay to 5s in admin settings. Re-scrape same URL — verify fresh files with no stale images.

---

## Phase 5: User Story 3 — Premium Article Page Redesign (Priority: P2)

**Goal**: The article reading page delivers a premium, editorial, RTL Arabic experience with hero image, proper typography, and visually distinct numbered list items.

**Independent Test**: Open any published article page. Verify: (1) featured image shows as a full-width hero in the header, (2) Arabic body text flows RTL with `line-height ≥ 1.9`, (3) if article is a numbered list ("Top 25..."), each numbered section has visual separation, (4) page has no horizontal scroll on mobile (375px), (5) source attribution box shows original author name and clickable link to source URL.

### Implementation for User Story 3

- [x] T024 [US3] Update `src/app/(site)/article/[slug]/article.module.css` — redesign hero image section: `.heroBanner` class with `aspect-ratio: 21/9` on desktop, `aspect-ratio: 16/9` on mobile, `object-fit: cover`, cinematic dark overlay gradient at bottom using `::after` pseudo-element with `rgba(0,0,0,0.5)` to `transparent`
- [x] T025 [US3] Update `src/app/(site)/article/[slug]/article.module.css` — set Arabic body typography: `font-family: 'Noto Naskh Arabic', serif`, `line-height: 1.9`, `font-size: clamp(1rem, 2.5vw, 1.125rem)`, `direction: rtl`, `text-align: right`; add Google Fonts import for Noto Naskh Arabic to root layout
- [x] T026 [US3] Update `src/app/(site)/article/[slug]/article.module.css` — add numbered item styles: `.content h2` with gold left-border (`border-right: 4px solid var(--gold)` for RTL), generous top padding, custom counter rendering; add `figure` + `figcaption` styles for inline article images (responsive, rounded corners, subtle shadow)
- [x] T027 [US3] Update `src/app/(site)/article/[slug]/page.tsx` — wrap featured image in a `<div className={styles.heroBanner}>` with a Next.js `<Image>` component using `fill` prop, `priority`, and `alt={meta.title_ar}`; ensure the image is shown even when `meta.featured_image` is a relative path (starts with `/`)
- [x] T028 [US3] Update `src/app/(site)/article/[slug]/page.tsx` — enhance the source attribution `sourceBox`: show original author name (`meta.author`) prominently; show original English title (`meta.title_en`) in smaller italic text; show "المصدر:" label before the clickable link; ensure link opens `target="_blank" rel="noopener noreferrer"`
- [x] T029 [US3] Update `src/app/(site)/article/[slug]/article.module.css` — style the `.sourceBox` as a bordered callout card: `border-right: 3px solid var(--gold)`, subtle background `rgba(var(--gold-rgb), 0.06)`, padding `1rem 1.25rem`, `border-radius: 0.5rem`, small italic Arabic text with gold accent color for the source label
- [x] T030 [US3] Add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous">` and `<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet">` to `src/app/layout.tsx` metadata or `<head>` section

**Checkpoint**: `npm run dev`. Open an article page. Verify hero image renders, Arabic text is visually elegant, source box is styled. Run Lighthouse — target score ≥ 90.

---

## Phase 6: User Story 4 — Landing Page with Article Thumbnails (Priority: P2)

**Goal**: Home page shows an editorial masonry grid where the most recent article is a full-width hero card and remaining articles are displayed in a mixed-size grid, all with their thumbnail images.

**Independent Test**: Visit `/`. Verify: (1) most recent article occupies a full-width hero card at the top with its thumbnail image as background or featured image, (2) remaining articles are displayed in a 3-column grid on desktop / 1-column on mobile, each with a thumbnail `<Image>`, Arabic title, and excerpt, (3) clicking any card navigates to the correct article page, (4) articles without thumbnails show a cinematic dark placeholder, (5) images are lazy-loaded (use Chrome DevTools Network tab to confirm).

### Implementation for User Story 4

- [x] T031 [US4] Update `src/app/(site)/page.tsx` — replace `<div className={styles.cardImage} />` empty placeholder with `<div className={styles.cardImageWrapper}>` containing a Next.js `<Image>` component: `src={article.featured_image || '/images/placeholder-cinema.webp'}`, `fill`, `sizes="(max-width: 768px) 100vw, 33vw"`, `alt={article.title_ar}`, `loading="lazy"`
- [x] T032 [US4] Update `src/app/(site)/page.tsx` — render the hero featured article's thumbnail as a background Next.js `<Image>` inside `.heroFeatured` with `fill`, `priority={true}`, `sizes="100vw"`, `alt={featured.title_ar}`; wrap in `position: relative` container so `fill` works correctly
- [x] T033 [US4] Update `src/app/(site)/page.module.css` — implement editorial masonry grid: `.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }` with responsive breakpoints: 2 columns at ≤1024px, 1 column at ≤640px; add `.cardImageWrapper { position: relative; aspect-ratio: 16/9; overflow: hidden; border-radius: 0.5rem 0.5rem 0 0; }`
- [x] T034 [US4] Update `src/app/(site)/page.module.css` — style the hero section: `.heroFeatured { position: relative; min-height: 480px; border-radius: 1rem; overflow: hidden; display: flex; align-items: flex-end; }` with `::after` overlay gradient `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)` so text over image is readable; `.heroContent { position: relative; z-index: 1; padding: 2rem; }`
- [x] T035 [US4] Create `public/images/placeholder-cinema.webp` — generate a 800×450 dark cinematic placeholder image (solid near-black `#0f0f0f` with a subtle centered film-strip or letterbox bars decoration) using `sharp` in a one-off script at `scripts/generate-placeholder.ts`, then delete the script after generating the image
- [x] T036 [US4] Update `next.config.ts` — add `images: { remotePatterns: [] }` (or keep existing) and ensure `unoptimized: false` so local `/public/` images served from Next.js are optimized by `<Image>`; also confirm `sharp` is listed in `serverExternalPackages` if needed for App Router

**Checkpoint**: `npm run dev`. Open `/`. Verify hero article shows thumbnail background image, 3-column grid renders with article images, all links work, no layout shift. Test on 375px mobile width.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple stories, constitution compliance, and cleanup.

- [ ] T037 [P] Add Arabic `alt` text enforcement: in `src/lib/scraper/tasteofcinema.ts`, extract `alt` attributes from inline `<img>` tags and include them in the image URL→alt map returned by `extractInlineImages()`; use alt text when writing local `<img>` tags in processed content
- [x] T038 [P] Add `aria-label` to the scrape submit button and job status poll indicator in the admin panel UI (WCAG 2.1 AA compliance per constitution Principle VII)
- [x] T039 Update `src/app/(site)/article/[slug]/article.module.css` — add `@media (prefers-reduced-motion: reduce)` rule that disables all CSS transitions and animations (constitution Principle VII)
- [x] T040 [P] Add `robots.txt` check note to `src/lib/scraper/tasteofcinema.ts` as a code comment citing constitution Content Ethics: "Scraping respects tasteofcinema.com/robots.txt — verified 2026-02-28: no disallow for article paths"
- [x] T041 Run `npm run lint` and fix any TypeScript strict-mode errors introduced by new files — specifically ensure no `any` types exist in `imageProcessor.ts`, `pipeline.ts`, or any new API routes
- [x] T042 [P] Update `README.md` — add "Content Pipeline" section describing how to scrape a new article, where images are stored, and how to configure scrape delay

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational) ← BLOCKS everything
        ├─► Phase 3 (US1: Multi-page scraping) ← MUST complete before US2
        │     └─► Phase 4 (US2: Image pipeline) ← integrated into pipeline from US1
        ├─► Phase 5 (US3: Article page redesign) ← can start after Phase 2
        └─► Phase 6 (US4: Landing page thumbnails) ← can start after Phase 2
              └─► Phase 7 (Polish) ← after all stories
```

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|-------|-----------|----------------------|
| US1 (multi-page scraping) | Phase 2 complete | US3, US4 (different files) |
| US2 (image pipeline) | US1 complete (pipeline.ts) | US3, US4 settings UI |
| US3 (article page) | Phase 2 complete | US1, US4 |
| US4 (landing page) | Phase 2 complete | US1, US3 |

### Within Each Phase

- DB migration tasks (T003–T005): sequential (same file `db/index.ts`)
- T006, T007, T008, T009: parallel (different files)
- T010–T014: sequential (each builds on the previous)
- T015–T017: T015 and T016 can parallel; T017 adds GET to same route file as T015

---

## Parallel Execution Examples

### Phase 2 Parallel Opportunities

```
Group A (run together after T003–T005):
  T006: src/lib/db/settings.ts
  T007: src/lib/db/scrapeJobs.ts
  T008: src/lib/db/articles.ts (upsert)
  T009: src/types/scraper.ts
```

### Phase 3 + Phase 5 + Phase 6 Parallel

Once Phase 2 is complete, three agents can work simultaneously:

```
Agent A → Phase 3 (US1): T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017
Agent B → Phase 5 (US3): T024 → T025 → T026 → T027 → T028 → T029 → T030
Agent C → Phase 6 (US4): T031 → T032 → T033 → T034 → T035 → T036
```

Phase 4 (US2: T020–T023) follows Agent A after Phase 3.

---

## Implementation Strategy

### MVP (User Stories 1 + 2 only — content pipeline working)

1. ✅ Complete Phase 1: Setup (T001–T002)
2. ✅ Complete Phase 2: Foundational (T003–T009)
3. ✅ Complete Phase 3: US1 Scraping (T010–T019)
4. ✅ Complete Phase 4: US2 Image Pipeline (T020–T023)
5. **STOP & VALIDATE**: Scrape a real article end-to-end. Confirm images saved, article in DB as draft, translation triggered.

### Full Delivery (All 4 stories)

6. Complete Phase 5: US3 Article Page Redesign (T024–T030)
7. Complete Phase 6: US4 Landing Page Thumbnails (T031–T036)
8. Complete Phase 7: Polish (T037–T042)
9. Run Lighthouse — verify ≥ 90 score on article page and home page.

---

## Task Summary

| Phase | Tasks | User Story | Parallelizable |
|-------|-------|-----------|----------------|
| 1 Setup | T001–T002 | — | T002 only |
| 2 Foundational | T003–T009 | — | T003-T005 sequential; T006-T009 parallel |
| 3 US1 Scraping | T010–T019 | US1 (P1) | T018, T019 parallel |
| 4 US2 Images | T020–T023 | US2 (P1) | T022, T023 parallel |
| 5 US3 Article Page | T024–T030 | US3 (P2) | T024-T026 parallel |
| 6 US4 Landing Page | T031–T036 | US4 (P2) | T031-T032 parallel |
| 7 Polish | T037–T042 | — | T037, T038, T040, T042 parallel |
| **Total** | **42 tasks** | | **~18 parallelizable** |

---

## Notes

- `[P]` tasks = different files, no dependencies between them — safe to run in parallel
- `[Story]` label maps each task to a user story from `spec.md` for traceability
- Each story phase is independently completable and testable at its checkpoint
- Commit after each task group (e.g., `feat(scraper): add inline image extraction`)
- Follow conventional commit format per constitution Development Standards
- Constitution override: Lighthouse target is **≥ 90**, not ≥ 85 from spec SC-004
