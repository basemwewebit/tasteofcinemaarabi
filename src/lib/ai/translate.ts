// src/lib/ai/translate.ts
import OpenAI from 'openai';
import { TranslateRequest, TranslateResponse } from '@/types/api';

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'mock-key-for-build',
        });
    }
    return openaiClient;
}

export async function translateArticle(req: TranslateRequest): Promise<TranslateResponse> {
    const prompt = `
You are an expert cinema editor and translator. Your task is to translate an English cinema article into Arabic.
Follow these rules strictly:
1. Output valid JSON only, using the structure defined below.
2. The translation MUST be high quality, culturally adapted for an Arab audience, avoiding literal translation clichés.
3. Keep markdown formatting (numbered lists, bold, italics) within the content_mdx field.
4. Transliterate movie titles or directors names appropriately (e.g., "كريستوفر نولان"). Keep the original English name in parentheses on its first mention.
5. Create a concise, engaging summary for 'excerpt_ar'.

Input Article Title: "${req.title}"
Input Source URL: "${req.url}"

Original Content Extracted:
${req.content}

Respond exclusively with a JSON object holding exactly these keys:
{
  "title_ar": "Arabic Title Here",
  "title_en": "English Title if kept, or same as original",
  "excerpt_ar": "Short Arabic summary (max 3 sentences)",
  "content_mdx": "Full translated article content in MDX format",
  "category": "Suggested category slug (e.g., lists, reviews, retrospectives)",
  "tags": ["tag1", "tag2"],
  "slug": "url-friendly-english-or-transliterated-slug"
}
`;

    try {
        const openai = getOpenAI();
        const aiResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional Arabic cinema editor.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });

        const resultText = aiResponse.choices[0].message.content;
        if (!resultText) {
            throw new Error('Empty response from OpenAI');
        }

        const parsedData = JSON.parse(resultText);

        return {
            success: true,
            data: {
                title_ar: parsedData.title_ar,
                title_en: parsedData.title_en || req.title,
                excerpt_ar: parsedData.excerpt_ar,
                content_mdx: parsedData.content_mdx,
                category: parsedData.category || 'uncategorized',
                tags: parsedData.tags || [],
                slug: parsedData.slug || req.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            }
        };
    } catch (error: unknown) {
        console.error('Translation error:', error);
        return {
            success: false,
            error: 'Failed to translate article',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
