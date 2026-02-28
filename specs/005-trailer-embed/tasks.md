# Tasks: Movie Trailer Discovery & Embedding

**Input**: Design documents from `/specs/005-trailer-embed/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Test tasks omitted. Test files listed in plan.md can be added later if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration, CSP configuration, and type definitions required by all user stories

- [X] T001 Add `article_trailers` table and index to data/schema.sql per data-model.md schema
- [X] T002 [P] Add `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com` CSP directive to next.config.ts
- [X] T003 [P] Add `'discovering-trailers'` to `ScrapeJobStatus` union type in src/types/scraper.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core trailer validation and DB access modules that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create URL parsing (platform detection, video ID extraction via regex) and oEmbed validation functions (YouTube + Vimeo) in src/lib/trailers/validate.ts — handle YouTube 400 as "not found" per research.md; normalize URLs to `watch?v=` format before oEmbed; add 200ms delay between batch calls
- [X] T005 [P] Create `article_trailers` CRUD operations (getByArticleId, insert/upsert, deleteById, markInvalid) in src/lib/db/trailers.ts using better-sqlite3 — enforce max 10 AI-discovered trailers per article at insert level

**Checkpoint**: Foundation ready — trailer validation and storage modules available for all stories

---

## Phase 3: User Story 1 — Automatic Trailer Discovery During Translation (Priority: P1) 🎯 MVP

**Goal**: When an article is translated via the scraper pipeline, the AI also suggests trailer URLs for each movie title. Valid trailers are stored in the DB and `<TrailerEmbed>` tags are auto-inserted into the MDX content.

**Independent Test**: Import a single article with known movie titles (e.g., via `/admin/import`). After the pipeline completes, verify: (1) `article_trailers` table has rows for the article, (2) the saved `.mdx` file contains `<TrailerEmbed>` tags below each movie section.

### Implementation for User Story 1

- [X] T006 [US1] Extend AI translation prompt in src/lib/ai/translate.ts to include trailer URL instructions — add `trailer_urls` array to the structured JSON response schema per contracts/api-contracts.md §3; include instruction for AI to return YouTube/Vimeo URLs for each movie title (up to 10), or `null` when unsure
- [X] T007 [P] [US1] Create MDX `<TrailerEmbed>` auto-insertion module in src/lib/trailers/insert.ts — given MDX content string and an array of validated trailers, insert `<TrailerEmbed videoId="..." platform="..." title="..." />` tags below each movie's section using heading/title matching; handle edge cases (no matching section → append at end, duplicate prevention)
- [X] T008 [US1] Integrate trailer discovery stage into scraper pipeline in src/lib/scraper/pipeline.ts — after translation completes: (1) parse `trailer_urls` from AI response, (2) validate each URL via validate.ts, (3) store valid trailers via db/trailers.ts, (4) auto-insert tags via insert.ts into MDX, (5) update job status to `'discovering-trailers'` during this stage; ensure failures are non-blocking (article saves without trailers on error)

**Checkpoint**: Importing an article now auto-discovers trailers and embeds tags in MDX. Tags render as raw text until US2 registers the component.

---

## Phase 4: User Story 2 — Trailer Embedding in Article Content (Priority: P2)

**Goal**: Embedded `<TrailerEmbed>` tags in MDX render as responsive, lazy-loaded video players on the public site. Admin can see discovered trailers in the article editor.

**Independent Test**: Manually add a `<TrailerEmbed videoId="dQw4w9WgXcQ" platform="youtube" title="Test" />` tag to any `.mdx` file. View the article page — it should render a functional video facade with thumbnail, play button, and lazy loading.

### Implementation for User Story 2

- [X] T009 [P] [US2] Create `TrailerEmbed` client component (`"use client"`) with facade pattern in src/components/ui/TrailerEmbed.tsx — props: `{ videoId: string, platform: 'youtube' | 'vimeo', title: string }`; states: facade (thumbnail + play button), playing (swap to iframe: `youtube-nocookie.com` or `player.vimeo.com`), error (Arabic fallback "هذا المقطع لم يعد متاحاً"); use Intersection Observer for lazy loading; use `maxresdefault.jpg` with `hqdefault.jpg` fallback for YouTube thumbnails; Vimeo thumbnails from stored `thumbnail_url`
- [X] T010 [P] [US2] Create responsive base styles in src/components/ui/TrailerEmbed.module.css — 16:9 aspect ratio container, responsive scaling, smooth facade-to-iframe transition, RTL-compatible text alignment, `direction: rtl` for Arabic movie titles
- [X] T011 [P] [US2] Create GET endpoint for article trailers in src/app/api/articles/[id]/trailers/route.ts — returns `{ trailers: TrailerRow[] }` per contracts/api-contracts.md §1; 404 if article not found; uses db/trailers.ts
- [X] T012 [US2] Register `TrailerEmbed` component with `<MDXRemote>` via `components` prop in src/app/(site)/article/[slug]/page.tsx — import TrailerEmbed and pass `components={{ TrailerEmbed }}` to MDXRemote
- [X] T013 [US2] Add read-only trailer list panel (sidebar or section) to article editor in src/app/(admin)/articles/[id]/edit/page.tsx — fetch trailers via GET `/api/articles/{id}/trailers`; display each trailer with movie title, platform icon (lucide-react), and thumbnail preview

**Checkpoint**: Articles with trailer tags now render functional video players. Admin sees discovered trailers in editor.

---

## Phase 5: User Story 3 — Manual Trailer Search & Override (Priority: P3)

**Goal**: Admin can manually paste a YouTube/Vimeo URL to add or replace a trailer, with real-time validation.

**Independent Test**: In the article editor, paste a YouTube URL into the manual add field, enter a movie title, submit. Verify the trailer appears in the trailer list and can be inserted into the MDX textarea. Delete a trailer and verify removal.

### Implementation for User Story 3

- [X] T014 [US3] Add POST and DELETE handlers to trailer API in src/app/api/articles/[id]/trailers/route.ts — POST: accept `{ url, movie_title }`, extract platform/videoId via validate.ts, validate via oEmbed, upsert into DB (source='manual'), return 201/400/422 per contracts/api-contracts.md §1; DELETE: accept trailerId in URL path, remove from DB, return 200/404
- [X] T015 [US3] Add manual URL paste form and delete actions to trailer panel in src/app/(admin)/articles/[id]/edit/page.tsx — URL input + movie title input + "Add Trailer" button; delete icon per trailer row; copy-to-clipboard button that copies `<TrailerEmbed>` tag for pasting into MDX textarea; loading/error states for validation feedback

**Checkpoint**: Admin has full manual control over trailers — add, remove, and insert into content.

---

## Phase 6: User Story 4 — Unique Cinema-Themed Visual Presentation (Priority: P4)

**Goal**: Trailer embeds display with a distinctive Noir & Gold cinema-themed visual style matching the site's editorial identity — not generic iframes.

**Independent Test**: View an article with embedded trailers. Verify: cinema-themed frame/border, movie title above player, platform icon (YouTube/Vimeo), custom poster overlay with prominent play button, smooth transition to video on click.

### Implementation for User Story 4

- [X] T016 [US4] Enhance TrailerEmbed facade with cinema-themed design elements in src/components/ui/TrailerEmbed.tsx — add platform icon (lucide-react: `Youtube`, `Video` for Vimeo) next to movie title; cinematic play button overlay (centered, prominent, animated on hover); gradient overlay on thumbnail for "film noir" feel; smooth CSS transition from facade to playing state
- [X] T017 [US4] Add Noir & Gold cinema frame styles in src/components/ui/TrailerEmbed.module.css — subtle gold (`#c9a84c` or site gold variable) border/accent on container; dark background for title bar; film-strip or curtain-inspired decorative border; platform icon styling; play button with gold accent and scale animation on hover; ensure no purple per constitution
- [X] T018 [US4] Add accessibility features to TrailerEmbed in src/components/ui/TrailerEmbed.tsx — keyboard-accessible play button with `role="button"` and `tabIndex={0}`; `aria-label` describing the action (Arabic: "تشغيل مقطع فيلم [title]"); respect `prefers-reduced-motion` (disable hover animations); visible focus ring on play button

**Checkpoint**: Trailer embeds are visually distinctive, cinema-themed, and fully accessible.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final integration verification and performance validation

- [X] T019 [P] Performance verification — confirm Lighthouse ≥90 on article pages with trailer embeds; verify zero CLS from reserved 16:9 dimensions; check facade pattern prevents unnecessary iframe loads
- [X] T020 Run quickstart.md validation and end-to-end integration test per specs/005-trailer-embed/quickstart.md — full pipeline: import article → translation with trailer discovery → admin review → public page rendering

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (schema must exist); BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion (T004 + T005)
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion; can start in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Phase 2 + US2 (T011 creates route file extended by T014; T013 creates editor panel extended by T015)
- **User Story 4 (Phase 6)**: Depends on US2 (T009/T010 create the component files enhanced by T016-T018)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Phase 2 only — fully independent. MVP deliverable.
- **US2 (P2)**: Phase 2 only — largely independent from US1 (TrailerEmbed tags can be manually added to MDX to test). Can start simultaneously with US1.
- **US3 (P3)**: Phase 2 + US2's T011 (GET route file) and T013 (editor panel) — extends those files.
- **US4 (P4)**: US2's T009/T010 (component + styles files) — enhances existing component.

### Within Each User Story

- Models/utilities before services
- Services before API endpoints
- API endpoints before UI integration
- Core implementation before polish

### Parallel Opportunities

**Phase 1**: T001 sequential (schema first), then T002 + T003 in parallel
**Phase 2**: T004 + T005 in parallel (different files, no dependencies on each other)
**Phase 3**: T006 + T007 in parallel (different files); T008 depends on both
**Phase 4**: T009 + T010 + T011 all in parallel (three different files); T012 depends on T009; T013 depends on T011
**Phase 5**: T014 then T015 (sequential — same editor file)
**Phase 6**: T016 + T017 in parallel (component + styles); T018 depends on T016

---

## Parallel Example: Phase 2 (Foundational)

```
# Both foundational modules can be built simultaneously:
Task T004: "Create URL parsing and oEmbed validation in src/lib/trailers/validate.ts"
Task T005: "Create article_trailers CRUD in src/lib/db/trailers.ts"
```

## Parallel Example: User Story 2

```
# Three independent files can be built simultaneously:
Task T009: "Create TrailerEmbed client component in src/components/ui/TrailerEmbed.tsx"
Task T010: "Create responsive styles in src/components/ui/TrailerEmbed.module.css"
Task T011: "Create GET endpoint in src/app/api/articles/[id]/trailers/route.ts"

# Then sequential integration:
Task T012: "Register component with MDXRemote" (needs T009)
Task T013: "Add trailer list to editor" (needs T011)
```

## Parallel Example: User Story 1

```
# AI prompt and MDX insertion are independent modules:
Task T006: "Extend AI translation prompt in src/lib/ai/translate.ts"
Task T007: "Create TrailerEmbed auto-insertion in src/lib/trailers/insert.ts"

# Pipeline orchestration depends on both:
Task T008: "Integrate into scraper pipeline" (needs T006 + T007)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T005)
3. Complete Phase 3: User Story 1 (T006–T008)
4. **STOP and VALIDATE**: Import an article → verify trailers in DB + `<TrailerEmbed>` tags in MDX
5. Tags render as raw text — functional proof that discovery pipeline works

### Incremental Delivery

1. **Setup + Foundational** (T001–T005) → Infrastructure ready
2. **Add US1** (T006–T008) → Trailer auto-discovery works → Validate DB + MDX
3. **Add US2** (T009–T013) → Trailers render on site + visible in editor → Deploy/Demo
4. **Add US3** (T014–T015) → Admin has manual control → Deploy/Demo
5. **Add US4** (T016–T018) → Cinema-themed visual polish → Deploy/Demo
6. **Polish** (T019–T020) → Performance verified, end-to-end tested

Each story adds value without breaking previous stories.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in same phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after its phase completes
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- TrailerEmbed uses `"use client"` — justified per plan.md Complexity Tracking (click handler + state for facade→iframe swap)
- All AI-suggested URLs MUST be validated via oEmbed before storage (never trust AI output directly)
- Use `youtube-nocookie.com` for embed iframes but `youtube.com/watch?v=` for oEmbed validation
