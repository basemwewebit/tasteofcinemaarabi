// src/lib/ai/prompts/phase2-review.ts
// Phase 2: Review prompt builder — reviews Arabic translation against English source.

import { GlossaryEntry, formatGlossaryForPrompt } from '../glossary';

export interface BannedPattern {
    id: number;
    literal_ar: string;
    natural_ar: string;
    en_source: string;
    note?: string;
}

export interface Phase2Input {
    englishSource: string;
    arabicTranslation: string;
    glossaryEntries: GlossaryEntry[];
    bannedPatterns: BannedPattern[];
}

export interface Phase2CorrectionItem {
    type: 'grammar' | 'literal_translation' | 'terminology' | 'style' | 'omission' | 'accuracy';
    original: string;
    corrected: string;
    explanation: string;
}

export interface Phase2Output {
    corrected_text: string;
    corrections: Phase2CorrectionItem[];
    new_terms_discovered: Array<{ en: string; ar: string; context?: string }>;
}

/**
 * Format banned patterns as a reference table for the review prompt.
 */
function formatBannedPatterns(patterns: BannedPattern[]): string {
    if (patterns.length === 0) return '';

    const header = '| التركيب الحرفي المرفوض | البديل العربي الصحيح | المصدر الإنجليزي |\n|---|---|---|';
    const rows = patterns
        .map((p) => `| ${p.literal_ar} | ${p.natural_ar} | ${p.en_source} |`)
        .join('\n');

    return `${header}\n${rows}`;
}

/**
 * Build the system message for Phase 2 review.
 */
export function buildPhase2SystemMessage(
    glossaryEntries: GlossaryEntry[],
    bannedPatterns: BannedPattern[],
): string {
    const glossaryTable = formatGlossaryForPrompt(glossaryEntries);
    const bannedTable = formatBannedPatterns(bannedPatterns);

    return `أنت مراجع لغوي خبير في مكتب ترجمة معتمد، متخصص في المحتوى السينمائي العربي. مهمتك مراجعة ترجمة عربية لمقال سينمائي إنجليزي والتأكد من:

1. **الدقة**: الترجمة تنقل المعنى الأصلي بأمانة دون إضافة أو حذف.
2. **سلامة اللغة**: خلو النص من الأخطاء النحوية والصرفية والإملائية.
3. **طبيعية الأسلوب**: النص يقرأ كأنه كُتب أصلاً بالعربية — لا تراكيب حرفية مترجمة.
4. **اتساق المصطلحات**: المصطلحات السينمائية مترجمة وفق القاموس المعتمد.
5. **أسماء الأفلام والأشخاص**: تبقى بلغتها الأصلية دون تعريب.

## التراكيب الحرفية المحظورة

ابحث عن هذه التراكيب واستبدلها بالبدائل العربية الطبيعية:

${bannedTable}

${glossaryTable ? `## القاموس المصطلحي المعتمد\n\nتأكد من اتساق هذه المصطلحات:\n\n${glossaryTable}` : ''}

## تعليمات المخرجات

أخرج كائن JSON يحتوي:
- **corrected_text**: النص العربي المُصحّح بالكامل (بتنسيق MDX مع الحفاظ على علامات [IMAGE_N] و [[TITLE_N]])
- **corrections**: مصفوفة تصحيحات، كل عنصر يحتوي: type, original, corrected, explanation
- **new_terms_discovered**: مصطلحات سينمائية جديدة اكتشفتها ولم تكن في القاموس (en, ar, context)

أنواع التصحيحات المسموحة لـ type:
- grammar: أخطاء نحوية أو صرفية
- literal_translation: تراكيب حرفية مترجمة من الإنجليزية
- terminology: مصطلح سينمائي مترجم بشكل خاطئ أو غير متسق
- style: مشاكل في النبرة أو الأسلوب التحريري
- omission: محتوى محذوف من الأصل
- accuracy: خطأ في المعنى أو الترجمة`;
}

/**
 * Build the user message for Phase 2 review.
 */
export function buildPhase2UserMessage(input: Phase2Input): string {
    return `راجع الترجمة العربية التالية مقابل النص الإنجليزي الأصلي. صحّح كل الأخطاء واستبدل التراكيب الحرفية ببدائل عربية طبيعية.

## النص الإنجليزي الأصلي:
${input.englishSource}

## الترجمة العربية للمراجعة:
${input.arabicTranslation}

أجب حصرياً بكائن JSON بالهيكل التالي:
{
  "corrected_text": "النص المصحّح بالكامل",
  "corrections": [
    { "type": "literal_translation", "original": "النص الأصلي", "corrected": "النص المصحّح", "explanation": "سبب التصحيح" }
  ],
  "new_terms_discovered": [
    { "en": "english term", "ar": "المقابل العربي", "context": "genre" }
  ]
}`;
}
