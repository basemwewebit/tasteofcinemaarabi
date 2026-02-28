// src/lib/ai/prompts/phase1-translate.ts
// Phase 1: Translation prompt builder — translates English cinema article to Arabic.

import { GlossaryEntry, formatGlossaryForPrompt } from '../glossary';
import { STYLE_GUIDE } from '../../../../data/style-guide';

export interface Phase1Input {
    title: string;
    url: string;
    content: string;
    glossaryEntries: GlossaryEntry[];
    /** When chunking, provide chunk context for continuity */
    chunkContext?: {
        chunkIndex: number;
        totalChunks: number;
        articleSummary?: string;
        previousChunkLastParagraph?: string;
        establishedTranslations?: Record<string, string>;
    };
}

export interface Phase1Output {
    title_ar: string;
    title_en: string;
    excerpt_ar: string;
    content_mdx: string;
    category: string;
    tags: string[];
    slug: string;
}

/**
 * Build the system message for Phase 1 translation.
 * Includes glossary as a markdown table and style guide rules.
 */
export function buildPhase1SystemMessage(glossaryEntries: GlossaryEntry[]): string {
    const glossaryTable = formatGlossaryForPrompt(glossaryEntries);

    const glossarySection = glossaryTable
        ? `\n\n## قاموس المصطلحات السينمائية المعتمد\n\nاستخدم المقابلات العربية التالية بدقة واتساق:\n\n${glossaryTable}`
        : '';

    return `أنت مكتب ترجمة معتمد متخصص في المحتوى السينمائي والثقافي. مهمتك ترجمة مقال سينمائي إنجليزي إلى العربية بمستوى احترافي يضاهي مخرجات مكاتب الترجمة المعتمدة.

## دليل الأسلوب التحريري

- **النبرة**: ${STYLE_GUIDE.tone}
- **المستوى اللغوي**: ${STYLE_GUIDE.languageLevel}
- **أسماء الأفلام**: ${STYLE_GUIDE.filmTitles}
- **أسماء المخرجين والممثلين**: ${STYLE_GUIDE.foreignNames}
- **الاقتباسات**: ${STYLE_GUIDE.quotations}
- **الأرقام**: ${STYLE_GUIDE.numerals}
- **أسلوب المخاطبة**: ${STYLE_GUIDE.addressingStyle}

## قواعد إضافية

${STYLE_GUIDE.additionalRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${glossarySection}`;
}

/**
 * Build the user message for Phase 1 translation.
 */
export function buildPhase1UserMessage(input: Phase1Input): string {
    const chunkInfo = input.chunkContext
        ? `\n\n--- معلومات التجزئة ---
الجزء ${input.chunkContext.chunkIndex + 1} من ${input.chunkContext.totalChunks}
${input.chunkContext.articleSummary ? `ملخص المقال: ${input.chunkContext.articleSummary}` : ''}
${input.chunkContext.previousChunkLastParagraph ? `آخر فقرة من الجزء السابق (للحفاظ على اتساق النبرة): ${input.chunkContext.previousChunkLastParagraph}` : ''}
${input.chunkContext.establishedTranslations ? `مصطلحات تمت ترجمتها في الأجزاء السابقة (التزم بنفس الترجمة): ${JSON.stringify(input.chunkContext.establishedTranslations)}` : ''}
--- نهاية معلومات التجزئة ---`
        : '';

    return `ترجم المقال التالي إلى العربية بأعلى جودة ممكنة. النص الناتج يجب أن يقرأه القارئ العربي وكأنه كُتب أصلاً بالعربية.

اتبع هذه القواعد بدقة:
1. أخرج JSON صالحاً فقط بالهيكل المحدد أدناه.
2. أعد صياغة الجمل بما يناسب البنية العربية — لا ترجمة حرفية أبداً.
3. حافظ على تنسيق Markdown (قوائم مرقمة، عريض، مائل) في حقل content_mdx.
4. حرج — عناوين الأفلام: عناوين الأفلام والمسلسلات تبقى بلغتها الأصلية. لا تُترجمها أبداً.
5. حرج — العناصر النائبة: النصوص المغلفة بـ [[TITLE_N]] رموز محمية. احتفظ بها كما هي تماماً.
6. حرج — الصور: المحتوى يحتوي على علامات [IMAGE_N]. احتفظ بكل علامة في مكانها بالضبط.
7. أنشئ ملخصاً مختصراً وجذاباً في excerpt_ar.
${chunkInfo}

عنوان المقال: "${input.title}"
رابط المصدر: "${input.url}"

المحتوى الأصلي:
${input.content}

أجب حصرياً بكائن JSON يحتوي هذه المفاتيح بالضبط:
{
  "title_ar": "العنوان بالعربية",
  "title_en": "العنوان الإنجليزي الأصلي",
  "excerpt_ar": "ملخص عربي مختصر (٣ جمل كحد أقصى)",
  "content_mdx": "النص المترجم كاملاً بتنسيق MDX (مع الحفاظ على علامات [IMAGE_N])",
  "category": "تصنيف مقترح (مثل: lists, reviews, retrospectives)",
  "tags": ["وسم١", "وسم٢"],
  "slug": "slug-إنجليزي-للرابط"
}`;
}
