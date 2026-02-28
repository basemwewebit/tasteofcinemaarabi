# Implementation Plan: Movie Trailer Discovery & Embedding

**Branch**: `005-trailer-embed` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-trailer-embed/spec.md`

## Summary

Extend the article translation pipeline to automatically discover movie trailers via the existing OpenRouter AI service, validate URLs via oEmbed, store trailer metadata in a new `article_trailers` SQLite table, auto-insert `<TrailerEmbed>` tags into MDX content, and render them as cinema-themed, lazy-loaded video facades on the public site. Admin can manage trailers in the article editor with manual URL paste/override.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 15.5 (App Router, Turbopack)
**Primary Dependencies**: next-mdx-remote 6.x (RSC), better-sqlite3, openai SDK 6.x (OpenRouter), cheerio, lucide-react
**Storage**: SQLite via better-sqlite3 (existing); new `article_trailers` table + MDX files on disk
**Testing**: Vitest 4.x with jsdom environment, @vitejs/plugin-react
**Target Platform**: Linux server (Node.js), browsers (desktop + mobile)
**Project Type**: Web application (Next.js App Router — server + client components)
**Performance Goals**: Lighthouse ≥ 90, LCP < 2.5s, CLS = 0 from trailer embeds (facade pattern)
**Constraints**: No separate YouTube API key (AI-driven discovery); CSP must allow YouTube/Vimeo iframes; trailers must not block translation pipeline
**Scale/Scope**: ~600 scraped articles, 1-5 imports/day, up to 10 trailers per article

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Arabic-First, Cinema-Native | ✅ PASS | RTL layout for all trailer UI. Movie titles in English per existing convention. Arabic fallback text for unavailable videos. |
| II | Source Integrity | ✅ N/A | Trailers are supplementary embeds from YouTube/Vimeo, not source content. No attribution impact. |
| III | Cinematic Editorial Identity | ✅ PASS | Custom cinema-themed facade (Noir & Gold palette, no purple). No generic iframe embeds. Must pass "Template Test." |
| IV | Content Quality Over Quantity | ✅ PASS | Trailers auto-insert as draft content; admin reviews before publish. Existing draft→publish workflow preserved. |
| V | Performance is Respect | ✅ PASS | Facade pattern (thumbnail + play button, no iframe until click). Lazy loading via Intersection Observer. Zero CLS from reserved dimensions. |
| VI | Monetization Without Compromise | ✅ PASS | Trailer embeds don't interfere with predefined ad slots. Reserved dimensions prevent CLS. |
| VII | Accessibility | ✅ PASS | Play button keyboard-accessible with aria-label. Respect prefers-reduced-motion. Semantic HTML. |
| VIII | Dev Standards | ✅ PASS | TypeScript strict. CSS Modules for styling. TrailerEmbed is Client Component (justified: requires click interaction + state for facade→iframe swap). |
| IX | CSP Change | ⚠️ ATTENTION | Must add `frame-src` for YouTube/Vimeo domains to next.config.ts. Security-surface expansion, not a violation. |

**Gate result: PASS** — No violations. One tracked configuration change (CSP).

## Project Structure

### Documentation (this feature)

```text
specs/005-trailer-embed/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── oembed-api.md    # oEmbed validation contract
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (site)/article/[slug]/page.tsx          # MODIFY: register TrailerEmbed with MDXRemote
│   ├── (admin)/articles/[id]/edit/page.tsx      # MODIFY: add trailer management sidebar
│   └── api/articles/[id]/
│       ├── route.ts                             # MODIFY: handle trailer data in article API
│       └── trailers/
│           └── route.ts                         # NEW: trailer CRUD API (GET/POST/DELETE)
├── components/ui/
│   ├── TrailerEmbed.tsx                         # NEW: cinema-themed video facade (Client Component)
│   └── TrailerEmbed.module.css                  # NEW: styling for trailer embed
├── lib/
│   ├── ai/translate.ts                          # MODIFY: extend prompt to request trailer URLs
│   ├── db/trailers.ts                           # NEW: article_trailers CRUD operations
│   ├── scraper/pipeline.ts                      # MODIFY: add trailer discovery + validation stage
│   └── trailers/
│       ├── validate.ts                          # NEW: oEmbed URL validation
│       └── insert.ts                            # NEW: auto-insert TrailerEmbed tags into MDX
├── types/scraper.ts                             # MODIFY: add 'discovering-trailers' status
data/schema.sql                                   # MODIFY: add article_trailers table
next.config.ts                                    # MODIFY: add frame-src CSP directive
tests/lib/
├── trailers/
│   ├── validate.test.ts                         # NEW: oEmbed validation tests
│   └── insert.test.ts                           # NEW: MDX tag insertion tests
└── ai/translate-trailers.test.ts                # NEW: trailer prompt extension tests
```

**Structure Decision**: Follows existing Next.js App Router layout. New files placed alongside related modules (`lib/ai/`, `lib/db/`, `components/ui/`). Trailer-specific logic isolated in `lib/trailers/` for clean testing. No new top-level directories.

## Complexity Tracking

| Item | Justification | Simpler Alternative Rejected Because |
|------|---------------|-------------------------------------|
| TrailerEmbed as Client Component (`"use client"`) | Requires click handler for facade→iframe swap + state management | Server Component cannot handle interactive play button |
| CSP `frame-src` expansion | Required for YouTube/Vimeo iframe embeds to load | No alternative — embedded videos need iframe permission |
