# Tasks: Article Page Enhancement

**Input**: Design documents from `/specs/003-article-page-enhancement/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md
**Tests**: Included for scraper and translation logic (vitest tests already exist and need updating)
**Organization**: Tasks grouped by user story for independent implementation and testing

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Configuration changes required before any feature work

- [x] T001 Add `images.remotePatterns` for `tasteofcinema.com` in `next.config.ts`
- [x] T002 [P] Update `ScrapeResponse` type to include `featuredImage` and `movieTitles` fields in `src/types/api.ts`
- [x] T003 [P] Update `TranslateRequest` type to include optional `movieTitles` field in `src/types/api.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Scraper extraction logic used by both US1 (thumbnail) and US3 (movie titles). Must complete before user stories.
**⚠️ CRITICAL**: US1 and US3 depend on the scraper outputting `featuredImage` and `movieTitles`.

- [x] T004 Add `extractFeaturedImage` function to `src/lib/scraper/tasteofcinema.ts` — extract from `og:image` meta tag, fall back to `.entry-content img:first`, then `img.wp-post-image`; resolve relative URLs via `new URL()`
- [x] T005 Add `extractMovieTitles` function to `src/lib/scraper/tasteofcinema.ts` — two-pass extraction: (1) numbered headings `h2`/`h3`/`p > span` matching `/^\d+[\.\)]\s+(.+)/`, (2) inline `em`/`strong` tags with short title-like text; deduplicate; return `string[]`
- [x] T006 Update `scrapeArticle` return value in `src/lib/scraper/tasteofcinema.ts` to include `featuredImage` and `movieTitles` from T004/T005 in the `ScrapeResponse.data` object
- [x] T007 Update scraper test fixture in `tests/lib/scraper.test.ts` — add `<meta property="og:image">` tag, multiple `<h3>` numbered movie entries, and `<em>` inline title references to the mock HTML
- [x] T008 Add test case for `featuredImage` extraction in `tests/lib/scraper.test.ts` — verify `og:image` is returned, verify fallback to first `<img>`, verify empty when no image found
- [x] T009 Add test case for `movieTitles` extraction in `tests/lib/scraper.test.ts` — verify numbered heading titles extracted, verify inline `<em>` titles extracted, verify deduplication

**Checkpoint**: `npx vitest run tests/lib/scraper.test.ts` passes with new extraction tests

---

## Phase 3: User Story 1 — Article Thumbnail Display (Priority: P1) 🎯 MVP

**Goal**: Display the `featured_image` as a responsive hero thumbnail in the article header, with graceful handling of missing/broken images.

**Independent Test**: Open an article page with a `featured_image` value — image renders. Open one without — no broken image. Set a 404 URL — image disappears gracefully.

### Implementation for User Story 1

- [x] T010 [US1] Create `ArticleThumbnail` Client Component in `src/components/ui/ArticleThumbnail.tsx`
- [x] T011 [P] [US1] Create `ArticleThumbnail.module.css` in `src/components/ui/ArticleThumbnail.module.css`
- [x] T012 [US1] Add conditional thumbnail render in `src/app/(site)/article/[slug]/page.tsx`
- [x] T013 [US1] Update scrape API route in `src/app/api/scrape/route.ts` — no change needed, already passes through all scrapeArticle fields
- [x] T014 [US1] Update translate API route in `src/app/api/translate/route.ts` — accept `featuredImage` from request body, pass it to `saveArticleMetadata` as `featured_image`
- [x] T015 [US1] Update import-batch pipeline in `src/app/api/import-batch/route.ts` — pass `scrapeResult.data.featuredImage` to `saveArticleMetadata` as `featured_image`

**Checkpoint**: Article pages with `featured_image` show the thumbnail; pages without show no image region. Newly scraped articles populate `featured_image` automatically.

---

## Phase 4: User Story 2 — Enhanced Article Page Design (Priority: P2)

**Goal**: Modernize the article page CSS for improved Arabic-first reading comfort, visual hierarchy, and mobile usability.

**Independent Test**: Compare article page at 1280px and 375px before and after — typography, spacing, header hierarchy, and source box should look noticeably more polished.

### Implementation for User Story 2

- [x] T016 [US2] Enhance article header styles in `src/app/(site)/article/[slug]/article.module.css`
- [x] T017 [US2] Enhance article body content styles in `src/app/(site)/article/[slug]/article.module.css`
- [x] T018 [US2] Enhance source attribution box in `src/app/(site)/article/[slug]/article.module.css`
- [x] T019 [US2] Add responsive breakpoints in `src/app/(site)/article/[slug]/article.module.css`

**Checkpoint**: Article page passes visual review on desktop (1280px) and mobile (375px). No horizontal scrolling on mobile. Lighthouse mobile usability ≥ 90.

---

## Phase 5: User Story 3 — Movie Title Language Preservation (Priority: P3)

**Goal**: Protect movie titles from translation/transliteration during the scraping-and-translation pipeline using placeholder substitution.

**Independent Test**: Scrape a known listicle article, translate it, and verify all movie titles in the output MDX are byte-for-byte identical to the source.

### Tests for User Story 3

- [x] T020 [P] [US3] Add test for `insertPlaceholders` in `tests/lib/ai/translate.test.ts`
- [x] T021 [P] [US3] Add test for `restorePlaceholders` in `tests/lib/ai/translate.test.ts`

### Implementation for User Story 3

- [x] T022 [US3] Implement `insertPlaceholders` function in `src/lib/ai/translate.ts`
- [x] T023 [US3] Implement `restorePlaceholders` function in `src/lib/ai/translate.ts`
- [x] T024 [US3] Update `translateArticle` function in `src/lib/ai/translate.ts`
- [x] T025 [US3] Update translation prompt in `src/lib/ai/translate.ts`
- [x] T026 [US3] Update translate API route in `src/app/api/translate/route.ts`
- [x] T027 [US3] Update import-batch pipeline in `src/app/api/import-batch/route.ts`

**Checkpoint**: `npx vitest run tests/lib/ai/translate.test.ts` passes. Manually scraping and translating a listicle article preserves all movie titles in their original language.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all three user stories

- [x] T028 [P] Run full test suite via `npx vitest run` and fix any regressions
- [x] T029 [P] Verify article page with thumbnail at 375px, 768px, 1280px viewports — no horizontal scroll, no broken layout
- [x] T030 Run quickstart.md validation — follow all verification steps for US1, US2, US3
- [x] T031 [P] Verify TypeScript strict mode passes with `npx tsc --noEmit`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 type updates (T002, T003) — BLOCKS US1 and US3
- **US1 (Phase 3)**: Depends on Phase 2 (scraper extracts `featuredImage`)
- **US2 (Phase 4)**: Depends on Phase 1 only (no data dependencies) — can start after T001 or in parallel with Phase 2
- **US3 (Phase 5)**: Depends on Phase 2 (scraper extracts `movieTitles`)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Independence

- **US1 (Thumbnail)**: Can be delivered standalone as MVP. Requires scraper change (Phase 2) + front-end component + API route updates.
- **US2 (Design)**: Fully independent CSS-only work. Can be delivered at any time after Phase 1.
- **US3 (Title Preservation)**: Can be delivered standalone. Requires scraper change (Phase 2) + translation logic + API route updates.

### Within Each User Story

- Tests written and failing before implementation (US3)
- Component/CSS before page integration (US1)
- Utility functions before consumer functions (US3: insertPlaceholders → translateArticle)
- Commit after each task or logical group

### Parallel Opportunities

- T002 + T003 can run in parallel (different type interfaces, same file but different sections)
- T010 + T011 can run in parallel (different files: component TSX + CSS module)
- T016 + T017 + T018 + T019 can all run in parallel (same CSS file, different sections — or sequentially if preferred)
- T020 + T021 can run in parallel (different test cases, same test file)
- US2 (Phase 4) can run entirely in parallel with US1 (Phase 3) and US3 (Phase 5) since it touches only CSS

---

## Parallel Example: Phase 2 → US1 + US2 + US3

```bash
# After Phase 2 completes:

# Stream A: User Story 1 (Thumbnail)
T010 → T011 → T012 → T013 → T014 → T015

# Stream B: User Story 2 (Design) — no Phase 2 dependency
T016 ∥ T017 ∥ T018 → T019

# Stream C: User Story 3 (Title Preservation)
T020 ∥ T021 → T022 → T023 → T024 → T025 → T026 → T027
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational — scraper extraction (T004–T009)
3. Complete Phase 3: User Story 1 — thumbnail display (T010–T015)
4. **STOP and VALIDATE**: Test thumbnail display independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Scraper extracts image + titles
2. Add US1 (Thumbnail) → Test independently → Deploy (MVP!)
3. Add US2 (Design) → Test independently → Deploy
4. Add US3 (Title Preservation) → Test independently → Deploy
5. Polish → Final validation → Done

### Parallel Strategy

With capacity for parallel work:

1. Complete Setup + Foundational together
2. Once Foundational is done:
   - Stream A: US1 (Thumbnail)
   - Stream B: US2 (Design) — can start even earlier since CSS-only
   - Stream C: US3 (Title Preservation)
3. Each stream completes and integrates independently

---

## Notes

- `featured_image` column already exists in the database schema — no migration needed
- `ArticleMetadata` type in `src/types/article.ts` already has `featured_image?: string` — no type change needed
- The `ArticleThumbnail` Client Component is the only new file; all other changes modify existing files
- CSS design work (US2) has zero data dependencies and can proceed at any time
- The placeholder approach (`[[TITLE_N]]`) was chosen over prompt-only instructions for 98-99% reliability vs ~85-90%
