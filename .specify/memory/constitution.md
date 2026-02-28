<!-- SYNC IMPACT REPORT
Version change: 0.0.0 → 1.0.0
Modified principles: None (initial creation)
Added sections: Core Principles (7), Content Ethics, Development Standards, Governance
Removed sections: None
Templates requiring updates:
  - plan-template.md: ✅ aligned
  - spec-template.md: ✅ aligned
  - tasks-template.md: ✅ aligned
Follow-up TODOs: None
-->

# مذاق السينما Constitution

## Core Principles

### I. Arabic-First, Cinema-Native

Every design decision, content strategy, and technical implementation MUST prioritize the Arabic-speaking cinema enthusiast. This is NOT a translated website — it is an Arabic-native editorial platform that happens to source content from English publications.
- RTL is the default, never an afterthought
- Arabic typography MUST be treated as a first-class visual element, not a font swap
- Cultural context MUST be adapted, not literally translated — film references, idioms, and cultural touchpoints are localized for Arabic audiences
- UI copy, error messages, and system text MUST be in Arabic

### II. Source Integrity (NON-NEGOTIABLE)

مذاق السينما exists because of the original work of Taste of Cinema authors. We MUST honor that relationship transparently and without exception.
- Every translated article MUST include a visible, clickable link to the original English source
- Every translated article MUST credit the original author by name
- The site footer MUST permanently acknowledge Taste of Cinema as the content source
- We MUST NOT claim original authorship of translated content
- We MUST NOT remove or hide source attribution for any reason, including design aesthetics

### III. Cinematic Editorial Identity

مذاق السينما MUST feel like a premium cinema magazine, not a generic blog or news aggregator. The design and content presentation MUST evoke the experience of cinema — dark screening rooms, golden spotlights, and editorial gravitas.
- Design choices MUST be intentional and defensible — no default templates, no generic layouts
- Typography is visual architecture — Arabic headlines are the primary design element
- Color palette ("Noir & Gold") MUST be consistently applied: deep blacks, warm whites, gold accents
- No purple, violet, or indigo colors — these are AI-generated design clichés
- Animations MUST be subtle and purposeful — spring physics, not bouncing icons
- Every page MUST pass the "Template Test": if it could be mistaken for a template, it has failed

### IV. Content Quality Over Quantity

We serve cinema enthusiasts who value depth and insight. Quantity without quality erodes trust and devalues the brand.
- AI translation MUST be reviewed by a human before publication — no auto-publish
- Draft → Review → Publish workflow is mandatory, with no shortcuts
- Translation MUST adapt cultural context, not just swap words
- Film names MUST preserve the original English title alongside Arabic transliteration
- Articles MUST maintain the analytical depth and editorial voice of the source material

### V. Performance is Respect

Slow pages disrespect the reader's time and attention. Performance is not optimization — it is a core product requirement.
- Lighthouse Performance score MUST be ≥ 90 on all pages
- Core Web Vitals (LCP, FID, CLS) MUST meet "Good" thresholds
- Ad placements MUST NOT cause layout shift (CLS contribution = 0)
- Images MUST be optimized (WebP/AVIF, responsive sizes, lazy loading)
- Fonts MUST be self-hosted to eliminate external dependency latency
- JavaScript bundle MUST be minimized — Server Components by default

### VI. Monetization Without Compromise

Google AdSense is a revenue tool, not a design element. Ads MUST coexist with the editorial experience, never dominate it.
- Ad placements MUST be strategic: predefined slots only, no dynamic injection
- Ads MUST NOT interrupt the reading flow of an article mid-sentence or mid-thought
- Ad containers MUST have reserved dimensions to prevent layout shift
- Ad loading MUST be lazy (Intersection Observer) — no blocking the initial render
- If an ad fails to load, the space MUST collapse gracefully with no visual artifacts

### VII. Accessibility is Universal

Arabic-speaking audiences include people with disabilities. Accessibility is a right, not a feature.
- WCAG 2.1 AA compliance MUST be maintained across all pages
- Color contrast ratio MUST be ≥ 4.5:1 for body text, ≥ 3:1 for large text
- All interactive elements MUST be keyboard navigable
- All images MUST have descriptive Arabic alt text
- `prefers-reduced-motion` MUST be respected — no forced animations
- Semantic HTML MUST be used throughout — no `<div>` soup

## Content Ethics

Ethical content handling is foundational to مذاق السينما's credibility and legal standing.
- Translated content MUST add value beyond mere translation — editorial voice, cultural context, and presentation quality differentiate us
- We MUST NOT scrape or translate content from sites that explicitly prohibit it
- Scraping MUST be respectful: rate-limited, with proper User-Agent identification
- We MUST NOT manipulate or misrepresent the original author's intent
- User comments MUST be moderated for spam, hate speech, and harmful content
- Newsletter subscribers MUST have clear opt-in and one-click unsubscribe

## Development Standards

Technical consistency ensures maintainability and contributor onboarding efficiency.
- TypeScript strict mode — no `any` types
- CSS Modules + CSS Custom Properties — no Tailwind, no utility-first
- Components MUST be Server Components by default (Next.js App Router)
- Client Components MUST be explicitly justified with `"use client"`
- Database queries MUST use parameterized statements — no string concatenation
- API routes MUST validate input and return consistent error formats
- Tests are required for: database queries, API routes, scraper parsing, translation pipeline
- Git commits MUST follow conventional commit format
- Environment variables MUST NOT be committed — `.env.local` is gitignored

## Governance

This constitution supersedes all other development practices for مذاق السينما. Amendments require:
1. Written justification for the change
2. Impact assessment on existing codebase
3. Version bump following semantic versioning:
   - MAJOR: Principle removal or backward-incompatible redefinition
   - MINOR: New principle or materially expanded guidance
   - PATCH: Clarifications, wording refinements
4. Update to all dependent templates and documentation
5. Documentation in SYNC IMPACT REPORT (top of this file)

All code reviews MUST verify compliance with these principles. Complexity MUST be justified against the relevant principle. Use `docs/PLAN-cinema-cms.md` for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-02-28 | **Last Amended**: 2026-02-28
