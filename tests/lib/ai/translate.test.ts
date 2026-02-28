import { describe, it, expect, vi } from 'vitest';
import { translateArticle } from '@/lib/ai/translate';

// We must mock openai so we don't hit the real API in our fast unit tests.
vi.mock('openai', () => {
    return {
        default: class OpenAI {
            chat = {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [
                            {
                                message: {
                                    content: JSON.stringify({
                                        title_ar: "10 أفلام رائعة",
                                        title_en: "10 Great Movies",
                                        excerpt_ar: "مقدمة فيلم",
                                        content_mdx: "# 1. العراب\nتحفة فنية",
                                        category: "lists",
                                        tags: ["drama", "classic"],
                                        slug: "10-great-movies"
                                    })
                                }
                            }
                        ]
                    })
                }
            }
        }
    };
});

describe('OpenAI Translation Pipeline', () => {
    it('should translate english content to Arabic using mock', async () => {
        const result = await translateArticle({
            url: 'http://test.com',
            title: '10 Great Movies',
            content: '<p>A masterpiece by Coppola.</p>'
        });

        expect(result.success).toBe(true);
        expect(result.data?.title_ar).toBe('10 أفلام رائعة');
        expect(result.data?.content_mdx).toContain('# 1. العراب');
    });
});
