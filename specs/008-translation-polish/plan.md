# Implementation Plan: Translation Polish & Content Cleanup

**Branch**: `008-translation-polish` | **Date**: 2026-03-01 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/008-translation-polish/spec.md`

---

## Summary

تحسين pipeline الترجمة بثلاثة محاور متكاملة:

1. **تنظيف ما بعد الترجمة (P1)**: تطوير وتوسيع منطق التنظيف البرمجي الحالي لإزالة رموز Unicode الخفية، توحيد علامات الترقيم، وتنظيف المسافات.
2. **إعادة صياغة أنيقة (P2)**: إضافة مرحلة رابعة (Phase 4) للـ pipeline بعد Phase 3 لإعادة صياغة الأسلوب فقط — مُفعَّلة افتراضياً، قابلة للتعطيل عبر flag.
3. **أولوية المحتوى المحلي (P3)**: تعديل منطق السكرابر لفحص المخزن المحلي أولاً قبل الشبكة، مع auto-heal للمحتوى التالف.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict) + Python 3.12  
**Primary Dependencies**: OpenAI SDK (OpenRouter), Next.js App Router, fs/path (Node.js stdlib)  
**Storage**: ملفات محلية (JSON/MDX) — مجلد `scraped/` للمحتوى المسحوب  
**Testing**: Vitest + existing test suite في `tests/lib/`  
**Target Platform**: Node.js 20 LTS (server-side pipeline)  
**Project Type**: Internal pipeline library (web-service backend)  
**Performance Goals**: تسريع المقالات الموجودة محلياً بـ ≥ 50% (SC-003)  
**Constraints**: Phase 4 fallback ≤ 5 ثوانٍ (SC-004), TypeScript strict — no `any`  
**Scale/Scope**: مقالات فردية حتى ~30,000 حرف؛ chunking موجود مسبقاً

---

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| المبدأ | الحالة | ملاحظة |
|--------|--------|---------|
| **I. Arabic-First** | ✅ PASS | Phase 4 تُحسّن الأسلوب العربي مباشرةً — صميم المبدأ |
| **II. Source Integrity** | ✅ PASS | لا تغيير في منطق attribution وروابط المصدر |
| **IV. Content Quality** | ✅ PASS | Draft → Review → Publish workflow محفوظ؛ Phase 4 تُحسّن الجودة دون auto-publish |
| **V. Performance** | ✅ PASS | المقالات المحلية أسرع (SC-003)؛ Phase 4 async لا تُبطئ Phase 1-3 |
| **Dev Standards** | ✅ PASS | TypeScript strict, tests مطلوبة per constitution: "Tests required for translation pipeline" |
| **Content Ethics** | ✅ PASS | السكرابر موجود مسبقاً؛ التحسين يُقلل الطلبات (rate-respectful) |

**Gate Result**: ✅ CLEAR — لا violations

---

## Project Structure

### Documentation (this feature)

```text
specs/008-translation-polish/
├── plan.md              ← هذا الملف
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── phase4-polish.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (التأثير على الملفات الموجودة)

```text
src/lib/ai/
├── translate.ts              ← تعديل: إضافة Phase 4، تقوية post-processing، polishEnabled flag
├── glossary.ts               ← بدون تغيير
└── prompts/
    ├── phase1-translate.ts   ← بدون تغيير
    ├── phase2-review.ts      ← بدون تغيير
    ├── phase3-proofread.ts   ← بدون تغيير
    └── phase4-polish.ts      ← جديد: system/user message builders لـ Phase 4

scraper/
└── scraper.py                ← تعديل: cache-first logic + corruption detection

data/
└── protected-terms.json      ← جديد: ProtectedTermsList (أسماء أفلام + مصطلحات موقع)

tests/lib/
├── translate.test.ts         ← تعديل: اختبارات Phase 4 + post-processing المحدَّث
└── scraper-cache.test.ts     ← جديد: اختبارات cache-first + auto-heal
```

---

## Phase 0: Research

*الهدف: حلّ جميع الغموض التقني قبل التصميم*

### Research Findings

#### R-001: حالة post-processing الحالي في translate.ts

**الوضع الحالي** (من `translate.ts` السطر 376-380):
```typescript
cleanedContent = toEasternArabicNumerals(cleanedContent);
cleanedContent = applyBidiIsolation(cleanedContent);
cleanedContent = formatArabicQuotationMarks(cleanedContent);
```

**الفجوات المكتشفة**:
- `applyBidiIsolation` تُضيف `\u2068` (FSI) و`\u2069` (PDI) — وهذه رموز Unicode خفية! ستتراكم عند المعالجة المتكررة.
- لا يوجد تنظيف للـ `\u200b` (Zero Width Space) أو `\u00a0` (Non-Breaking Space).
- لا توجد حماية ضد المسافات المتعددة المتتالية.
- `formatArabicQuotationMarks` تتعامل مع `"` فقط لكنها لا تُنظف الـ `'` أو `'`.

**القرار**: توسيع `cleanContent()` دالة مخصصة تُركِّز كل منطق التنظيف في مرحلة واحدة، قبل `applyBidiIsolation`.

---

#### R-002: تصميم Phase 4 (Style Polishing)

**المعطيات**:
- Phase 3 (Proofread) موجودة وتعمل على `polished_text`.
- Phase 4 تأتي بعد Phase 3 وتُحسّن الأسلوب فقط (لا هيكلة، لا حذف).
- يجب أن تكون اختيارية (enabled بالافتراضي).

**القرار**:
- إضافة parameter `polishEnabled?: boolean` لـ `TranslateRequest` (default: `true`).
- Phase 4 تستقبل النص العربي بعد Phase 3 وتُعيد نصاً مُحسَّن الأسلوب.
- Fallback: إذا فشلت Phase 4، يُستخدم output Phase 3 مباشرة.
- Temperature: `0.4` (أعلى قليلاً من Phase 3 لأن الصياغة تتطلب مرونة).

**نموذج الـ prompt لـ Phase 4**:
```
أنت محرر لغوي متخصص في الكتابة السينمائية العربية.
مهمتك: تحسين أسلوب النص التالي مع الحفاظ على كل كلمة ومعلومة.
- لا تحذف أي معلومة.
- لا تُعيد ترتيب الفقرات.
- لا تُعدِّل أسماء الأفلام أو الأشخاص.
- فقط: اجعل الجمل أكثر سلاسة وطبيعية للقارئ العربي.
```

---

#### R-003: cache-first في السكرابر

**الوضع الحالي** في `scraper.py`:
- السكرابر يسحب من الويبسايت دائماً.
- المحتوى المسحوب يُحفظ في مجلد (من الـ task السابق).

**القرار**:
- إضافة `--no-cache` flag للسكرابر (default: cache-first).
- فحص وجود الملف المحلي أولاً قبل الطلب الشبكي.
- التحقق من سلامة الملف (JSON valid + minimum content size).
- إذا كان الملف تالفاً: حذفه، سحب جديد، حفظ.

---

#### R-004: ProtectedTermsList — تصميم الملف

**القرار**:

```json
{
  "version": "1.0.0",
  "terms": [
    "Taste of Cinema",
    "IMDb",
    "Golden Globe",
    "Academy Award",
    "Cannes",
    "Palme d'Or"
  ],
  "auto_detect": true
}
```

- `terms`: قائمة ثابتة يُحقنها الـ prompt في Phase 4.
- `auto_detect: true`: تعليمات للـ AI لعدم تعديل الأسماء الأجنبية للأفلام والأشخاص.
- يُقرأ الملف عند بداية كل pipeline call (كما يُقرأ الـ glossary).

---

## Phase 1: Design & Contracts

### data-model.md

انظر [data-model.md](./data-model.md)

### contracts/phase4-polish.md

انظر [contracts/phase4-polish.md](./contracts/phase4-polish.md)

---

## Complexity Tracking

لا violations على Constitution — الجدول غير مطلوب.
