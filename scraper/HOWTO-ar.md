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

## حل المشكلات الشائعة

| المشكلة | الحل |
|---------|------|
| `ModuleNotFoundError: scrapling` | نسيت تفعيل البيئة: `source .venv/bin/activate` |
| الاكتشاف يرجع 0 روابط | الـ sitemap مؤقتاً غير متاح، سيتراجع تلقائياً لصفحات التصنيف |
| أخطاء 429 (Rate Limit) | زِد قيمة `--delay` (الحد الأدنى الموصى به 2 ثانية) |
| القرص ممتلئ | الصور تحتاج ~10–20 GB، تأكد من المساحة الكافية |
| توقف مفاجئ | شغّل `python scraper.py` مباشرة، سيكمل من آخر نقطة |
| مقالات فاشلة كثيرة | راجع الأخطاء في manifest ثم `python scraper.py` مجدداً |

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

# مساعدة
python scraper.py --help
```
