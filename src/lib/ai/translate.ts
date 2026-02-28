// src/lib/ai/translate.ts
import OpenAI from 'openai';
import { TranslateRequest, TranslateResponse } from '@/types/api';

function getAIClient(): OpenAI {
    const apiKey = process.env.OPENROUTER_API_KEY || (process.env.NODE_ENV === 'test' ? 'test-key' : '');
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured');
    }

    return new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
        defaultHeaders: {
            'HTTP-Referer': 'https://mazaqalsinema.com',
            'X-Title': encodeURIComponent('مذاق السينما'),
        },
    });
}

const MAX_TRANSLATION_RETRIES = 3;
const MAX_CONTENT_CHARS = 22000;

export async function translateArticle(req: TranslateRequest): Promise<TranslateResponse> {
    const safeTitle = req.title?.trim() || 'Untitled';
    const safeUrl = req.url?.trim() || '';
    const content = truncateContent(req.content);

    const prompt = `
You are an expert cinema editor and translator. Your task is to translate an English cinema article into Arabic.
Follow these rules strictly:
1. Output valid JSON only, using the structure defined below.
2. The translation MUST be high quality, culturally adapted for an Arab audience, avoiding literal translation clichés.
3. Keep markdown formatting (numbered lists, bold, italics) within the content_mdx field.
4. Transliterate movie titles or directors names appropriately (e.g., "كريستوفر نولان"). Keep the original English name in parentheses on its first mention.
5. Create a concise, engaging summary for 'excerpt_ar'.

Input Article Title: "${safeTitle}"
Input Source URL: "${safeUrl}"

Original Content Extracted:
${content}

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

    const ai = getAIClient();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_TRANSLATION_RETRIES; attempt += 1) {
        try {
            const aiResponse = await ai.chat.completions.create({
                model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o',
                messages: [
                    { role: 'system', content: 'You are a professional Arabic cinema editor.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            });

            const resultText = aiResponse.choices[0].message.content;
            if (!resultText) {
                throw new Error('Empty response from OpenRouter');
            }

            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse JSON from AI response');
            }

            const parsedData = JSON.parse(jsonMatch[0]) as {
                title_ar?: string;
                title_en?: string;
                excerpt_ar?: string;
                content_mdx?: string;
                category?: string;
                tags?: string[];
                slug?: string;
            };

            if (!parsedData.content_mdx || !parsedData.title_ar) {
                throw new Error('AI response missing required keys (title_ar/content_mdx)');
            }

            return {
                success: true,
                data: {
                    title_ar: parsedData.title_ar,
                    title_en: parsedData.title_en || safeTitle,
                    excerpt_ar: parsedData.excerpt_ar || '',
                    content_mdx: parsedData.content_mdx,
                    category: parsedData.category || 'uncategorized',
                    tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
                    slug: parsedData.slug || safeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                }
            };
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error('Unknown translation error');
            console.error(`Translation attempt ${attempt} failed:`, lastError.message);
            if (attempt < MAX_TRANSLATION_RETRIES) {
                await sleep(700 * attempt);
            }
        }
    }

    return {
        success: false,
        error: 'Failed to translate article',
        details: lastError?.message || 'Unknown error'
    };
}

function truncateContent(content: string): string {
    if (!content) {
        return '';
    }

    if (content.length <= MAX_CONTENT_CHARS) {
        return content;
    }

    return `${content.slice(0, MAX_CONTENT_CHARS)}\n\n[Content truncated for model limits]`;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
