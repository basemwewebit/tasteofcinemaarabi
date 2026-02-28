# Quickstart: تحسين جودة الترجمة — مستوى مكتب ترجمة معتمد

**Branch**: `007-certified-translation-quality`

## Prerequisites

- Node.js installed
- `OPENROUTER_API_KEY` set in `.env.local`
- `OPENROUTER_MODEL` set in `.env.local` (default: `google/gemini-2.5-flash-lite`)
- SQLite database initialized (`npm run db:migrate`)

## Quick Verification

After implementing the feature, verify it works with these steps:

### 1. Run the DB migration

```bash
# Apply the quality_report column migration
npm run db:migrate
```

### 2. Verify glossary and banned patterns exist

```bash
# Check files are present and valid JSON
node -e "const g = require('./data/glossary.json'); console.log(g.entries.length + ' glossary entries')"
node -e "const b = require('./data/banned-patterns.json'); console.log(b.length + ' banned patterns')"
```

Expected output:
```
35 glossary entries
25 banned patterns
```

### 3. Run unit tests

```bash
npx vitest run tests/lib/ai/translate.test.ts
npx vitest run tests/lib/ai/glossary.test.ts
npx vitest run tests/lib/ai/chunking.test.ts
```

### 4. Test translation via API

```bash
curl -X POST http://localhost:3000/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.tasteofcinema.com/test",
    "title": "10 Essential Film Noir Movies",
    "content": "<p>Film noir is a cinematic genre...</p>",
    "movieTitles": ["Double Indemnity", "The Third Man"]
  }'
```

Expected: Response includes `quality_report` with all 3 phases showing `status: "success"`.

### 5. Verify quality report in admin

Navigate to the admin panel → Articles → select an article translated with the new pipeline. The quality report summary should show:
- Phase statuses (3 green checkmarks for success)
- Correction count
- Any newly discovered terms

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai/translate.ts` | Core 3-phase translation pipeline |
| `src/lib/ai/prompts/phase1-translate.ts` | Phase 1 prompt builder |
| `src/lib/ai/prompts/phase2-review.ts` | Phase 2 prompt builder |
| `src/lib/ai/prompts/phase3-proofread.ts` | Phase 3 prompt builder |
| `src/lib/ai/glossary.ts` | Glossary loader, filter, and updater |
| `data/glossary.json` | Cinema terminology glossary |
| `data/banned-patterns.json` | Literal translation blacklist |
| `src/types/api.ts` | Type definitions (TranslateResponse, QualityReport) |
| `data/schema.sql` | DB schema with quality_report column |

## Architecture Overview

```
POST /api/translate
  │
  ▼
translateArticle(req)
  │
  ├── extractImages(html) → [IMAGE_N] markers
  ├── insertPlaceholders(content, movieTitles) → [[TITLE_N]] markers
  ├── loadGlossary() → filter relevant terms
  ├── splitIntoChunks(content) → if > 30K chars
  │
  │  For each chunk:
  │  ├── Phase 1: Translate (temp 0.3) — English + glossary + style guide → Arabic
  │  ├── Phase 2: Review (temp 0.15) — English + Arabic + banned patterns → corrections + corrected text
  │  └── Phase 3: Proofread (temp 0.1) — Arabic only → final polished text
  │
  ├── Post-processing (programmatic):
  │   ├── restorePlaceholders() → film titles
  │   ├── restoreImages() → markdown images
  │   ├── toEasternArabicNumerals() → ٠١٢٣٤٥٦٧٨٩
  │   └── applyBidiIsolation() → \u2068...\u2069
  │
  ├── addDiscoveredTerms() → glossary.json (approved: false)
  ├── buildQualityReport() → JSON
  │
  ▼
Save MDX + DB metadata + quality_report
```
