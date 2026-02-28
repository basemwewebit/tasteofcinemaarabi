# Implementation Plan: تحسين جودة الترجمة — مستوى مكتب ترجمة معتمد

**Branch**: `007-certified-translation-quality` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-certified-translation-quality/spec.md`

## Summary

Transform the single-pass AI translation pipeline into a certified-translation-office workflow with 3 sequential AI phases (translate → review → proofread), a version-controlled cinema glossary for terminology consistency, a banned-patterns list to eliminate literal translation clichés, smart chunking for long articles (30k char threshold), bidi isolation for mixed-direction text, and a compact quality report surfaced in the admin panel.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js (no pinned version) / Next.js 15.5 + React 19  
**Primary Dependencies**: `openai` ^6.25 (pointed at OpenRouter), `better-sqlite3` ^12.6, `cheerio` ^1.2, `sharp` ^0.34  
**Storage**: SQLite via `better-sqlite3` (raw SQL, no ORM) + filesystem (MDX content, JSON glossary)  
**Testing**: Vitest 4 + jsdom, 30s timeout, OpenAI fully mocked in tests  
**Target Platform**: Linux server (Next.js App Router, Server Components by default)  
**Project Type**: Web service (full-stack Next.js with admin CMS)  
**AI Provider**: OpenRouter (`google/gemini-2.5-flash-lite` via `OPENROUTER_MODEL` env var)  
**Performance Goals**: Translation quality > translation speed. 3x API calls acceptable per spec clarification.  
**Constraints**: 30,000 char chunking threshold. OpenRouter token limits per model. No auto-publish (editorial review required by constitution).  
**Scale/Scope**: ~200+ scraped articles, single admin user, translation pipeline processes 1 article at a time.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Arabic-First, Cinema-Native | ✅ PASS | Feature is entirely about Arabic translation quality. RTL bidi isolation (FR-011) addresses RTL-first. |
| II | Source Integrity (NON-NEGOTIABLE) | ✅ PASS | No change to attribution. Original URLs, author names preserved. Film titles stay in original language. |
| III | Cinematic Editorial Identity | ✅ PASS | Style guide (FR-007) explicitly targets "premium cinema magazine" tone. |
| IV | Content Quality Over Quantity | ✅ PASS | Core alignment — this feature IS about quality. Draft→Review→Publish workflow untouched. Human review still required. |
| V | Performance is Respect | ✅ PASS | No frontend impact. Translation is server-side background process. No bundle size change. |
| VI | Monetization Without Compromise | ✅ PASS | No ad-related changes. |
| VII | Accessibility is Universal | ✅ PASS | Bidi isolation (FR-011) improves screen reader behavior for mixed-direction text. |
| Dev | TypeScript strict, CSS Modules, Server Components | ✅ PASS | All changes are in `src/lib/` (server-side). No new client components. Tests required for translation pipeline. |
| Dev | Parameterized SQL, conventional commits | ✅ PASS | Schema changes (quality report columns) will use parameterized statements. |

**GATE RESULT: ALL PASS** — no violations to justify. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/007-certified-translation-quality/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── translate-api.md # Updated POST /api/translate contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── ai/
│       ├── translate.ts           # MODIFY: 3-phase pipeline, chunking, bidi
│       ├── prompts/               # NEW: modular prompt templates
│       │   ├── phase1-translate.ts
│       │   ├── phase2-review.ts
│       │   └── phase3-proofread.ts
│       └── glossary.ts            # NEW: glossary loader + updater
├── app/
│   └── api/
│       └── translate/
│           └── route.ts           # MODIFY: quality report in response
├── types/
│   └── api.ts                     # MODIFY: TranslateResponse + quality report
data/
├── schema.sql                     # MODIFY: add quality_report column
├── glossary.json                  # NEW: cinema terminology glossary
├── style-guide.ts                 # NEW: editorial rules as typed config
└── banned-patterns.json           # NEW: literal translation blacklist

tests/
└── lib/
    └── ai/
        ├── translate.test.ts      # MODIFY: add multi-phase tests
        ├── glossary.test.ts       # NEW: glossary loading + update tests
        └── chunking.test.ts       # NEW: content splitting tests
```

**Structure Decision**: Existing single-project Next.js structure. All changes fit within `src/lib/ai/` (translation engine) and `data/` (glossary + banned patterns). No new packages, no new projects. Prompt templates extracted to `src/lib/ai/prompts/` for maintainability.
