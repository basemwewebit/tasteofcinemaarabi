import { describe, it, expect, vi } from 'vitest';
import { translateArticle, insertPlaceholders, restorePlaceholders } from '@/lib/ai/translate';

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

describe('insertPlaceholders', () => {
    it('should replace titles with [[TITLE_N]] tokens', () => {
        const content = 'The film Taxi Driver is a masterpiece. Taxi Driver was released in 1976.';
        const titles = ['Taxi Driver'];

        const result = insertPlaceholders(content, titles);

        expect(result.processed).toBe('The film [[TITLE_1]] is a masterpiece. [[TITLE_1]] was released in 1976.');
        expect(result.map).toHaveLength(1);
        expect(result.map[0]).toEqual({ placeholder: '[[TITLE_1]]', original: 'Taxi Driver' });
    });

    it('should sort by length descending to prevent partial matches', () => {
        const content = 'Watch The Godfather Part II and The Godfather tonight.';
        const titles = ['The Godfather', 'The Godfather Part II'];

        const result = insertPlaceholders(content, titles);

        // "The Godfather Part II" (longer) should be matched first
        expect(result.processed).toContain('[[TITLE_1]]');
        expect(result.processed).toContain('[[TITLE_2]]');
        // "The Godfather Part II" is index 1 (longest first), "The Godfather" is index 2
        expect(result.map[0].original).toBe('The Godfather Part II');
        expect(result.map[1].original).toBe('The Godfather');
        expect(result.processed).toBe('Watch [[TITLE_1]] and [[TITLE_2]] tonight.');
    });

    it('should handle regex special characters in titles', () => {
        const content = 'The film M*A*S*H (1970) is a classic.';
        const titles = ['M*A*S*H (1970)'];

        const result = insertPlaceholders(content, titles);

        expect(result.processed).toBe('The film [[TITLE_1]] is a classic.');
        expect(result.map[0].original).toBe('M*A*S*H (1970)');
    });

    it('should return original content when no titles provided', () => {
        const content = 'Just some text.';

        const result = insertPlaceholders(content, []);
        expect(result.processed).toBe(content);
        expect(result.map).toHaveLength(0);
    });

    it('should skip titles not found in content', () => {
        const content = 'A great film about nothing.';
        const titles = ['Nonexistent Movie'];

        const result = insertPlaceholders(content, titles);

        expect(result.processed).toBe(content);
        expect(result.map).toHaveLength(0);
    });

    it('should handle non-Latin titles (CJK, French)', () => {
        const content = 'The classic 七人の侍 by Kurosawa and Le Samouraï by Melville.';
        const titles = ['七人の侍', 'Le Samouraï'];

        const result = insertPlaceholders(content, titles);

        expect(result.processed).toContain('[[TITLE_1]]');
        expect(result.processed).toContain('[[TITLE_2]]');
        expect(result.processed).not.toContain('七人の侍');
        expect(result.processed).not.toContain('Le Samouraï');
    });
});

describe('restorePlaceholders', () => {
    it('should restore tokens to original titles', () => {
        const translated = 'الفيلم [[TITLE_1]] تحفة فنية. [[TITLE_1]] صدر عام 1976.';
        const map = [{ placeholder: '[[TITLE_1]]', original: 'Taxi Driver' }];

        const result = restorePlaceholders(translated, map);

        expect(result).toBe('الفيلم Taxi Driver تحفة فنية. Taxi Driver صدر عام 1976.');
    });

    it('should handle fuzzy matching with extra whitespace', () => {
        const translated = 'Watch [[ TITLE_1 ]] tonight.';
        const map = [{ placeholder: '[[TITLE_1]]', original: 'The Godfather' }];

        const result = restorePlaceholders(translated, map);

        expect(result).toBe('Watch The Godfather tonight.');
    });

    it('should be a no-op when map is empty', () => {
        const translated = 'Some Arabic text without placeholders.';

        const result = restorePlaceholders(translated, []);

        expect(result).toBe(translated);
    });

    it('should restore multiple different titles', () => {
        const translated = '[[TITLE_1]] أفضل من [[TITLE_2]] حسب النقاد.';
        const map = [
            { placeholder: '[[TITLE_1]]', original: 'The Godfather Part II' },
            { placeholder: '[[TITLE_2]]', original: 'The Godfather' },
        ];

        const result = restorePlaceholders(translated, map);

        expect(result).toBe('The Godfather Part II أفضل من The Godfather حسب النقاد.');
    });

    it('should leave unmatched placeholders as-is', () => {
        const translated = 'Watch [[TITLE_99]] tonight.';
        const map = [{ placeholder: '[[TITLE_1]]', original: 'Taxi Driver' }];

        const result = restorePlaceholders(translated, map);

        expect(result).toBe('Watch [[TITLE_99]] tonight.');
    });
});
