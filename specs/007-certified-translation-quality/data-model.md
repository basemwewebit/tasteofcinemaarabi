# Data Model: تحسين جودة الترجمة — مستوى مكتب ترجمة معتمد

**Date**: 2026-02-28 | **Branch**: `007-certified-translation-quality`

## Entities

### 1. GlossaryFile

**Description**: Version-controlled cinema terminology glossary stored as `data/glossary.json`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | Yes | Incremented on each modification |
| `updated_at` | string (ISO 8601) | Yes | Timestamp of last modification |
| `entries` | GlossaryEntry[] | Yes | Array of terminology entries |

### 2. GlossaryEntry

**Description**: A single cinema terminology mapping.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `en` | string | Yes | English term (canonical, lowercase) |
| `ar` | string | Yes | Approved Arabic translation |
| `context` | enum | No | Domain: `genre`, `technique`, `movement`, `role`, `craft`, `shot`, `structure`, `casting`, `industry`, `classification` |
| `aliases` | string[] | No | Alternative English spellings/forms |
| `added_at` | string (ISO date) | No | Date when first added |
| `source` | enum | No | `manual` or `ai_discovered` |
| `approved` | boolean | No | `false` = AI-suggested, pending human review. Default: `true` |

**Validation rules**:
- `en` must be unique (case-insensitive) within the glossary
- `en` cannot be empty or only whitespace  
- `ar` cannot be empty or only whitespace

### 3. BannedPatternsFile

**Description**: Literal translation patterns to detect and replace. Stored as `data/banned-patterns.json`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | Unique sequential identifier |
| `literal_ar` | string | Yes | The literal Arabic calque to detect |
| `natural_ar` | string | Yes | The natural Arabic alternative(s) |
| `en_source` | string | Yes | The English source phrase |
| `note` | string | No | Explanation for reviewers |

**Validation rules**:
- `id` must be unique
- `literal_ar` and `natural_ar` cannot be empty

### 4. TranslationQualityReport

**Description**: Compact quality metadata stored as JSON TEXT in articles table `quality_report` column.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `v` | number | Yes | Schema version (currently 1) |
| `ts` | string (ISO 8601) | Yes | Completion timestamp |
| `model` | string | Yes | AI model used (e.g., `google/gemini-2.5-flash-lite`) |
| `chunks` | number | Yes | Number of chunks article was split into |
| `phases.translate` | PhaseReport | Yes | Phase 1 metrics |
| `phases.review` | ReviewPhaseReport | Yes | Phase 2 metrics with corrections detail |
| `phases.proofread` | ProofreadPhaseReport | Yes | Phase 3 metrics with polishes detail |
| `totals.duration_ms` | number | Yes | Total pipeline duration |
| `totals.tokens_in` | number | Yes | Total input tokens across all phases |
| `totals.tokens_out` | number | Yes | Total output tokens across all phases |
| `totals.corrections` | number | Yes | Sum of all corrections + polishes |
| `totals.new_terms` | string[] | Yes | English terms discovered and added to glossary |

### 5. PhaseReport

**Description**: Metrics for a single translation phase.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | enum | Yes | `success`, `failed`, `skipped` |
| `duration_ms` | number | Yes | Phase execution time |
| `tokens_in` | number | Yes | Prompt tokens consumed |
| `tokens_out` | number | Yes | Completion tokens consumed |
| `retries` | number | Yes | Number of retry attempts (0 = first try success) |

### 6. ReviewPhaseReport extends PhaseReport

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `corrections` | number | Yes | Total corrections made |
| `by_type` | Record<string, number> | Yes | Corrections grouped by type: `grammar`, `literal_translation`, `terminology`, `style`, `omission`, `accuracy` |
| `new_terms` | number | Yes | Count of newly discovered glossary terms |

### 7. ProofreadPhaseReport extends PhaseReport

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `polishes` | number | Yes | Total polishes made |
| `by_type` | Record<string, number> | Yes | Polishes grouped by type: `flow`, `tone`, `spelling`, `punctuation`, `bidi` |

## Relationships

```
articles (existing table)
  └── quality_report: TEXT (JSON) ──→ TranslationQualityReport

data/glossary.json ──→ GlossaryFile
  └── entries[] ──→ GlossaryEntry[]

data/banned-patterns.json ──→ BannedPatternsFile[]
```

## Schema Changes

### articles table — new column

```sql
ALTER TABLE articles ADD COLUMN quality_report TEXT DEFAULT NULL;
```

**No other table changes.** The glossary and banned patterns are file-based (version-controlled), not in SQLite.

## State Transitions

### Translation Pipeline State Flow

```
IDLE → TRANSLATING (Phase 1)
  → Phase 1 success → REVIEWING (Phase 2)
  → Phase 1 failed (after retries) → FAILED

REVIEWING (Phase 2)
  → Phase 2 success → PROOFREADING (Phase 3)
  → Phase 2 failed → retry once → still failed → use Phase 1 output, mark Phase 2 "failed"

PROOFREADING (Phase 3)
  → Phase 3 success → POST-PROCESSING → COMPLETED
  → Phase 3 failed → retry once → still failed → use Phase 2 output, mark Phase 3 "failed"

POST-PROCESSING (programmatic, no AI):
  1. Restore image placeholders
  2. Restore title placeholders
  3. Convert numerals to Eastern Arabic
  4. Apply bidi isolation
  5. Clean stray placeholders
  → COMPLETED (save MDX + quality report + update glossary)
```

### GlossaryEntry approval flow

```
AI discovers new term → added with approved: false, source: ai_discovered
  → Human reviews in glossary.json
    → Approves: set approved: true
    → Rejects: remove entry
    → Modifies: update ar field, set approved: true
```
