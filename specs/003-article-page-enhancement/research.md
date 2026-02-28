# Research: Article Page Enhancement

**Feature**: 003-article-page-enhancement  
**Date**: 2026-02-28  
**Status**: Complete — all unknowns resolved

---

## R1: Featured Image Extraction from Source HTML

**Decision**: Use a waterfall of selectors — prioritize `og:image` meta tag, fall back to first `<img>` in `.entry-content`, then `img.wp-post-image`.

**Rationale**: tasteofcinema.com is a WordPress site. WordPress SEO plugins (Yoast/RankMath) always populate the `og:image` meta tag with the canonical featured image URL. This is the most reliable source across theme variations. The `.entry-content img:first` fallback is verified by both sample MDX files in the repo, which show the first image is always the hero image with `fetchPriority="high"` and class `wp-image-XXXXX`.

**Alternatives considered**:
- `.wp-post-image` class — less reliable because some themes render the featured image inside `.entry-content` without this class
- CSS class `size-full` or `aligncenter` — too generic, could match non-hero images

**Implementation**:
```typescript
const featuredImage =
    $('meta[property="og:image"]').attr('content') ||
    $('.entry-content img').first().attr('src') ||
    $('img.wp-post-image').first().attr('src') ||
    '';
```

Resolve relative URLs against the base URL via `new URL(featuredImage, url).toString()` before storing.

---

## R2: Movie Title Extraction Patterns

**Decision**: Two-pass extraction from structured HTML markup.

**Rationale**: tasteofcinema.com articles are listicle-format. Movie titles follow two identifiable patterns:

1. **Numbered headings** — `<h2>`, `<h3>`, or `<p><span>` elements within `.entry-content` matching `/^\d+[\.\)]\s+(.+)/`. These are the primary entries in ranked lists.
2. **Inline emphasis** — `<em>`, `<strong>` tags within body paragraphs containing short text (< 80 chars) that is likely a movie title reference.

Both patterns are confirmed by the content files in the repo (`content/*.mdx`) and the existing test fixture (`tests/lib/scraper.test.ts`).

**Alternatives considered**:
- External film database lookup (IMDB API) — too slow, adds external dependency, rate-limited
- NLP-based named entity recognition — over-engineered for structured listicle content
- Manual title list per article — doesn't scale, defeats automation

**Implementation**: See `extractMovieTitles()` function in data-model.md.

---

## R3: Movie Title Protection During Translation

**Decision**: Placeholder substitution (Option B).

**Rationale**: The AI translation model (GPT-4o via OpenRouter) must never see the original title text to guarantee 0% translation. Placeholder substitution replaces each title with an opaque token (`[[TITLE_1]]`) before the prompt is sent. The AI has no text to transliterate — it can only output the token as-is. After translation, tokens are restored to originals.

**Alternatives considered**:
- **Prompt-only (Option A)**: ~85-90% reliability. GPT-4o sometimes "helpfully" adds transliteration even when instructed not to, especially for short titles like "Heat" or "Drive" that resemble common words. Unacceptable for SC-003's "0% translation" target.
- **Hybrid (Option C)**: Marginal benefit over pure placeholder. The prompt listing adds context-window tokens without improving reliability.

**Implementation details**:
- Sort titles by length descending before replacement (prevents "The Godfather" from matching inside "The Godfather Part II")
- Escape regex special characters in titles
- Use `[[TITLE_N]]` syntax — double brackets are visually distinct, never appear in natural text, survive markdown formatting
- Add fuzzy restore step matching `\[\[\s*TITLE_\d+\s*\]\]` as safety net for AI-modified placeholders

---

## R4: Next.js Image Component for External URLs

**Decision**: Use `next/image` with `fill` mode inside a CSS `aspect-ratio: 16/9` container. Wrap in a Client Component for `onError` handling.

**Rationale**: WordPress uploads have inconsistent dimensions (560×352, 1280×610, etc.). The `fill` + `aspect-ratio` pattern creates a consistent container shape regardless of source image dimensions, with `object-fit: cover` for graceful cropping. The Client Component is necessary because `onError` is a DOM event that cannot fire in Server Components.

**Alternatives considered**:
- `width` + `height` props — requires knowing exact dimensions at render time, which varies per image
- Pure Server Component (no onError) — handles missing URLs (FR-002) but not broken URLs (FR-003)
- `<img>` tag instead of `next/image` — loses automatic optimization (WebP, responsive srcset, lazy loading), violates constitution Principle V

**Configuration required**: Add `images.remotePatterns` for `www.tasteofcinema.com` and `tasteofcinema.com` in `next.config.ts`.

---

## R5: Article Page Design Enhancement (Arabic RTL)

**Decision**: Enhance the existing CSS Modules file with improved typography, spacing, and visual hierarchy. No new design tokens needed.

**Rationale**: The existing `article.module.css` has a solid foundation (800px max-width, serif headings, muted excerpt). Enhancements focus on:
- Increase body `line-height` from 1.8 to 1.9 for Arabic reading comfort
- Add a gradient overlay or semi-transparent overlay to the hero image for title readability
- Improve header spacing with more vertical rhythm
- Add subtle visual separation between content sections (dropcap, section dividers)
- Improve the source attribution box with a more editorial look
- Add responsive breakpoints for mobile (375px target)

**Alternatives considered**:
- Tailwind CSS — excluded by constitution's Development Standards (CSS Modules + Custom Properties only)
- Complete redesign — over-scoped; the existing layout is sound and just needs polish

**Key typography guidelines for Arabic**:
- Minimum body size: 1.125rem (currently set, meets FR-006's 1.1rem minimum)
- Minimum line-height: 1.8 (currently set, exceeds FR-006's 1.7 minimum)
- Arabic serif fonts (Amiri) for headings — already configured via `--font-serif`
- RTL direction inherited from global styles — verified in `globals.css`

---

## R6: Constitution Principle IV Deviation

**Decision**: Deviate from constitution's "transliterate + preserve original in parentheses" requirement for film names.

**Rationale**: The user explicitly requires "keep name movies on original lang and not translate." This is the superior approach for an Arabic cinema audience:
1. Arabic transliterations of film titles are non-standard (e.g., "تاكسي درايفر" vs "طاكسي درايفر")
2. International titles are how films are searched for and discussed online
3. Listicle articles with 10-25 titles become visually noisy with dual-language entries
4. Cinema-literate Arabic audiences recognize films by their international titles

**Action required**: Recommend a constitution amendment to Principle IV, changing "Film names MUST preserve the original English title alongside Arabic transliteration" to "Film names MUST be preserved in their original language without translation or transliteration."
