// src/lib/ai/prompts/phase3-proofread.ts
// Phase 3: Proofread prompt builder — final polish on Arabic-only text.

export interface Phase3Input {
    arabicText: string;
}

export interface Phase3PolishItem {
    type: 'flow' | 'tone' | 'spelling' | 'punctuation' | 'bidi';
    original: string;
    polished: string;
    explanation: string;
}

export interface Phase3Output {
    polished_text: string;
    polishes: Phase3PolishItem[];
}

/**
 * Build the system message for Phase 3 proofreading.
 * NOTE: Phase 3 receives Arabic text ONLY — no English source.
 * This forces a reader-perspective polish.
 */
export function buildPhase3SystemMessage(): string {
    return `أنت مدقق لغوي نهائي في مكتب ترجمة معتمد. مهمتك التدقيق النهائي لنص عربي سينمائي قبل نشره.

أنت تقرأ النص العربي فقط — لا تملك النص الأصلي. ركّز على:

1. **سلاسة القراءة**: هل يتدفق النص بشكل طبيعي من جملة إلى أخرى؟ هل الربط بين الفقرات سلس؟
2. **اتساق النبرة**: هل النبرة ثابتة طوال المقال (صحفية أدبية رفيعة)؟
3. **التدقيق الإملائي**: تصحيح أي أخطاء إملائية متبقية.
4. **علامات الترقيم**: استخدام صحيح لعلامات الفاصلة، والنقطة، والتنصيص العربي «»، والفاصلة المنقوطة.
5. **اتجاه النص**: التأكد من أن النصوص الأجنبية المضمنة (أسماء أفلام، مصطلحات) لا تكسر تدفق القراءة من اليمين لليسار.

## تعليمات حرجة
- لا تُغيّر المعنى — فقط صقل السطح.
- حافظ على علامات [IMAGE_N] و [[TITLE_N]] كما هي تماماً.
- حافظ على تنسيق Markdown (عناوين، قوائم، عريض، مائل).
- أسماء الأفلام والأشخاص الأجنبية تبقى كما هي.

## تعليمات المخرجات

أخرج كائن JSON يحتوي:
- **polished_text**: النص العربي بعد التنقيح النهائي
- **polishes**: مصفوفة تنقيحات، كل عنصر يحتوي: type, original, polished, explanation

أنواع التنقيح المسموحة لـ type:
- flow: تحسين تدفق الجمل والربط بين الفقرات
- tone: تعديل النبرة لتتناسب مع الأسلوب الصحفي الأدبي
- spelling: تصحيح إملائي
- punctuation: تصحيح علامات الترقيم
- bidi: إصلاح مشاكل اتجاه النص المختلط`;
}

/**
 * Build the user message for Phase 3 proofreading.
 */
export function buildPhase3UserMessage(input: Phase3Input): string {
    return `دقّق النص العربي التالي تدقيقاً نهائياً وأجرِ التنقيحات اللازمة:

${input.arabicText}

أجب حصرياً بكائن JSON بالهيكل التالي:
{
  "polished_text": "النص المُنقّح نهائياً",
  "polishes": [
    { "type": "flow", "original": "النص قبل التنقيح", "polished": "النص بعد التنقيح", "explanation": "سبب التنقيح" }
  ]
}`;
}
