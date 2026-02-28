# Implementation Plan: Cinema CMS Foundation

**Branch**: `001-cinema-cms` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-cinema-cms/spec.md`

## Summary

A comprehensive Content Management System and Premium Editorial Platform for "Taste of Cinema Arabic" (مذاق السينما). The system features an AI-powered article scraping and translation pipeline (English to Arabic), fully RTL-native design using CSS Modules, and lightweight SQLite storage.

## Technical Context

**Language/Version**: TypeScript (strict)
**Primary Dependencies**: Next.js 15 (App Router), `better-sqlite3`, `cheerio`, `openai`, `next-mdx-remote`, `fuse.js`, `lucide-react`
**Storage**: SQLite (`cinema.db`) and Markdown (MDX) files for content
**Testing**: Standard Next.js testing tools (Playwright/Jest)
**Target Platform**: Linux VPS (Ubuntu) with PM2 and Nginx
**Project Type**: Web Application (Content Management System)
**Performance Goals**: Lighthouse Score ≥ 90 on all metrics, End-to-end URL to Arabic article translation in < 2 minutes
**Constraints**: strictly RTL-first layout, "Cinematic Editorial Brutalism" design, NO TailwindCSS (Vanilla CSS Custom Properties only), Self-hosted fonts
**Scale/Scope**: Core CMS functionality, Article rendering, Admin dashboard with batch AI translation processing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Arabic-First, Cinema-Native**: ✅ App logic strictly targets RTL Arabic layout.
- **Source Integrity**: ✅ Architecture includes schema fields and UI components enforcing source URL tracking and frontend attribution display.
- **Cinematic Editorial Identity**: ✅ Strict adherence to vanilla CSS custom properties, rejecting standard UI kits and templates.
- **Performance is Respect**: ✅ Next.js App Router (Server Components) and lightweight SQLite deployed on VPS.
- **Monetization without Compromise**: ✅ Structured placeholders for AdSense integrated in layouts to eliminate CLS.
- **Accessibility**: ✅ HTML semantics and contrast checks handled by manual CSS styles.

## Project Structure

### Documentation (this feature)

```text
specs/001-cinema-cms/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (will be generated next)
```

### Source Code (repository root)

```text
src/
├── app/                 # Next.js App Router (frontend + admin + api routes)
├── components/          # React components (UI, layout, articles)
├── lib/                 # Core logic (db, scraper, ai, processing)
├── hooks/               # Custom React hooks
├── styles/              # Global CSS, tokens, typography
└── types/               # TypeScript interfaces
data/                    # SQLite database and schema
content/                 # Processed Markdown (MDX) files
scripts/                 # DB setup and migration scripts
public/                  # Static assets, fonts, icons
```

**Structure Decision**: Maintained a unified Next.js App Router structure where `/app/(site)` handles the public frontend, `/app/(admin)` manages the CMS, and `/app/api/` exposes internal endpoints for the admin interface.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations identified.*
