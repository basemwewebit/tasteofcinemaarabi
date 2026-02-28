# Phase 0: Research & Technical Decisions

**Feature**: Cinema CMS Foundation

## Overview
This document outlines the technical choices and research conclusions based on the `PLAN-cinema-cms.md` definition. Since the technical stack was highly specified, this validates the chosen approaches against the user requirements.

## Decisions

### 1. Framework: Next.js 15 (App Router)
- **Decision**: Use Next.js 15 with the App Router.
- **Rationale**: Provides exceptional SEO capabilities which are crucial for a content platform. React Server Components minimize the client-side JavaScript payload, meeting the strict "Performance is Respect" constitution requirement (Lighthouse >= 90). The built-in API routing allows for seamless integration of the AI translation pipeline without a separate backend service.
- **Alternatives Considered**: Astro (rejected due to complex dynamic admin panel requirements), standard React SPA (rejected due to poor SEO).

### 2. Styling: Vanilla CSS Modules & Custom Properties
- **Decision**: NO TailwindCSS, use pure CSS Modules and generic CSS Custom Properties.
- **Rationale**: Enforces the "Cinematic Editorial Brutalism" identity by forcing bespoke styling rather than risking generic, template-like appearances from utility classes. Ensures native RTL support using CSS logical properties (`margin-inline-start`, etc.).
- **Alternatives Considered**: TailwindCSS (explicitly rejected by Constitution to avoid template-clichés), Styled Components (rejected due to runtime performance overhead).

### 3. Database: SQLite (`better-sqlite3`)
- **Decision**: SQLite for relational data management.
- **Rationale**: The platform is read-heavy for the public, which Next.js can heavily cache (SSG/ISR). Write operations (content creation, comments) are low-concurrency. SQLite is extremely fast for this use case, zero-configuration, and perfectly suited for cost-effective VPS deployments. Includes FTS5 for native full-text search.
- **Alternatives Considered**: PostgreSQL (rejected due to unnecessary operational complexity for a single-tenant editorial site).

### 4. AI Translation Pipeline: OpenAI GPT-4o
- **Decision**: OpenAI API using `gpt-4o` for content translation.
- **Rationale**: Provides the best cultural adaptation and nuanced Arabic translation necessary for "quality over quantity". Capable of following complex prompts to retain markdown structures, numbered lists, and handle English terminology transliteration correctly.

### 5. Content Storage: Markdown (MDX) + SQLite
- **Decision**: Dual storage (Metadata in SQLite, body in MDX files).
- **Rationale**: Combines the portability and version-controllability of Markdown for the actual article bodies with the querying flexibility of a relational database for archives, categories, and fast lookups.
