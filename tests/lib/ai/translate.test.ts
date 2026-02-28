import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    translateArticle,
    insertPlaceholders,
    restorePlaceholders,
    toEasternArabicNumerals,
    applyBidiIsolation,
    formatArabicQuotationMarks,
    buildQualityReport,
} from '@/lib/ai/translate';
import type { PhaseReport, ReviewPhaseReport, ProofreadPhaseReport } from '@/types/api';

// ── Mock state ──
// The 3-phase pipeline calls ai.chat.completions.create 3 times per chunk.
// We track call order to return the correct mock response per phase.
let createCallCount = 0;

const PHASE1_RESPONSE = {
    title_ar: '١٠ أفلام رائعة',
    title_en: '10 Great Movies',
    excerpt_ar: 'مقدمة فيلم',
    content_mdx: '# ١. العراب\nتحفة فنية',
    category: 'lists',
    tags: ['drama', 'classic'],
    slug: '10-great-movies',
};

const PHASE2_RESPONSE = {
    corrected_text: '# ١. العراب\nتحفة فنية سينمائية',
    corrections: [
        { before: 'تحفة فنية', after: 'تحفة فنية سينمائية', type: 'accuracy', explanation: 'Added specificity' },
    ],
    new_terms_discovered: [],
};

const PHASE3_RESPONSE = {
    polished_text: '# ١. العراب\nتحفة فنية سينمائية خالدة',
    polishes: [
        { before: 'سينمائية', after: 'سينمائية خالدة', type: 'flow', explanation: 'Better flow' },
    ],
};

function makeMockAIResponse(content: object, promptTokens = 500, completionTokens = 300) {
    return {
        choices: [{ message: { content: JSON.stringify(content) } }],
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
    };
}

vi.mock('openai', () => {
    return {
        default: class OpenAI {
            chat = {
                completions: {
                    create: vi.fn().mockImplementation(() => {
                        createCallCount++;
                        if (createCallCount % 3 === 1) {
                            // Phase 1 - Translate
                            return Promise.resolve(makeMockAIResponse(PHASE1_RESPONSE));
                        } else if (createCallCount % 3 === 2) {
                            // Phase 2 - Review
                            return Promise.resolve(makeMockAIResponse(PHASE2_RESPONSE));
                        } else {
                            // Phase 3 - Proofread
                            return Promise.resolve(makeMockAIResponse(PHASE3_RESPONSE));
                        }
                    }),
                },
            };
        },
    };
});

// Mock the glossary and banned-patterns to avoid file-system dependency
vi.mock('@/lib/ai/glossary', () => ({
    loadGlossary: vi.fn().mockReturnValue({
        version: 1,
        updated_at: '2025-01-01T00:00:00Z',
        entries: [
            { en: 'film noir', ar: 'فيلم نوار', context: 'genre', approved: true },
        ],
    }),
    filterRelevantTerms: vi.fn().mockReturnValue([]),
    formatGlossaryForPrompt: vi.fn().mockReturnValue(''),
    extractDiscoveredTerms: vi.fn().mockReturnValue([]),
    addDiscoveredTerms: vi.fn().mockReturnValue(0),
}));

// Mock fs for banned-patterns.json loading
vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    return {
        ...actual,
        default: {
            ...actual,
            readFileSync: vi.fn().mockImplementation((filePath: string, encoding?: string) => {
                if (typeof filePath === 'string' && filePath.includes('banned-patterns.json')) {
                    return JSON.stringify([
                        { id: 'bp-001', literal_ar: 'يلعب دوراً', natural_ar: 'يؤدّي دور', en_source: 'plays a role' },
                    ]);
                }
                return actual.readFileSync(filePath, encoding as BufferEncoding);
            }),
            existsSync: actual.existsSync,
        },
        readFileSync: vi.fn().mockImplementation((filePath: string, encoding?: string) => {
            if (typeof filePath === 'string' && filePath.includes('banned-patterns.json')) {
                return JSON.stringify([
                    { id: 'bp-001', literal_ar: 'يلعب دوراً', natural_ar: 'يؤدّي دور', en_source: 'plays a role' },
                ]);
            }
            return actual.readFileSync(filePath, encoding as BufferEncoding);
        }),
    };
});

beforeEach(() => {
    createCallCount = 0;
});

// ═══════════════════════════════════════════════════════════════════════════
// 3-Phase Translation Pipeline
// ═══════════════════════════════════════════════════════════════════════════

describe('3-Phase Translation Pipeline', () => {
    it('should call the AI 3 times (one per phase) for a single chunk', async () => {
        const result = await translateArticle({
            url: 'http://test.com',
            title: '10 Great Movies',
            content: '<p>A masterpiece by Coppola.</p>',
        });

        expect(result.success).toBe(true);
        expect(createCallCount).toBe(3);
    });

    it('should return translated title_ar from Phase 1', async () => {
        const result = await translateArticle({
            url: 'http://test.com',
            title: '10 Great Movies',
            content: '<p>A masterpiece.</p>',
        });

        expect(result.success).toBe(true);
        expect(result.data?.title_ar).toBeTruthy();
    });

    it('should return polished content from Phase 3', async () => {
        const result = await translateArticle({
            url: 'http://test.com',
            title: 'Test',
            content: '<p>Content here.</p>',
        });

        expect(result.success).toBe(true);
        // Phase 3's polished_text should be used
        expect(result.data?.content_mdx).toBeTruthy();
    });

    it('should include quality_report in the response', async () => {
        const result = await translateArticle({
            url: 'http://test.com',
            title: 'Test',
            content: '<p>Content.</p>',
        });

        expect(result.success).toBe(true);
        expect(result.quality_report).toBeDefined();
        expect(result.quality_report?.v).toBe(1);
        expect(result.quality_report?.phases).toBeDefined();
        expect(result.quality_report?.phases.translate).toBeDefined();
        expect(result.quality_report?.phases.review).toBeDefined();
        expect(result.quality_report?.phases.proofread).toBeDefined();
        expect(result.quality_report?.totals).toBeDefined();
    });

    it('should populate token counts in quality report', async () => {
        const result = await translateArticle({
            url: 'http://test.com',
            title: 'Test',
            content: '<p>Content.</p>',
        });

        expect(result.success).toBe(true);
        const report = result.quality_report!;
        expect(report.totals.tokens_in).toBeGreaterThan(0);
        expect(report.totals.tokens_out).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Placeholder insertion / restoration
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Post-processing functions
// ═══════════════════════════════════════════════════════════════════════════

describe('toEasternArabicNumerals', () => {
    it('should convert Western digits to Eastern Arabic', () => {
        expect(toEasternArabicNumerals('0123456789')).toBe('٠١٢٣٤٥٦٧٨٩');
    });

    it('should not modify text without digits', () => {
        const text = 'مرحباً بالعالم';
        expect(toEasternArabicNumerals(text)).toBe(text);
    });

    it('should preserve [IMAGE_N] markers', () => {
        const text = 'قبل [IMAGE_3] بعد';
        expect(toEasternArabicNumerals(text)).toBe('قبل [IMAGE_3] بعد');
    });

    it('should preserve [[TITLE_N]] markers', () => {
        const text = 'فيلم [[TITLE_12]] رائع';
        expect(toEasternArabicNumerals(text)).toBe('فيلم [[TITLE_12]] رائع');
    });

    it('should preserve URLs', () => {
        const text = 'رابط https://example.com/page/42 هنا';
        expect(toEasternArabicNumerals(text)).toBe('رابط https://example.com/page/42 هنا');
    });

    it('should preserve inline code', () => {
        const text = 'الكود `x = 5` هنا';
        expect(toEasternArabicNumerals(text)).toBe('الكود `x = 5` هنا');
    });

    it('should convert digits outside protected zones', () => {
        const text = 'عدد 42 فيلم و [IMAGE_1] و 7 أخرى';
        const result = toEasternArabicNumerals(text);
        expect(result).toContain('٤٢');
        expect(result).toContain('[IMAGE_1]');
        expect(result).toContain('٧');
    });
});

describe('applyBidiIsolation', () => {
    const FSI = '\u2068';
    const PDI = '\u2069';

    it('should wrap Latin text in Arabic context with FSI/PDI', () => {
        const text = 'فيلم Taxi Driver رائع';
        const result = applyBidiIsolation(text);
        expect(result).toContain(`${FSI}Taxi Driver${PDI}`);
    });

    it('should not modify pure Arabic text', () => {
        const text = 'نص عربي فقط';
        expect(applyBidiIsolation(text)).toBe(text);
    });

    it('should handle multiple Latin segments', () => {
        const text = 'فيلم The Godfather وفيلم Taxi Driver من أعظم الأفلام';
        const result = applyBidiIsolation(text);
        expect(result).toContain(`${FSI}The Godfather${PDI}`);
        expect(result).toContain(`${FSI}Taxi Driver${PDI}`);
    });
});

describe('formatArabicQuotationMarks', () => {
    it('should convert straight double quotes to guillemets', () => {
        expect(formatArabicQuotationMarks('"مرحباً"')).toBe('«مرحباً»');
    });

    it('should convert curly double quotes to guillemets', () => {
        expect(formatArabicQuotationMarks('\u201Cمرحباً\u201D')).toBe('«مرحباً»');
    });

    it('should handle multiple quoted segments', () => {
        const text = '"أول" و "ثاني"';
        const result = formatArabicQuotationMarks(text);
        expect(result).toBe('«أول» و «ثاني»');
    });

    it('should not modify already-correct guillemets', () => {
        const text = '«صحيح»';
        expect(formatArabicQuotationMarks(text)).toBe('«صحيح»');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildQualityReport
// ═══════════════════════════════════════════════════════════════════════════

describe('buildQualityReport', () => {
    it('should assemble a report with correct totals', () => {
        const phase1: PhaseReport = { status: 'success', duration_ms: 1000, tokens_in: 500, tokens_out: 300, retries: 0 };
        const phase2: ReviewPhaseReport = { status: 'success', duration_ms: 800, tokens_in: 600, tokens_out: 400, retries: 0, corrections: 2, by_type: { accuracy: 1, terminology: 1 }, new_terms: 1 };
        const phase3: ProofreadPhaseReport = { status: 'success', duration_ms: 600, tokens_in: 400, tokens_out: 200, retries: 0, polishes: 1, by_type: { flow: 1 } };

        const report = buildQualityReport(
            'test-model', 1, Date.now() - 5000,
            phase1, phase2, phase3,
            ['new term'],
        );

        expect(report.v).toBe(1);
        expect(report.model).toBe('test-model');
        expect(report.chunks).toBe(1);
        expect(report.totals.tokens_in).toBe(1500);
        expect(report.totals.tokens_out).toBe(900);
        expect(report.totals.corrections).toBe(3);
        expect(report.totals.new_terms).toEqual(['new term']);
        expect(report.ts).toBeTruthy();
    });

    it('should include phase-level details', () => {
        const phase1: PhaseReport = { status: 'success', duration_ms: 100, tokens_in: 10, tokens_out: 10, retries: 0 };
        const phase2: ReviewPhaseReport = { status: 'failed', duration_ms: 50, tokens_in: 5, tokens_out: 5, retries: 1, corrections: 0, by_type: {}, new_terms: 0 };
        const phase3: ProofreadPhaseReport = { status: 'skipped', duration_ms: 0, tokens_in: 0, tokens_out: 0, retries: 0, polishes: 0, by_type: {} };

        const report = buildQualityReport(
            'test-model', 1, Date.now() - 1000,
            phase1, phase2, phase3,
            [],
        );

        expect(report.phases.translate.status).toBe('success');
        expect(report.phases.review.status).toBe('failed');
        expect(report.phases.proofread.status).toBe('skipped');
    });
});
