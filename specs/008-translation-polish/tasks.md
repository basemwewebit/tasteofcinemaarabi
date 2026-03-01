# Tasks: Translation Polish & Content Cleanup

**Input**: Design documents from `/specs/008-translation-polish/`  
**Branch**: `008-translation-polish`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: إنشاء الملفات والبنى التحتية المشتركة قبل التنفيذ

- [x] T001 Create `data/protected-terms.json` with initial cinema terms list (Taste of Cinema, IMDb, Oscar, Cannes, BAFTA, Sundance, Palme d'Or, Golden Globe, Academy Award, BAFTA, Tribeca)
- [x] T002 [P] Add `Phase4RefinementItem` and `PolishPhaseReport` interfaces to `src/types/api.ts`
- [x] T003 [P] Add `polishEnabled?: boolean` field to `TranslateRequest` interface in `src/types/api.ts`
- [x] T004 [P] Update `TranslationQualityReport.phases` to include `polish: PolishPhaseReport` in `src/types/api.ts`

**Checkpoint**: Types محدَّثة، protected-terms جاهز — يمكن البدء بأي Phase

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: البنية الجوهرية للـ pipeline التي تعتمد عليها كل القصص

**⚠️ CRITICAL**: لا يمكن البدء بأي User Story قبل اكتمال هذا الـ phase

- [x] T005 Audit `cleanContent` gaps in `src/lib/ai/translate.ts`: document exact Unicode chars that escape current post-processing (Zero Width Space `\u200b`, Non-Breaking Space `\u00a0`, accumulated FSI/PDI `\u2068`/`\u2069`, curly single quotes `\u2018`/`\u2019`)
- [x] T006 Create `cleanInvisibleChars(text: string): string` function in `src/lib/ai/translate.ts` — strips `\u200b`, `\u200c`, `\u200d`, `\u00ad`, replaces `\u00a0` with regular space, strips accumulated `\u2068`/`\u2069` before `applyBidiIsolation` re-adds them
- [x] T007 [P] Create `normalizeWhitespace(text: string): string` in `src/lib/ai/translate.ts` — collapses multiple consecutive spaces to one, normalizes line endings
- [x] T008 [P] Create `normalizeBlankLines(text: string): string` in `src/lib/ai/translate.ts` — reduces 3+ consecutive blank lines to 2 max (handles chunk join artifacts)
- [x] T009 Wire new cleaning functions into the post-processing pipeline in `src/lib/ai/translate.ts` in correct order: `cleanInvisibleChars` → `normalizeWhitespace` → `normalizeBlankLines` → `toEasternArabicNumerals` → `applyBidiIsolation` → `formatArabicQuotationMarks`
- [x] T010 Extend `formatArabicQuotationMarks` in `src/lib/ai/translate.ts` to handle curly single quotes (`'`/`'` → no-op or strip) and em dash (`—` → `—` preserve as-is outside tags)

**Checkpoint**: post-processing الأساسي مُعزَّز — جاهز للـ User Stories

---

## Phase 3: User Story 1 — إزالة الرموز غير المرغوبة (Priority: P1) 🎯 MVP

**Goal**: ضمان أن كل مقال مترجم يخرج نظيفاً تماماً من الرموز الخفية وعلامات الترقيم الغريبة.

**Independent Test**: تشغيل `translateArticle()` على مقال يحتوي عمداً على `\u200b`, `\u00a0`, `"..."`, `—` — والتحقق أن الناتج لا يحتوي أياً منها في النص العربي.

### Implementation for User Story 1

- [x] T011 [US1] Write unit tests for `cleanInvisibleChars()` in `tests/lib/translate.test.ts`: يختبر إزالة `\u200b`, `\u00a0`, تراكم FSI/PDI، بدون المساس بالنص العربي الصحيح
- [x] T012 [P] [US1] Write unit tests for `normalizeWhitespace()` in `tests/lib/translate.test.ts`: مسافات متعددة → واحدة، أسطر فارغة زائدة
- [x] T013 [P] [US1] Write unit tests for `formatArabicQuotationMarks()` extended cases in `tests/lib/translate.test.ts`: curly quotes `"..."` → `«...»`, protect quotes inside HTML tags
- [x] T014 [US1] Write integration test for full post-processing pipeline in `tests/lib/translate.test.ts`: نص يحتوي مزيجاً من جميع الحالات يمر بالـ pipeline كاملاً ويخرج نظيفاً
- [x] T015 [US1] Verify all new unit tests PASS after T006–T010 implementation — run `npx vitest run tests/lib/translate.test.ts`

**Checkpoint**: ✅ US1 مكتملة — كل مقال يخرج نظيفاً بدون رموز غير مرغوبة

---

## Phase 4: User Story 2 — إعادة الصياغة الأنيقة (Priority: P2)

**Goal**: إضافة Phase 4 للـ pipeline تُحسّن أسلوب النص العربي بعد الترجمة، مع دعم تعطيلها.

**Independent Test**: تشغيل `translateArticle({ polishEnabled: true })` على مقال — والتحقق أن `quality_report.phases.polish.status === 'success'` وأن `refinements > 0`. ثم تشغيل `translateArticle({ polishEnabled: false })` والتحقق أن `polish.status === 'skipped'`.

### Implementation for User Story 2

- [x] T016 [US2] Create `src/lib/ai/prompts/phase4-polish.ts` with `buildPhase4SystemMessage(protectedTerms: string[]): string` — system prompt يُحدّد القيود: لا حذف، لا إعادة ترتيب فقرات، لا تعديل أسماء أفلام/أشخاص، تحسين الأسلوب والانسيابية فقط
- [x] T017 [US2] Add `buildPhase4UserMessage({ arabicText: string }): string` to `src/lib/ai/prompts/phase4-polish.ts` — user prompt بسيط يُمرّر النص فقط
- [x] T018 [US2] Create `loadProtectedTerms(): string[]` function in `src/lib/ai/translate.ts` — يقرأ `data/protected-terms.json` ويُعيد `terms` array، مع try/catch واضح (fallback: `[]`)
- [x] T019 [US2] Add Phase 4 execution block in `translateArticle()` in `src/lib/ai/translate.ts` — بعد Phase 3، يتحقق من `polishEnabled !== false` ثم يُشغّل `runPhaseWithRetry<Phase4Output>()` بـ temperature `0.4`
- [x] T020 [US2] Implement Phase 4 fallback in `src/lib/ai/translate.ts`: عند فشل Phase 4 يُسجَّل `phase4Metrics.status = 'failed'` ويُستخدم output Phase 3 بدون خطأ يوقف الـ pipeline
- [x] T021 [US2] Add `phase4Metrics` initialization and `polishEnabled: false` → `status: 'skipped'` logic in `src/lib/ai/translate.ts`
- [x] T022 [US2] Update `buildQualityReport()` in `src/lib/ai/translate.ts` to include `phase4: PolishPhaseReport` in the returned `TranslationQualityReport`
- [x] T023 [P] [US2] Write unit test for `buildPhase4SystemMessage()` in `tests/lib/translate.test.ts`: يتحقق أن قائمة المصطلحات المحمية تظهر في الـ prompt
- [x] T024 [P] [US2] Write unit test for `polishEnabled: false` → `phase4Metrics.status === 'skipped'` in `tests/lib/translate.test.ts`
- [x] T025 [US2] Verify Phase 4 integration tests PASS — run `npx vitest run tests/lib/translate.test.ts`

**Checkpoint**: ✅ US2 مكتملة — Phase 4 تعمل، مُفعَّلة افتراضياً، قابلة للتعطيل، مع fallback سليم

---

## Phase 5: User Story 3 — أولوية المحتوى المسحوب مسبقاً (Priority: P3)

**Goal**: تعديل السكرابر ليفحص المخزن المحلي أولاً، مع auto-heal للمحتوى التالف.

**Independent Test**: تشغيل السكرابر على مقال موجود في `scraped/` — لا يجب أن يُجري أي طلب شبكي. ثم تشغيله على ملف تالف (invalid JSON) — يجب أن يُعاد السحب ويُحدَّث الملف المحلي.

### Implementation for User Story 3

- [x] T026 [US3] Add `try_load_cache(path: Path) -> dict | None` function to `scraper/scraper.py` — يُحمَّل JSON، يتحقق أن `len(content) > 200`، يُعيد `None` إذا تالف أو ناقص
- [x] T027 [US3] Refactor `scrape_article()` in `scraper/scraper.py` to implement cache-first logic: (1) بناء `cache_path` من `slug`، (2) إذا `force=False` → جرّب `try_load_cache`، (3) إذا `None` → احذف الملف التالف وأعد السحب، (4) احفظ النتيجة محلياً دائماً
- [x] T028 [US3] Add `--force-scrape` CLI flag to `scraper/scraper.py` argument parser — يُمرَّر كـ `force=True` لـ `scrape_article()`
- [x] T029 [P] [US3] Write unit test for `try_load_cache()` in `tests/lib/scraper-cache.test.ts` (أو `scraper/test_scraper.py` حسب الـ convention): حالات — ملف صحيح، JSON تالف، محتوى ناقص (`< 200` حرف)، ملف غير موجود
- [x] T030 [P] [US3] Write integration test: تشغيل `scrape_article()` على URL لمقال موجود محلياً — لا شبكة، النتيجة من الـ cache
- [x] T031 [US3] Write integration test: تشغيل `scrape_article()` على URL لملف تالف — يُعاد السحب، يُحدَّث الملف المحلي، يُعاد الاتصال بالشبكة مرة واحدة فقط
- [x] T032 [US3] Verify scraper tests PASS — run `python -m pytest scraper/` أو الـ test runner المستخدم

**Checkpoint**: ✅ US3 مكتملة — السكرابر cache-first مع auto-heal

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: تحسينات تمس جميع القصص والتحقق النهائي

- [x] T033 [P] Fix double comma in FR-011 in `specs/008-translation-polish/spec.md` (السطر 95: `خيار مخصص، ،` → `خيار مخصص`)
- [x] T034 [P] Update `data/protected-terms.json` — مراجعة القائمة الابتدائية وإضافة مصطلحات الموقع الخاصة التي ظهرت في المقالات المترجمة حتى الآن
- [x] T035 Run full test suite and verify no regressions — `npx vitest run`
- [x] T036 Run lint check — `npx next lint` — zero new errors
- [x] T037 [P] Update `ARCHITECTURE.md` أو docs ذات الصلة لتوثيق Phase 4 وبنية الـ pipeline المحدَّثة
- [x] T038 Manual smoke test: ترجمة مقال حقيقي من `tastes of cinema` بـ `polishEnabled: true` ومراجعة النتيجة — أسلوب أنيق + لا رموز + أسماء أفلام محفوظة

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  → لا تبعيات — يبدأ فوراً

Phase 2 (Foundational)
  → يعتمد على اكتمال Phase 1
  → يُوقف كل User Stories حتى اكتماله

Phase 3 (US1 - P1)
  → يعتمد على Phase 2
  → MVP — أعلى أولوية

Phase 4 (US2 - P2)
  → يعتمد على Phase 2
  → يُكمِّل Phase 3 لكن مستقل عنه

Phase 5 (US3 - P3)
  → يعتمد على Phase 2
  → مستقل تماماً عن US1 وUS2

Phase 6 (Polish)
  → يعتمد على اكتمال US1 + US2 + US3
```

### User Story Dependencies

| القصة | تعتمد على | مستقلة؟ |
|-------|-----------|---------|
| US1 (إزالة رموز) | Phase 2 فقط | ✅ مستقلة |
| US2 (إعادة صياغة) | Phase 2 + T001 | ✅ مستقلة عن US1 |
| US3 (cache-first) | Phase 2 فقط | ✅ مستقلة تماماً |

### Within Each User Story

```
Models/Types (T002-T004) → قبل أي implementation
Foundational فns (T006-T010) → قبل unit tests
Unit Tests (T011-T015) → قبل wiring في pipeline
Integration → آخراً
```

---

## Parallel Opportunities

```bash
# Phase 1: كل tasks متوازية
T001 + T002 + T003 + T004

# Phase 2: بعد T005 (audit)، T006-T010 متوازية جزئياً
T005 → T006 + T007 + T008 → T009 → T010

# Phase 3 (US1): Tests متوازية
T011 + T012 + T013 → T014 → T015

# Phase 4 (US2): Phase وUS3 يمكن تشغيلهما بالتوازي بعد Phase 2
T016 + T017 + T018 → T019 → T020 + T021 + T022
(متوازٍ مع Phase 5 / US3)

# Phase 5 (US3): ← يمكن بدأه مع US2
T026 → T027 → T028
T029 + T030 → T031 → T032
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. أكمل **Phase 1** (T001-T004) — ~30 دقيقة
2. أكمل **Phase 2** (T005-T010) — ~2 ساعة
3. أكمل **Phase 3 / US1** (T011-T015) — ~1 ساعة
4. **توقف وتحقق**: شغّل مقالاً حقيقياً وتأكد من نظافة النص
5. **MVP جاهز للاستخدام** ✅

### Incremental Delivery

1. MVP (US1) → نص نظيف في كل مقال
2. US2 → أسلوب عربي أنيق بعد الترجمة
3. US3 → ترجمات أسرع للمقالات الموجودة محلياً
4. Polish → جودة واستقرار

### Parallel Team Strategy

```
Developer A: Phase 1 + Phase 2 + US1 (T001-T015)
Developer B: US2 (T016-T025) — بعد Phase 2
Developer C: US3 (T026-T032) — مستقل تماماً
```

---

## Notes

- **[P]** = ملفات مختلفة، لا تبعيات على tasks غير مكتملة
- **[US1/2/3]** = ربط Task بقصة المستخدم للتتبع
- كل POST-PROCESSING function في `translate.ts` يجب أن تكون `export` لتسهيل الاختبار
- `protected-terms.json` يُقرأ عند كل pipeline call — لا caching مطلوب (الملف صغير)
- `scraper.py` — الـ cache corruption detection بسيط عمداً (YAGNI): JSON valid + minimum length
- تجنب: تعقيد الـ prompt لـ Phase 4 أكثر من اللازم — البساطة تُعطي نتائج أفضل
