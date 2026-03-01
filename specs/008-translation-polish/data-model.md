# Data Model: Translation Polish & Content Cleanup

**Feature**: 008-translation-polish | **Date**: 2026-03-01

---

## Entities

### 1. TranslateRequest (موجود — تعديل)

```typescript
// src/types/api.ts — إضافة حقل polishEnabled
interface TranslateRequest {
  title: string;
  url: string;
  content: string;
  movieTitles?: string[];
  polishEnabled?: boolean;   // ← جديد: default true
}
```

**السبب**: يُتيح للمستخدم تعطيل Phase 4 عند الحاجة (SC per FR-011).

---

### 2. Phase4Output (جديد)

```typescript
// src/lib/ai/prompts/phase4-polish.ts
interface Phase4Output {
  refined_text: string;
  refinements: Phase4RefinementItem[];
}

interface Phase4RefinementItem {
  type: 'flow' | 'connector' | 'phrasing' | 'tone';
  original: string;
  revised: string;
}
```

**الحقول**:
- `refined_text`: النص بعد تحسين الأسلوب — يحل محل `polished_text` كإخراج نهائي.
- `refinements`: سجل التغييرات للمراجعة والـ quality report.
- `type`: تصنيف التحسين — `flow` (تدفق الجمل), `connector` (أدوات الربط), `phrasing` (صياغة), `tone` (نبرة).

---

### 3. PolishPhaseReport (جديد)

```typescript
// src/types/api.ts — إضافة للـ TranslationQualityReport
interface PolishPhaseReport {
  status: 'success' | 'failed' | 'skipped';
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  retries: number;
  refinements: number;
  by_type: Record<string, number>;
}
```

**الحقول**:
- `status: 'skipped'`: عندما يكون `polishEnabled = false`.
- `refinements`: عدد التحسينات المُطبَّقة.
- `by_type`: توزيع التحسينات حسب النوع.

---

### 4. TranslationQualityReport (موجود — تعديل)

```typescript
// src/types/api.ts — إضافة phase4 للـ phases object
interface TranslationQualityReport {
  v: number;
  ts: string;
  model: string;
  chunks: number;
  phases: {
    translate: PhaseReport;
    review: ReviewPhaseReport;
    proofread: ProofreadPhaseReport;
    polish: PolishPhaseReport;   // ← جديد
  };
  totals: {
    duration_ms: number;
    tokens_in: number;
    tokens_out: number;
    corrections: number;
    new_terms: string[];
  };
}
```

---

### 5. ProtectedTermsList (جديد — ملف بيانات)

```typescript
// src/types/api.ts أو data/protected-terms.json
interface ProtectedTermsList {
  version: string;
  description: string;
  terms: string[];          // مصطلحات ثابتة للموقع
  auto_detect: boolean;     // تعليمات للـ AI لكشف الأسماء من السياق
}
```

**مسار**: `data/protected-terms.json`  
**يُقرأ**: مرة واحدة عند بداية كل pipeline call (مثل `glossary` و`banned-patterns`).

---

## State Transitions (Pipeline)

```
INPUT (ScrapedContent or URL)
  │
  ▼
[cache-first check] ──────── miss ──────→ [scrape from web] → save locally
  │ hit                                          │ corrupt? → re-scrape
  ▼                                              ▼
Phase 1: Translate ─── fail (3 retries) ──→ ERROR
  │ success
  ▼
Phase 2: Review ──── fail ──→ skip Phase 3 + Phase 4, use Phase 1 output
  │ success
  ▼
Phase 3: Proofread ─── fail ──→ use Phase 2 output
  │ success
  ▼
Phase 4: Polish ──── disabled (polishEnabled=false) ──→ skip
  │ enabled         fail ──→ use Phase 3 output (fallback)
  ▼ success
cleanContent() ← تنظيف برمجي شامل
  │
  ▼
PolishedContent (النتيجة النهائية)
```

---

## Validation Rules

| Entity | الحقل | القاعدة |
|--------|-------|---------|
| Phase4Output | `refined_text` | يجب ألا يكون فارغاً |
| Phase4Output | `refined_text` | يجب أن يحتوي على نص عربي (Unicode Arabic range) |
| ProtectedTermsList | `terms` | قائمة من string — كل عنصر ≥ 2 حروف |
| TranslateRequest | `polishEnabled` | boolean اختياري — إذا غائب يُعامل كـ `true` |
| ScrapedContent (cache) | الملف المحلي | JSON valid + محتوى > 200 حرف |
