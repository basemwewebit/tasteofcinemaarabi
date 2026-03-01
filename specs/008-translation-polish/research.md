# Research: Translation Polish & Content Cleanup

**Feature**: 008-translation-polish | **Date**: 2026-03-01

---

## R-001: تحليل post-processing الحالي في translate.ts

### الوضع الحالي

الكود الحالي في `translate.ts` السطور 376-380 يُطبّق ثلاث عمليات برمجية بعد الترجمة:

```typescript
cleanedContent = toEasternArabicNumerals(cleanedContent);
cleanedContent = applyBidiIsolation(cleanedContent);
cleanedContent = formatArabicQuotationMarks(cleanedContent);
```

### الفجوات المكتشفة

| المشكلة | السبب | الحل |
|---------|-------|------|
| رموز `\u200b` (Zero Width Space) لا تُزال | `applyBidiIsolation` تُضيف FSI/PDI لكن لا شيء يُزيل الموجودة | `cleanInvisibleChars()` جديدة |
| `\u00a0` (Non-Breaking Space) يبقى | لا يوجد منطق لاستبدالها بمسافة عادية | ضمن `cleanInvisibleChars()` |
| `\u2068`/`\u2069` تتراكم عند إعادة المعالجة | `applyBidiIsolation` تُضيف بدون فحص وجودها | تنظيف قبل الإضافة |
| مسافات متعددة متتالية | الـ AI أحياناً يُولّد مسافتين بدل واحدة | `normalizeWhitespace()` |
| أسطر فارغة زائدة (3+ أسطر متتالية) | دمج الـ chunks يُنتج فراغات زائدة | `normalizeBlankLines()` |
| `'` و`'` (curly single quotes) لا تُعالَج | `formatArabicQuotationMarks` تتعامل مع `"` فقط | توسيع الدالة |

### القرار

- **Decision**: إنشاء دالة `cleanContent(text: string): string` مُوحَّدة تُشغَّل قبل `applyBidiIsolation`.
- **Rationale**: تجميع كل منطق التنظيف في مكان واحد يُسهّل الاختبار والتطوير.
- **Alternatives Considered**: تنقيح كل دالة على حدة — رُفض لأنه يُصعّب تتبع تسلسل العمليات.

---

## R-002: تصميم Phase 4 (Style Polishing)

### المعطيات من الكود الحالي

الـ pipeline الحالي من `translate.ts`:
```
Phase 1: Translate  → content_mdx (Arabic raw)
Phase 2: Review     → corrected_text
Phase 3: Proofread  → polished_text
```

كل phase تُنفَّذ عبر `runPhaseWithRetry<T>()` مع:
- Retry limit: 1
- Fallback: عند الفشل، تُستخدم نتيجة المرحلة السابقة
- Temperature: 0.3 → 0.15 → 0.1 (تنازلي للدقة)

### قرار تصميم Phase 4

- **Decision**: Phase 4 تستقبل `polished_text` من Phase 3 وتُعيد `refined_text` بأسلوب محسَّن.
- **Temperature**: `0.4` — أعلى من Phase 3 لأن الصياغة تتطلب إبداعاً لغوياً لا دقة فقط.
- **Enabled by default**: `polishEnabled?: boolean = true` يُضاف لـ `TranslateRequest`.
- **Fallback strategy**: إذا فشلت Phase 4، يُستخدم output Phase 3 مع تسجيل الفشل في `quality_report`.
- **Rationale**: اتساق مع بنية phases الموجودة؛ يُتيح إيقاف Phase 4 دون المساس بـ Phase 1-3.
- **Alternatives Considered**: دمج Phase 4 مع Phase 3 — رُفض لأن الأهداف مختلفة (دقة vs. أسلوب).

### نموذج output Phase 4

```typescript
interface Phase4Output {
  refined_text: string;      // النص بعد تحسين الأسلوب
  refinements: Array<{
    type: 'flow' | 'connector' | 'phrasing' | 'tone';
    original: string;
    revised: string;
  }>;
}
```

---

## R-003: Cache-First في السكرابر

### الوضع الحالي في scraper.py

بعد مراجعة الكود، السكرابر الحالي يسحب دائماً من الشبكة.

### القرار

- **Decision**: إضافة `cache_first=True` كـ parameter افتراضي. السكرابر يفحص `scraped/{slug}.json` أولاً.
- **Corruption Detection**: فحص بسيط — JSON valid + `len(content) > 200 chars`.
- **Auto-heal**: إذا الملف تالف → حذف → سحب جديد → حفظ.
- **Force Flag**: `--force-scrape` يتجاوز الـ cache ويسحب دائماً.
- **Rationale**: أبسط implementation ممكن يحقق SC-003 (توفير ≥50% وقت).
- **Alternatives Considered**: TTL-based caching — رُفض لأن المقالات السينمائية لا تتغير.

---

## R-004: ProtectedTermsList

### القرار

- **Decision**: ملف `data/protected-terms.json` بقائمة ثابتة + `auto_detect: true`.
- **Injection**: تُحقن القائمة في system prompt لـ Phase 4 (بنفس طريقة الـ glossary في Phase 1).
- **Auto-detect**: تعليمات للـ AI لعدم تعديل أسماء الأفلام والأشخاص التي يكتشفها من السياق.
- **Rationale**: الجمع بين القائمة الثابتة والكشف التلقائي يغطي المصطلحات الخاصة بالموقع والأفلام الجديدة.
- **Alternatives Considered**: قائمة فقط — رُفض لأن أسماء الأفلام الجديدة لا تُحدَّث يدوياً.

### الملف الابتدائي

```json
{
  "version": "1.0.0",
  "description": "مصطلحات محمية من التعديل في مرحلة إعادة الصياغة",
  "terms": [
    "Taste of Cinema",
    "IMDb",
    "Golden Globe",
    "Academy Award",
    "Oscar",
    "Cannes",
    "Palme d'Or",
    "BAFTA",
    "Sundance",
    "Tribeca"
  ],
  "auto_detect": true
}
```
