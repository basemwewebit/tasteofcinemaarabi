# Contract: Phase 4 Polish — API Interface

**Feature**: 008-translation-polish | **Date**: 2026-03-01  
**Type**: Internal TypeScript interface contract (pipeline phase)

---

## Phase 4 Input Contract

Phase 4 يستقبل النص العربي بعد اكتمال Phase 3.

### System Message

```text
أنت محرر لغوي متخصص في النقد السينمائي العربي.

مهمتك الوحيدة: تحسين أسلوب النص التالي لجعله أكثر سلاسة وطبيعية للقارئ العربي.

القيود الصارمة:
- لا تحذف أي معلومة أو جملة
- لا تُعيد ترتيب الفقرات
- لا تُضف محتوى جديداً
- لا تُعدِّل أسماء الأفلام، المخرجين، الممثلين، أو المصطلحات السينمائية

المسموح به فقط:
- تحسين تدفق الجمل داخل الفقرة
- استبدال أدوات الربط الحرفية المترجمة بمكافئاتها الطبيعية
- تعديل الصياغة الحرفية لتبدو عربية أصيلة

المصطلحات المحمية (لا تُعدَّل):
{protected_terms}

أعد النتيجة بصيغة JSON فقط.
```

### User Message

```text
النص العربي المُراد تحسين أسلوبه:

{arabic_text}
```

---

## Phase 4 Output Contract

```typescript
interface Phase4Output {
  refined_text: string;          // النص بعد تحسين الأسلوب (نفس البنية والمحتوى)
  refinements: Array<{
    type: 'flow' | 'connector' | 'phrasing' | 'tone';
    original: string;            // الجملة/العبارة قبل التحسين
    revised: string;             // الجملة/العبارة بعد التحسين
  }>;
}
```

### Validation Rules

| الحقل | القاعدة | السلوك عند الخطأ |
|-------|---------|------------------|
| `refined_text` | يجب أن يكون موجوداً وغير فارغ | Fallback إلى Phase 3 output |
| `refined_text` | يجب ألا يكون أقل من 50% من حجم الإدخال | Fallback إلى Phase 3 output |
| `refinements` | قائمة (قد تكون فارغة إذا لم تكن هناك تحسينات) | تُقبَل القائمة الفارغة |

---

## Caller Contract (translate.ts)

```typescript
// تغيير في translateArticle()

async function translateArticle(req: TranslateRequest): Promise<TranslateResponse> {
  // ... Phase 1-3 كما هي ...

  // Phase 4: Polish (optional)
  const phase4Metrics: PolishPhaseReport = {
    status: req.polishEnabled === false ? 'skipped' : 'success',
    duration_ms: 0, tokens_in: 0, tokens_out: 0,
    retries: 0, refinements: 0, by_type: {}
  };

  if (req.polishEnabled !== false && phase3Metrics.status !== 'failed') {
    const phase4Start = Date.now();
    try {
      const phase4Output = await runPhaseWithRetry<Phase4Output>(
        ai, model, 0.4,
        buildPhase4SystemMessage(protectedTerms),
        buildPhase4UserMessage({ arabicText: currentArabicText }),
        PHASE_RETRY_LIMIT,
      );

      if (phase4Output.data?.refined_text) {
        currentArabicText = phase4Output.data.refined_text;
        phase4Metrics.refinements = phase4Output.data.refinements.length;
        // by_type aggregation...
      }
    } catch (e) {
      console.error('Phase 4 polish failed, using Phase 3 output:', e);
      phase4Metrics.status = 'failed';
    }
    phase4Metrics.duration_ms = Date.now() - phase4Start;
  }
}
```

---

## Scraper Cache Contract

```python
# scraper/scraper.py

def scrape_article(url: str, force: bool = False) -> dict:
    """
    Cache-first article scraper.
    
    Args:
        url: URL of the article to scrape
        force: If True, bypass cache and always scrape from web
    
    Returns:
        dict with keys: title, content, author, url
    
    Raises:
        ScraperError: If scraping fails after cache miss
    """
    slug = url_to_slug(url)
    cache_path = SCRAPED_DIR / f"{slug}.json"
    
    if not force and cache_path.exists():
        cached = try_load_cache(cache_path)
        if cached:  # None يعني تالف
            return cached
        # التالف: حذف وإعادة السحب
        cache_path.unlink()
    
    # سحب من الشبكة
    content = fetch_from_web(url)
    save_to_cache(cache_path, content)
    return content

def try_load_cache(path: Path) -> dict | None:
    """
    يُحاول تحميل الملف المحلي.
    يُعيد None إذا كان تالفاً أو غير مكتمل.
    """
    try:
        data = json.loads(path.read_text())
        if len(data.get('content', '')) < 200:
            return None  # محتوى ناقص
        return data
    except (json.JSONDecodeError, KeyError):
        return None  # ملف تالف
```
