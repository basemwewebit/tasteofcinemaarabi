# دليل تشغيل السكرابر (Python Bulk Scraper)

دليل خطوة بخطوة لتحميل وتشغيل سكرابر مقالات tasteofcinema.com.

---

## المتطلبات الأساسية

- Python 3.10 أو أحدث
- مساحة خالية على القرص: **20 GB على الأقل** (للصور)
- اتصال إنترنت مستقر (الزحف الكامل يستغرق ~8–12 ساعة)

---

## الخطوة 1 — الإعداد (مرة واحدة فقط)

```bash
# من جذر المشروع
cd /home/basem/sites/tasteofcinemaarabi/scraper

# إنشاء بيئة Python افتراضية
python3 -m venv .venv

# تفعيل البيئة
source .venv/bin/activate

# تثبيت المكتبات
pip install -e .
```

> **ملاحظة**: يجب تفعيل البيئة (`source .venv/bin/activate`) في كل جلسة عمل جديدة قبل تشغيل أي أمر.

---

## الخطوة 2 — الاكتشاف فقط (لبناء القائمة بسرعة)

الاكتشاف يجلب جميع روابط المقالات من الـ sitemap ويحفظها في `manifest.json` **دون تحميل أي مقال**.
يستغرق **دقائق** فقط (لا ساعات).

```bash
python scraper.py --discover-only --verbose
```

**المخرجات:**
```
scraped/
└── manifest.json   ← يحتوي على ~5500–6000 رابط، كلها بحالة "pending"
```

**مراجعة سريعة للنتيجة:**
```bash
cat ../scraped/manifest.json | python -m json.tool | head -30
```

---

## الخطوة 3 — زحف تجريبي (5 مقالات فقط)

للتأكد من أن كل شيء يعمل قبل الزحف الكامل:

```bash
python scraper.py --limit 5 --verbose
```

**ماذا يحدث:**
1. يكتشف الروابط (إذا لم يكن manifest.json موجوداً)
2. يستخرج محتوى أول 5 مقالات
3. يحمّل الصور لكل مقال
4. يحفظ ملف JSON لكل مقال في `scraped/articles/`

**مراجعة المخرجات:**
```bash
ls ../scraped/articles/
cat ../scraped/articles/<اسم-المقال>.json | python -m json.tool | head -40
ls ../scraped/images/
```

---

## الخطوة 4 — الزحف الكامل

```bash
python scraper.py --verbose
```

> يستغرق ~8–12 ساعة مع الإعدادات الافتراضية (3 عمال، تأخير 2 ثانية).
> يمكن تركه يعمل في الخلفية — يحفظ الحالة بعد كل مقال.

**مراقبة التقدم في الخلفية:**
```bash
# في نافذة ترمينال منفصلة
watch -n 30 "cat ../scraped/manifest.json | python -m json.tool | grep -E '\"(total|completed|failed)\"'"
```

---

## أوامر مفيدة

### الاستمرار بعد انقطاع
السكرابر يتابع تلقائياً من حيث توقف — المقالات المكتملة لا تُعاد:
```bash
python scraper.py --verbose
```

### إعادة الزحف من الصفر (`--force`)
يعيد تعيين جميع المقالات إلى "pending" ويبدأ من أول:
```bash
python scraper.py --force --verbose
```

### إعادة زحف المقالات الفاشلة فقط
المقالات الفاشلة تُعاد تلقائياً في كل تشغيل عادي. لعرضها:
```bash
cat ../scraped/manifest.json | python -m json.tool | grep -A5 '"failed"'
```

### ضبط السرعة
```bash
# أبطأ وأكثر أماناً (خادم حساس)
python scraper.py --delay 5 --workers 1

# أسرع (اتصال قوي، خطر الحظر أكبر)
python scraper.py --delay 1.5 --workers 5

# مع تحديد عدد المقالات وإخراج مخصص
python scraper.py --limit 100 --delay 3 --workers 2 --output-dir /data/scraper-out --verbose
```

### ترتيب النتائج (`--sort`)
```bash
# زحف أحدث 10 مقالات (الافتراضي: الأحدث أولاً)
python scraper.py --limit 10 --verbose

# زحف أقدم 10 مقالات
python scraper.py --sort oldest --limit 10 --verbose
```

### تصفية حسب السنة والشهر (`--year` / `--month`)
```bash
# جميع مقالات 2024
python scraper.py --year 2024 --verbose

# يونيو 2024 فقط
python scraper.py --year 2024 --month 6 --verbose

# أي شهر ديسمبر، عبر جميع السنوات
python scraper.py --month 12 --verbose

# أقدم 5 مقالات من 2023
python scraper.py --year 2023 --sort oldest --limit 5 --verbose
```

### مقال واحد (`--article`)
```bash
# بالـ slug (يجب أن يكون في manifest — شغّل --discover-only أولاً إن لزم)
python scraper.py --article 10-best-actors-of-all-time-relay-race --verbose

# بالرابط الكامل (لا حاجة للبحث في manifest)
python scraper.py --article https://www.tasteofcinema.com/2024/my-article/ --verbose
```

---

## هيكل المخرجات

```
scraped/                          ← في جذر المشروع (مُستثنى من git)
├── manifest.json                 ← سجل الاكتشاف والحالة
├── articles/
│   ├── my-article-slug.json      ← مقال واحد لكل ملف
│   └── another-article.json
└── images/
    ├── my-article-slug/
    │   ├── 00-thumbnail.jpg      ← الصورة الرئيسية دائماً أولاً
    │   ├── 01-crash-2005.jpg
    │   └── 02-the-artist.jpg
    └── another-article/
        └── ...
```

### مثال على ملف JSON مقال

```json
{
  "title": "All 25 Best Picture Winners of the 21st Century Ranked",
  "content": "<p>On February 9th, 2020...</p>",
  "author": "Jack Murphy",
  "url": "https://www.tasteofcinema.com/2026/all-25-best-picture-winners/",
  "featured_image": "https://www.tasteofcinema.com/wp-content/uploads/image.jpg",
  "inline_images": ["..."],
  "movie_titles": ["Crash", "The Artist", "Green Book"],
  "category": "film-lists",
  "tags": ["best-picture", "oscars"],
  "pages_merged": 3,
  "scraped_at": "2026-02-28T14:32:11Z"
}
```

---

## حالة manifest.json

| الحالة | المعنى |
|--------|---------|
| `pending` | اكتُشف الرابط ولم يُزحف بعد |
| `completed` | تم الزحف وحفظ الملف والصور بنجاح |
| `failed` | فشل الزحف، سيُعاد المحاولة في التشغيل التالي |

**استعراض الإحصائيات:**
```bash
python -c "
import json
m = json.load(open('../scraped/manifest.json'))
print(f'الإجمالي:   {m[\"total\"]}')
print(f'مكتمل:      {m[\"completed\"]}')
print(f'فاشل:       {m[\"failed\"]}')
print(f'معلّق:      {m[\"total\"] - m[\"completed\"] - m[\"failed\"]}')
"
```

---

## تكامل مع بايب لاين Next.js

بعد اكتمال الزحف، بايب لاين الاستيراد (`runScrapePipeline`) يقرأ ملفات JSON المحلية **تلقائياً** بدلاً من الزحف المباشر عبر الإنترنت عند وجودها.

لاستيراد مقال تم زحفه مسبقاً عبر واجهة الإدارة:
1. تأكد من وجود ملف `scraped/articles/<slug>.json`
2. أطلق عملية استيراد عادية من لوحة التحكم للرابط المطلوب
3. البايب لاين سيكتشف الملف المحلي ويتخطى الزحف الشبكي

---

## مرجع أوامر CLI

```
usage: scraper.py [-h] [--discover-only] [--force] [--limit N]
                  [--delay SECONDS] [--workers N] [--output-dir DIR]
                  [--verbose] [--sort {latest,oldest}]
                  [--article SLUG_OR_URL] [--year YYYY] [--month M]

options:
  -h, --help              عرض المساعدة والخروج
  --discover-only         اكتشاف الروابط فقط بدون زحف
  --force                 إعادة زحف الكل بتجاهل حالة manifest
  --limit N               الحد الأقصى لعدد المقالات (الافتراضي: الكل)
  --delay SECONDS         التأخير بين الطلبات بالثواني (الافتراضي: 2.0)
  --workers N             عدد العمال المتوازيين (الافتراضي: 3، الأقصى: 5)
  --output-dir DIR        مجلد المخرجات (الافتراضي: ../scraped)
  --verbose               تفعيل التسجيل المفصّل
  --sort {latest,oldest}  ترتيب: latest الأحدث (افتراضي) أو oldest الأقدم
  --article SLUG_OR_URL   زحف مقال واحد بالـ slug أو الرابط الكامل
  --year YYYY             تصفية حسب سنة النشر (من مسار URL)
  --month M               تصفية حسب الشهر (1-12، من last_modified)
```

### ترتيب تطبيق الفلاتر

عند دمج عدة فلاتر، تُطبَّق بهذا الترتيب:

1. `--article` → اختيار مقال واحد مباشرة (يتخطى الخطوات 2–5)
2. `--year` → تصفية حسب السنة من مسار URL
3. `--month` → تصفية حسب الشهر من lastmod
4. `--sort` → ترتيب النتائج (latest أو oldest)
5. `--limit` → تقليص العدد إلى N
6. فلتر الحالة → المنطق التزايدي الموجود (pending/failed)

### رموز الخروج

| الرمز | المعنى |
|-------|--------|
| `0`   | تم زحف جميع المقالات المستهدفة بنجاح |
| `1`   | فشل جزئي — بعض المقالات فشلت (راجع manifest) |
| `2`   | خطأ فادح — فشل الاكتشاف أو وسيطات غير صالحة |

---

## تشغيل الاختبارات

```bash
# من مجلد scraper/ (مع تفعيل .venv)
pip install -e ".[dev]"        # يثبّت pytest, pytest-asyncio

# تشغيل جميع الاختبارات
pytest tests/ -v

# تشغيل اختبارات الترتيب والتصفية فقط
pytest tests/test_sort.py tests/test_filter.py -v
```

النتيجة المتوقعة: جميع الاختبارات تنجح مع HTTP مُحاكى (لا حاجة لشبكة حقيقية).

---

## حل المشكلات الشائعة

| المشكلة | الحل |
|---------|------|
| `ModuleNotFoundError: scrapling` | نسيت تفعيل البيئة: `source .venv/bin/activate` |
| الاكتشاف يرجع 0 روابط | الـ sitemap مؤقتاً غير متاح، سيتراجع تلقائياً لصفحات التصنيف |
| أخطاء 429 (Rate Limit) | زِد قيمة `--delay` (الحد الأدنى الموصى به 2 ثانية) |
| القرص ممتلئ | الصور تحتاج ~10–20 GB، تأكد من المساحة الكافية |
| توقف مفاجئ | شغّل `python scraper.py` مباشرة، سيكمل من آخر نقطة |
| مقالات فاشلة كثيرة | راجع الأخطاء في manifest ثم `python scraper.py` مجدداً |
| `--article` slug غير موجود | شغّل `--discover-only` أولاً لبناء manifest |
| `--year` بدون نتائج | تأكد أن السنة بين 2000 والسنة الحالية |

---

## مرجع الأوامر السريع

```bash
# إعداد (مرة واحدة)
python3 -m venv .venv && source .venv/bin/activate && pip install -e .

# تفعيل البيئة (كل جلسة)
source .venv/bin/activate

# اكتشاف فقط
python scraper.py --discover-only --verbose

# تجربة سريعة (5 مقالات)
python scraper.py --limit 5 --verbose

# زحف كامل
python scraper.py --verbose

# إعادة الكل من الصفر
python scraper.py --force --verbose

# أحدث 10 مقالات
python scraper.py --sort latest --limit 10 --verbose

# مقال واحد بالـ slug
python scraper.py --article my-article-slug --verbose

# مقالات سنة 2024
python scraper.py --year 2024 --verbose

# يونيو 2024 فقط
python scraper.py --year 2024 --month 6 --verbose

# تشغيل الاختبارات
pytest tests/ -v

# مساعدة
python scraper.py --help
```
