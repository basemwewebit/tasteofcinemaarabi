# Research: تحسين جودة الترجمة — مستوى مكتب ترجمة معتمد

**Date**: 2026-02-28 | **Branch**: `007-certified-translation-quality`

## Research Topics & Findings

### 1. Multi-Phase LLM Translation Pipeline Architecture

**Decision**: 3-phase sequential pipeline — each phase as a separate `chat.completions.create` call.

**Rationale**: Mirrors certified translation office workflow. Each phase has a distinct role with different inputs/outputs, temperature, and evaluation criteria. Separating phases enables per-phase monitoring (FR-003) and the quality report (FR-013).

**Alternatives considered**:
- Single mega-prompt with "translate then review yourself" instruction → rejected: models don't effectively self-critique in the same context window
- 2 phases (translate + combined review/proofread) → rejected: loses per-phase visibility and merges analytical (review) with mechanical (proofread) tasks

**Phase architecture**:

| Phase | Input | Output | Temperature | Role |
|-------|-------|--------|-------------|------|
| **1: Translate** | English source + glossary + style guide | Full Arabic MDX (JSON) | 0.3 | Creative rewording for natural Arabic |
| **2: Review** | English source + Phase 1 Arabic + banned patterns + glossary | Corrected Arabic + structured corrections list + new terms | 0.15 | Analytical error detection |
| **3: Proofread** | Phase 2 Arabic only (no English) | Final polished Arabic + polish summary | 0.1 | Mechanical surface cleanup |

**Key design decisions**:
- Phase 2 receives BOTH English original and Arabic translation — reviewer needs source to check faithfulness
- Phase 3 receives ONLY Arabic — forces reader-perspective polish, catches awkwardness invisible when source is visible
- Review outputs structured corrections JSON alongside corrected text — enables quality report without diffing
- Temperature decreases across phases: creativity (0.3) → analysis (0.15) → deterministic polish (0.1)

---

### 2. Content Chunking for Long Articles

**Decision**: Split at heading boundaries with context envelope, no overlap. Threshold: 30,000 characters.

**Rationale**: Most articles (numbered lists like "10 Essential Films...") have natural `<h2>`/`<h3>` boundaries. Overlap wastes tokens and creates deduplication complexity.

**Alternatives considered**:
- Overlapping chunks (500 char overlap) → rejected: creates duplicate content requiring post-dedup, wastes tokens
- Fixed-size splitting → rejected: can cut mid-sentence, loses structural coherence
- Send entire article regardless of length → rejected: truncation silently drops content (current bug)

**Splitting hierarchy**:
1. If ≤ 30,000 chars → single chunk (no split)
2. Split at `<h2>` boundaries first
3. If any section still > 30,000 → split at `<h3>` within it
4. If still too large → split at `<p>` boundaries
5. Merge adjacent tiny chunks to avoid excessive API calls

**Context envelope between chunks** (instead of overlap):
- Article title + 2-3 sentence summary (generated once before chunking)
- Last paragraph of previous translated chunk (tone continuity)
- Full glossary (same for all chunks)
- Chunk position indicator ("الجزء ٢ من ٤")
- Established translations map (terms translated in prior chunks)

---

### 3. Arabic-Specific Translation Quality

**Decision**: Combine 25-entry banned patterns list + 35-entry cinema glossary + programmatic number formatting + programmatic bidi isolation.

**Rationale**: LLMs are unreliable for number formatting and bidi markers — these are better handled programmatically. The glossary and banned patterns are best enforced via prompt injection.

#### Banned Patterns (25 entries)
Stored in `data/banned-patterns.json`. Each entry:
```json
{ "id": 1, "literal_ar": "لعب دوراً", "natural_ar": "أدّى دوراً", "en_source": "played a role", "note": "..." }
```

Key patterns: "لعب دوراً" → "أدّى دوراً", "في نهاية اليوم" → "في نهاية المطاف", "يأخذ مكاناً" → "يحدث/يقع", "عندما يأتي الأمر إلى" → "فيما يخصّ", "واحد من أفضل" → "من أبرز/من أجود"

#### Cinema Glossary (35 entries)
Stored in `data/glossary.json`. Each entry:
```json
{ "en": "film noir", "ar": "الفيلم الأسود", "context": "genre", "approved": true }
```

Covers genres, techniques, movements, roles, shot types, and structural terms.

#### Number Formatting
**Programmatic post-processing** (not LLM) — convert 0-9 to ٠-٩. Skip numbers inside `[IMAGE_N]`, `[[TITLE_N]]`, URLs, and code blocks.

#### Bidi Isolation
**Unicode First Strong Isolate (`\u2068`) + Pop Directional Isolate (`\u2069`)** wrapped around embedded Latin text. Applied programmatically in post-processing. Chosen over `<bdi>` HTML tags because: works in plain text (RSS, social shares), no DOM overhead, MDX-compatible.

---

### 4. Glossary Management in LLM Prompts

**Decision**: Inject in system message as markdown table; filter to relevant terms per article; max ~200 terms.

**Rationale**: System message gives glossary persistent authority across conversation turns. Markdown table is compact and readable by all major models.

**Alternatives considered**:
- User message inline → rejected: gets mixed with content, weaker instruction-following
- Few-shot examples → rejected: extremely expensive (5-10 full examples needed for glossary enforcement)
- Separate tool/function call → rejected: unnecessary complexity, works fine as prompt context

**Key implementation details**:
- Filter glossary to only terms present in source article before injection → saves tokens
- Beyond ~200 terms, instruction-following degrades → filter is essential for future growth
- New terms discovered by Phase 2 review → written to `glossary.json` with `approved: false`
- Human reviews `approved: false` entries before they become authoritative

**Glossary file schema**:
```json
{
  "version": 1,
  "updated_at": "2026-02-28T00:00:00Z",
  "entries": [{ "en": "...", "ar": "...", "context": "...", "approved": true, "source": "manual" }]
}
```

---

### 5. Translation Quality Report

**Decision**: Compact JSON stored in `quality_report` TEXT column on articles table; summary displayed in admin panel.

**Rationale**: JSON TEXT column is queryable with SQLite `json_extract()`, requires only one schema migration, and the compact format stores everything needed for the admin summary view.

**Alternatives considered**:
- Separate `translation_phases` table → rejected: over-normalized for a single-reader admin UI
- Log files → rejected: not queryable, not accessible from admin panel
- Redis/memory only → rejected: not persistent, lost on restart

**Quality report schema**:
```json
{
  "v": 1,
  "ts": "ISO timestamp",
  "model": "google/gemini-2.5-flash-lite",
  "chunks": 1,
  "phases": {
    "translate": { "status": "success", "duration_ms": 12400, "tokens_in": 4200, "tokens_out": 5100, "retries": 0 },
    "review": { "status": "success", "duration_ms": 8900, "corrections": 7, "by_type": { "literal_translation": 3, "grammar": 2 }, "new_terms": 2 },
    "proofread": { "status": "success", "duration_ms": 6100, "polishes": 4, "by_type": { "flow": 2, "bidi": 1 } }
  },
  "totals": { "duration_ms": 27400, "corrections": 11, "new_terms": ["diegetic sound", "MacGuffin"] }
}
```

**Schema migration**: `ALTER TABLE articles ADD COLUMN quality_report TEXT DEFAULT NULL;`

**Token counting**: Captured from `aiResponse.usage.prompt_tokens` / `completion_tokens` returned by OpenAI SDK.

---

## Summary of All Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| Pipeline phases | 3 separate API calls | Per-phase monitoring, mirrors translation office |
| Phase 2 input | English + Arabic | Faithfulness checking requires source |
| Phase 3 input | Arabic only | Reader-perspective polish |
| Temperatures | 0.3 → 0.15 → 0.1 | Decreasing creativity as pipeline narrows |
| Chunking | Split at headings, 30K threshold | Natural boundaries, no overlap waste |
| Chunk context | Summary + last paragraph + terms | Minimal tokens, maximum coherence |
| Glossary injection | System message table | Persistent, authoritative |
| Glossary growth | Filter relevant + max ~200 terms | Token budget, instruction-following |
| New term discovery | Phase 2 reports, `approved: false` | Human-in-the-loop quality |
| Number formatting | Programmatic post-processing | LLMs unreliable with number conversion |
| Bidi isolation | Unicode FSI/PDI post-processing | Works everywhere, no DOM overhead |
| Quality report | JSON TEXT column on articles | Compact, queryable, one migration |
| Banned patterns | 25 entries in JSON file | Injected in Phase 2 prompt |
