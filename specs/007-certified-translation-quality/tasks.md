# Tasks: تحسين جودة الترجمة — مستوى مكتب ترجمة معتمد

**Input**: Design documents from `/specs/007-certified-translation-quality/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included — plan.md project structure includes test files and quickstart.md verification requires running tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/`, `data/` at repository root (Next.js 15.5 App Router)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new data files and directory structure required by all user stories

- [ ] T001 Create data/glossary.json with initial 35 cinema terminology entries (genres, techniques, movements, roles, shot types) per research.md schema
- [ ] T002 [P] Create data/banned-patterns.json with 25 literal Arabic translation patterns and their natural alternatives per research.md
- [ ] T003 [P] Create data/style-guide.ts with typed editorial rules configuration (tone, language level, name handling, quotation style, numeral format) per FR-007

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions, schema migration, and shared utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add TranslationQualityReport, PhaseReport, ReviewPhaseReport, ProofreadPhaseReport types and extend TranslateResponse with optional quality_report field in src/types/api.ts
- [ ] T005 [P] Add quality_report TEXT DEFAULT NULL column to articles table in data/schema.sql
- [ ] T006 [P] Create glossary loader (loadGlossary, filterRelevantTerms) that reads data/glossary.json and filters entries to those present in source text in src/lib/ai/glossary.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — ترجمة مقال سينمائي بجودة مكتب ترجمة معتمد (Priority: P1) 🎯 MVP

**Goal**: Transform the single-pass AI translation into a 3-phase certified-translation-office pipeline (translate → review → proofread) that produces Arabic text indistinguishable from native writing

**Independent Test**: Translate one article and compare output quality — natural Arabic prose, no literal translation artifacts, consistent cinema terminology, correct bidi rendering

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create Phase 1 translate prompt builder (buildTranslatePrompt) with glossary table injection, style guide rules, and structured JSON output instructions in src/lib/ai/prompts/phase1-translate.ts
- [ ] T008 [P] [US1] Create Phase 2 review prompt builder (buildReviewPrompt) with English source + Arabic translation input, banned patterns list, glossary check, and structured corrections+corrected_text JSON output in src/lib/ai/prompts/phase2-review.ts
- [ ] T009 [P] [US1] Create Phase 3 proofread prompt builder (buildProofreadPrompt) with Arabic-only input (no English source) and polish summary JSON output in src/lib/ai/prompts/phase3-proofread.ts
- [ ] T010 [US1] Implement content chunking utility (splitIntoChunks) that splits at heading boundaries with context envelope (article summary, last paragraph, glossary, chunk position) at 30K char threshold in src/lib/ai/translate.ts
- [ ] T011 [US1] Refactor translateArticle into 3-phase pipeline orchestration — sequential Phase 1 (temp 0.3) → Phase 2 (temp 0.15) → Phase 3 (temp 0.1) with per-phase timing and token tracking in src/lib/ai/translate.ts
- [ ] T012 [US1] Implement post-processing functions: applyBidiIsolation (Unicode FSI U+2068/PDI U+2069 around Latin text) and toEasternArabicNumerals (0-9 → ٠-٩ skipping placeholders/URLs) in src/lib/ai/translate.ts
- [ ] T013 [US1] Implement buildQualityReport function that assembles TranslationQualityReport from per-phase metrics (status, duration, tokens, corrections, new terms) in src/lib/ai/translate.ts
- [X] T014 [US1] Update API route to include quality_report in response JSON and save quality_report to articles.quality_report column in src/app/api/translate/route.ts
- [X] T015 [US1] Update translate tests — mock 3 sequential OpenAI calls, verify pipeline produces correct output, test chunking for long content, test post-processing functions in tests/lib/ai/translate.test.ts

**Checkpoint**: At this point, translating an article produces 3-phase quality output with a quality report. This is a functional MVP.

---

## Phase 4: User Story 2 — قاموس مصطلحات سينمائية موحّد (Priority: P2)

**Goal**: Ensure every cinema term is translated consistently across all articles via an auto-growing glossary that discovers new terms during translation

**Independent Test**: Translate two articles containing the same cinema terms (e.g., "film noir", "mise-en-scène") and verify both produce identical Arabic equivalents

### Implementation for User Story 2

- [ ] T016 [P] [US2] Implement extractDiscoveredTerms function that parses Phase 2 review structured output for newly identified cinema terms in src/lib/ai/glossary.ts
- [ ] T017 [US2] Implement addDiscoveredTerms function that writes new entries to data/glossary.json with approved:false, source:ai_discovered, and incremented version in src/lib/ai/glossary.ts
- [ ] T018 [US2] Integrate glossary update into pipeline — after Phase 2 completes, call extractDiscoveredTerms and addDiscoveredTerms, record new_terms in quality report in src/lib/ai/translate.ts
- [X] T019 [P] [US2] Create glossary tests — loadGlossary, filterRelevantTerms, extractDiscoveredTerms, addDiscoveredTerms, duplicate prevention, approved flag handling in tests/lib/ai/glossary.test.ts

**Checkpoint**: Glossary grows automatically with each translation. New terms marked as unapproved for human review.

---

## Phase 5: User Story 3 — مراجعة ذاتية وتصحيح تلقائي للترجمة (Priority: P2)

**Goal**: Phase 2 review detects and fixes specific error types (grammar, literal translations, terminology) with structured tracking, and the pipeline gracefully handles phase failures

**Independent Test**: Compare Phase 1 raw output with final output — verify literal translation patterns are replaced, grammar errors corrected, and corrections count is tracked in quality report

### Implementation for User Story 3

- [ ] T020 [US3] Implement structured corrections JSON parsing from Phase 2 review response — extract corrections array with type classification (grammar, literal_translation, terminology, style, omission, accuracy) in src/lib/ai/translate.ts
- [ ] T021 [US3] Implement phase retry logic — retry once on failure, fallback to previous phase output if retry fails, mark phase as failed/skipped in quality report in src/lib/ai/translate.ts
- [X] T022 [P] [US3] Create chunking tests — split at h2/h3/p boundaries, context envelope construction, tiny chunk merging, reassembly integrity, no content loss in tests/lib/ai/chunking.test.ts

**Checkpoint**: Review phase provides granular correction tracking. Pipeline degrades gracefully on partial failures.

---

## Phase 6: User Story 4 — دليل أسلوب تحريري للمحتوى السينمائي (Priority: P3)

**Goal**: All translations follow a unified editorial voice — literary journalism tone, modern formal Arabic, consistent handling of foreign names, quotations, and numbers

**Independent Test**: Translate 5 different articles and verify all follow the same editorial style — quotation marks use «», numbers use Eastern Arabic (١٢٣), tone is consistent across articles

### Implementation for User Story 4

- [ ] T023 [US4] Enhance Phase 1 translate prompt with explicit style guide rules from data/style-guide.ts — tone directives, language level, name preservation rules, quotation format in src/lib/ai/prompts/phase1-translate.ts
- [ ] T024 [US4] Refine toEasternArabicNumerals with exclusion zones — skip numbers inside [IMAGE_N], [[TITLE_N]], URLs, code blocks, and year ranges in src/lib/ai/translate.ts
- [ ] T025 [US4] Implement Arabic quotation mark formatting — convert straight quotes and English quotes to «» in translated output during post-processing in src/lib/ai/translate.ts

**Checkpoint**: All articles share a consistent editorial identity matching premium Arabic cinema magazine standards.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Integration with other pipeline consumers and end-to-end validation

- [X] T026 [P] Update import-batch route to pass through quality_report from translateArticle response in src/app/api/import-batch/route.ts
- [X] T027 [P] Update scraper pipeline to handle quality_report from translateArticle response in src/lib/scraper/pipeline.ts
- [X] T028 Run quickstart.md validation — DB migration, glossary/banned-patterns file check, unit tests, API test, quality report verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion
  - User stories should proceed in priority order: P1 → P2 → P2 → P3
  - US1 (P1) is the MVP and must complete first
  - US2 and US3 (both P2) can proceed in parallel after US1
  - US4 (P3) can proceed after US1 (independent of US2/US3)
- **Polish (Phase 7)**: Depends on US1 being complete at minimum

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 only — no dependencies on other stories. This is the MVP.
- **User Story 2 (P2)**: Depends on US1 pipeline being functional (extends glossary.ts and pipeline integration)
- **User Story 3 (P2)**: Depends on US1 pipeline being functional (extends Phase 2 output parsing and retry logic)
- **User Story 4 (P3)**: Depends on US1 prompt builders existing (enhances Phase 1 prompt and post-processing)

### Within Each User Story

- Prompt builders before pipeline orchestration
- Pipeline orchestration before post-processing
- Post-processing before quality report
- Quality report before API route update
- All implementation before tests (tests validate the implementation)

### Parallel Opportunities

Within Phase 1:
- T002 and T003 can run in parallel (different files)

Within Phase 2:
- T005 and T006 can run in parallel with each other (after T004 completes)

Within US1 (Phase 3):
- T007, T008, T009 can ALL run in parallel (three independent prompt builder files)
- T010 through T013 are sequential (each builds on prior translate.ts changes)

Within US2 (Phase 4):
- T016 and T019 can run in parallel (glossary.ts function vs test file)

Within US3 (Phase 5):
- T022 is independent of T020/T021 (separate test file)

Within Phase 7:
- T026 and T027 can run in parallel (different files)

---

## Parallel Example: User Story 1

```text
# Step 1: Launch all prompt builders in parallel
T007: "Create Phase 1 translate prompt builder in src/lib/ai/prompts/phase1-translate.ts"
T008: "Create Phase 2 review prompt builder in src/lib/ai/prompts/phase2-review.ts"
T009: "Create Phase 3 proofread prompt builder in src/lib/ai/prompts/phase3-proofread.ts"

# Step 2: Sequential pipeline construction (each depends on prior)
T010: "Implement content chunking in src/lib/ai/translate.ts"
T011: "Refactor translateArticle to 3-phase pipeline in src/lib/ai/translate.ts"
T012: "Implement post-processing (bidi + numerals) in src/lib/ai/translate.ts"
T013: "Implement buildQualityReport in src/lib/ai/translate.ts"

# Step 3: API integration
T014: "Update API route in src/app/api/translate/route.ts"

# Step 4: Tests
T015: "Update translate tests in tests/lib/ai/translate.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003) — create data files
2. Complete Phase 2: Foundational (T004–T006) — types + schema + glossary loader
3. Complete Phase 3: User Story 1 (T007–T015) — 3-phase pipeline
4. **STOP and VALIDATE**: Translate one article, verify 3-phase output quality and quality report
5. Deploy/demo if ready — this is a working certified-quality translator

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → **Deploy (MVP!)**
3. Add US2 → Glossary auto-grows → Test with 2 articles for term consistency → Deploy
4. Add US3 → Corrections tracked + retry logic → Test with intentionally bad Phase 1 output → Deploy
5. Add US4 → Style guide enforced → Test with 5 articles for editorial consistency → Deploy
6. Polish → All pipeline consumers updated → Final quickstart validation

### Key Technical Notes

- **Existing translate.ts** (310 lines): Will be heavily refactored in T011. Preserve all existing exports (extractImages, restoreImages, insertPlaceholders, restorePlaceholders, translateArticle) to avoid breaking callers.
- **OpenAI mock pattern**: Existing tests mock OpenAI via vitest. 3-phase pipeline needs 3 sequential mock responses.
- **Temperature progression**: Phase 1 (0.3) → Phase 2 (0.15) → Phase 3 (0.1) — decreasing creativity as pipeline narrows.
- **Chunk threshold**: 30,000 chars. Current MAX_CONTENT_CHARS is 60,000 with silent truncation — this will be replaced by smart chunking.
- **Backward compatibility**: TranslateRequest unchanged. TranslateResponse adds optional quality_report field only.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All 3 API consumers of translateArticle (route.ts, import-batch/route.ts, pipeline.ts) must be updated
