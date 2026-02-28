# Research: Article Scraper & Premium UI Redesign

**Branch**: `001-article-scraper` | **Phase**: 0 | **Date**: 2026-02-28

---

## R-001: Image Download & WEBP Conversion

**Decision**: Use the already-installed `sharp` package (implied by Next.js ecosystem) for server-side WEBP conversion at quality 60.

**Findings**:
- `sharp` is the de-facto Node.js image processing library, used by Next.js `<Image>` internally.
- It supports WEBP output with a `quality` parameter (0–100). Quality 60 will typically produce 50–70% file size reduction vs. JPG source.
- For images where WEBP output is *larger* than the original (rare with PNGs), we should keep the WEBP regardless — consistency of format outweighs edge-case size savings at this stage.
- `sharp` is NOT yet in `package.json` and must be added as a production dependency.

**Rationale**: Installing `sharp` is the minimal-change option. The existing scraper (`tasteofcinema.ts`) already fetches HTML; we extend it to also fetch and convert image buffers.

**Alternatives Considered**:
- `jimp` — Pure JS, no native binaries needed, but 3–5× slower and larger bundle. Rejected.
- Cloudinary/imgix — External SaaS, unnecessary dependency and cost. Rejected.
- Next.js `<Image>` auto-optimization — Only works for images served via Next.js at runtime, not for archiving locally. Rejected for this use case.

---

## R-002: Multi-Page Pagination Strategy

**Decision**: The existing scraper already handles pagination via `.pagination .next` link traversal. The core logic is sound and already implemented.

**Findings**:
- `tasteofcinema.ts` already implements: fetch page 1 → extract `.pagination .next` href → loop until no next link.
- Tested against the example URL: `https://www.tasteofcinema.com/2026/all-25-best-picture-winners-of-the-21st-century-ranked-from-worst-to-best/` — this article has multiple pages following the `/2/`, `/3/` pattern.
- The "rewind to page 1" behavior (FR spec) needs to be added: if the input URL already contains `/2/` or higher, strip to base URL before starting.
- **Gap**: Scraper does not currently extract **inline images** from article body content — it only extracts `featuredImage`. This is the primary new work needed.

**Rationale**: Build on the existing scraper, not rewrite it.

**Alternatives Considered**:
- Playwright/Puppeteer for JS-rendered content — tasteofcinema.com is server-rendered WordPress, Cheerio is sufficient. Rejected.

---

## R-003: Image Storage Strategy

**Decision**: Store images at `/public/images/articles/{article-slug}/{sequential-index}-{original-filename-slugified}.webp`.

**Findings**:
- `/public/` in Next.js is the correct location for static assets served at the root URL.
- Organizing by article slug prevents filename collisions across articles (edge case from spec).
- Sequential index prefix (e.g., `01-`, `02-`) ensures stable ordering and avoids collisions when two images have the same filename.
- On re-scrape (overwrite mode), the entire `/public/images/articles/{slug}/` directory should be deleted and recreated — guarantees no orphaned files (SC-007).

**Rationale**: Simple filesystem approach. No database per-image records needed initially; the article markdown will reference local paths.

**Alternatives Considered**:
- Separate `ArticleImage` DB table — adds complexity without benefit at this stage. Deferred.
- Storing in `content/` — Not served by Next.js as static assets. Rejected.

---

## R-004: Configurable Scrape Delay (Admin Settings)

**Decision**: Store the delay setting in a `settings` table in SQLite, readable/writable via an admin API route. Default: 2 seconds.

**Findings**:
- Project already uses `better-sqlite3`. A simple key-value `settings` table (key TEXT, value TEXT) is the lowest-friction approach.
- The scraper reads the setting at invocation time from the DB.
- The admin panel exposes a settings form (new UI) to adjust delay without code changes.

**Rationale**: Consistent with existing DB-first approach. No env-var juggling.

**Alternatives Considered**:
- `.env.local` variable — Not editable at runtime by admin. Rejected.
- JSON config file — Requires file write permissions, awkward in production. Rejected.

---

## R-005: Auto-Translation Trigger

**Decision**: After successful scrape + image processing, call the existing translation API endpoint internally (server-to-server via `internal fetch` or direct function call from the same Node.js process).

**Findings**:
- `src/app/api/translate/` already exists. The translation pipeline is already implemented.
- The cleanest approach: after `scrapeArticle()` completes and images are saved, call `triggerTranslation(articleId)` directly as a function (not HTTP) to avoid unnecessary network hops.
- ScrapeJob status progresses: `pending → scraping → processing-images → translating → completed`.
- If translation fails, the article remains in `draft` status — admin can retry translation separately without re-scraping.

**Rationale**: Reuse existing translation infrastructure. No new services needed.

**Alternatives Considered**:
- Queue-based (BullMQ, etc.) — Over-engineering for current scale. Deferred.
- Webhook — Adds network complexity. Rejected.

---

## R-006: Article Page UI — Typography & Design System

**Decision**: Extend the existing CSS Modules + CSS Custom Properties system. Use `Noto Naskh Arabic` for Arabic body text and `Noto Serif` for mixed English/Arabic headings. Apply "Noir & Gold" color system from the constitution.

**Findings**:
- Constitution mandates: CSS Modules + CSS Custom Properties only (no Tailwind). Already in use.
- Constitution mandates: Noir & Gold palette — deep blacks, warm whites, gold accents.
- No purple/violet/indigo — explicitly banned by constitution.
- Article page (`article.module.css`) exists but lacks: featured image hero treatment, numbered-item visual distinction, proper Arabic line-height (`line-height: 1.9` is the Arabic typography standard).
- Google Fonts `Noto Naskh Arabic` is the gold-standard Arabic editorial font.

**Rationale**: Minimum-invasive extension of existing styles to maintain consistency.

---

## R-007: Landing Page — Editorial Masonry Grid

**Decision**: Implement the grid using CSS Grid with `grid-template-areas` for the hero + masonry arrangement. No JS masonry library needed.

**Findings**:
- Modern CSS Grid can achieve a masonry-like layout using `grid-template-columns: repeat(3, 1fr)` with the hero spanning `grid-column: 1 / -1`.
- True CSS masonry (`masonry` value for `grid-template-rows`) is not yet universally supported — use a defined grid template instead for reliability.
- Current `page.tsx` already has the correct hero/remaining logic — the structural code exists. Needs CSS upgrade and thumbnail image display (currently `<div className={styles.cardImage} />` is an empty placeholder).
- Thumbnail images from `article.featured_image` must be rendered in `<Image>` (Next.js) for automatic lazy loading.

**Rationale**: No new dependencies. Pure CSS Grid solution is performant and maintainable.

---

## Summary of Dependencies to Add

| Package | Reason | Type |
|---------|--------|------|
| `sharp` | Server-side WEBP image conversion | Production |

No other new production dependencies are required. All other needs are met by the existing stack.

---

## Constitution Compliance Check

| Principle | Status |
|-----------|--------|
| Arabic-First (RTL, typography) | ✅ Plan explicitly addresses RTL and Noto Arabic fonts |
| Source Integrity (attribution link) | ✅ Already implemented in article page `sourceBox` — preserved |
| Cinematic Editorial Identity (Noir & Gold, no purple) | ✅ Palette enforced; masonry grid is custom, not template |
| Content Quality (Draft → Review workflow) | ✅ Auto-translate produces `draft` status — human review before publish |
| Performance (Lighthouse ≥ 90) | ⚠️ Spec says ≥ 85 — **Constitution requires ≥ 90**. Plan targets 90. |
| Monetization (AdSense slots, no layout shift) | ✅ Existing AdSlot components preserved in redesign |
| Accessibility (WCAG 2.1 AA) | ✅ Addressed in article page redesign tasks |
| Dev Standards (TypeScript strict, CSS Modules, Server Components) | ✅ All new code follows these standards |
| Rate limiting / scrape politeness | ✅ Configurable delay (FR-015) + User-Agent already set in scraper |

> ⚠️ **Gate Note**: SC-004 in the spec says Lighthouse ≥ 85, but the Constitution mandates ≥ 90. **The implementation plan targets 90** (constitution wins). SC-004 will be documented as a constitution-override in tasks.
