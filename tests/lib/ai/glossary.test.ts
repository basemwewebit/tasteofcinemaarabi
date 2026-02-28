import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    loadGlossary,
    filterRelevantTerms,
    formatGlossaryForPrompt,
    extractDiscoveredTerms,
    addDiscoveredTerms,
    GlossaryEntry,
    GlossaryFile,
} from '@/lib/ai/glossary';
import fs from 'fs';
import path from 'path';

// ── Test fixtures ──

const SAMPLE_GLOSSARY: GlossaryFile = {
    version: 1,
    updated_at: '2025-01-01T00:00:00Z',
    entries: [
        { en: 'film noir', ar: 'فيلم نوار', context: 'genre', approved: true },
        { en: 'auteur', ar: 'مُؤلِّف', context: 'director role', approved: true },
        { en: 'mise-en-scène', ar: 'ميزانسين', context: 'technique', approved: true },
        { en: 'tracking shot', ar: 'لقطة تتبّعية', context: 'cinematography', approved: true },
        { en: 'jump cut', ar: 'قطع قفزي', context: 'editing', approved: true },
        { en: 'unapproved term', ar: 'غير مقبول', context: 'test', approved: false },
        { en: 'neorealism', ar: 'الواقعية الجديدة', context: 'movement', approved: true, aliases: ['neo-realism'] },
    ],
};

const GLOSSARY_PATH = path.join(process.cwd(), 'data', 'glossary.json');

// ══════════════════════════════════════════════════════════════════════════
// loadGlossary
// ══════════════════════════════════════════════════════════════════════════

describe('loadGlossary', () => {
    it('should parse the glossary JSON file from disk', () => {
        // Use the real file (tests run from repo root)
        const glossary = loadGlossary();
        expect(glossary.version).toBeGreaterThanOrEqual(1);
        expect(glossary.entries).toBeDefined();
        expect(Array.isArray(glossary.entries)).toBe(true);
        expect(glossary.entries.length).toBeGreaterThan(0);
    });

    it('should have required fields on each entry', () => {
        const glossary = loadGlossary();
        for (const entry of glossary.entries) {
            expect(entry.en).toBeTruthy();
            expect(entry.ar).toBeTruthy();
        }
    });
});

// ══════════════════════════════════════════════════════════════════════════
// filterRelevantTerms
// ══════════════════════════════════════════════════════════════════════════

describe('filterRelevantTerms', () => {
    it('should return entries whose English term appears in source text', () => {
        const source = 'This film noir classic uses tracking shot throughout.';
        const result = filterRelevantTerms(SAMPLE_GLOSSARY.entries, source);

        const terms = result.map(e => e.en);
        expect(terms).toContain('film noir');
        expect(terms).toContain('tracking shot');
    });

    it('should NOT include unapproved entries', () => {
        const source = 'An unapproved term appears here.';
        const result = filterRelevantTerms(SAMPLE_GLOSSARY.entries, source);

        expect(result.map(e => e.en)).not.toContain('unapproved term');
    });

    it('should be case-insensitive', () => {
        const source = 'FILM NOIR is a great genre.';
        const result = filterRelevantTerms(SAMPLE_GLOSSARY.entries, source);

        expect(result.map(e => e.en)).toContain('film noir');
    });

    it('should match aliases', () => {
        const source = 'Italian neo-realism changed cinema forever.';
        const result = filterRelevantTerms(SAMPLE_GLOSSARY.entries, source);

        expect(result.map(e => e.en)).toContain('neorealism');
    });

    it('should return empty array when no terms match', () => {
        const source = 'A completely unrelated text about cooking recipes.';
        const result = filterRelevantTerms(SAMPLE_GLOSSARY.entries, source);

        expect(result).toHaveLength(0);
    });

    it('should cap results at 200 entries', () => {
        // Create 250 entries that all match
        const bigEntries: GlossaryEntry[] = Array.from({ length: 250 }, (_, i) => ({
            en: `term${i}`,
            ar: `مصطلح${i}`,
            approved: true,
        }));
        const source = bigEntries.map(e => e.en).join(' ');
        const result = filterRelevantTerms(bigEntries, source);

        expect(result.length).toBeLessThanOrEqual(200);
    });
});

// ══════════════════════════════════════════════════════════════════════════
// formatGlossaryForPrompt
// ══════════════════════════════════════════════════════════════════════════

describe('formatGlossaryForPrompt', () => {
    it('should return a Markdown table', () => {
        const entries: GlossaryEntry[] = [
            { en: 'film noir', ar: 'فيلم نوار', context: 'genre', approved: true },
        ];
        const result = formatGlossaryForPrompt(entries);

        expect(result).toContain('| English Term | Arabic Translation | Domain |');
        expect(result).toContain('| film noir | فيلم نوار | genre |');
    });

    it('should return empty string for empty entries', () => {
        expect(formatGlossaryForPrompt([])).toBe('');
    });

    it('should handle entries without context', () => {
        const entries: GlossaryEntry[] = [
            { en: 'test', ar: 'اختبار', approved: true },
        ];
        const result = formatGlossaryForPrompt(entries);

        expect(result).toContain('| test | اختبار |  |');
    });
});

// ══════════════════════════════════════════════════════════════════════════
// extractDiscoveredTerms
// ══════════════════════════════════════════════════════════════════════════

describe('extractDiscoveredTerms', () => {
    it('should extract valid terms from review output', () => {
        const output = {
            new_terms_discovered: [
                { en: 'chiaroscuro', ar: 'كياروسكورو', context: 'lighting' },
            ],
        };
        const result = extractDiscoveredTerms(output);

        expect(result).toHaveLength(1);
        expect(result[0].en).toBe('chiaroscuro');
    });

    it('should return empty array when no new_terms_discovered', () => {
        expect(extractDiscoveredTerms({})).toHaveLength(0);
    });

    it('should filter out entries with empty en or ar', () => {
        const output = {
            new_terms_discovered: [
                { en: '', ar: 'something', context: 'test' },
                { en: 'word', ar: '', context: 'test' },
                { en: 'valid', ar: 'صالح', context: 'test' },
            ],
        };
        const result = extractDiscoveredTerms(output);

        expect(result).toHaveLength(1);
        expect(result[0].en).toBe('valid');
    });
});

// ══════════════════════════════════════════════════════════════════════════
// addDiscoveredTerms
// ══════════════════════════════════════════════════════════════════════════

describe('addDiscoveredTerms', () => {
    let originalContent: string;

    beforeEach(() => {
        // Save original glossary to restore later
        originalContent = fs.readFileSync(GLOSSARY_PATH, 'utf-8');
    });

    afterEach(() => {
        // Restore original glossary content
        fs.writeFileSync(GLOSSARY_PATH, originalContent, 'utf-8');
    });

    it('should add new terms to the glossary file', () => {
        const newTerms = [
            { en: 'test-unique-term-xyz123', ar: 'مصطلح اختبار فريد', context: 'test' },
        ];
        const count = addDiscoveredTerms(newTerms);

        expect(count).toBe(1);

        // Verify it was persisted
        const updated = loadGlossary();
        const found = updated.entries.find(e => e.en === 'test-unique-term-xyz123');
        expect(found).toBeDefined();
        expect(found?.approved).toBe(false);
        expect(found?.source).toBe('ai_discovered');
    });

    it('should skip duplicate terms (case-insensitive)', () => {
        // 'film noir' already exists in the glossary
        const glossary = loadGlossary();
        const existingTerm = glossary.entries[0].en;

        const newTerms = [
            { en: existingTerm, ar: 'تكرار', context: 'test' },
        ];
        const count = addDiscoveredTerms(newTerms);

        expect(count).toBe(0);
    });

    it('should return 0 for empty array', () => {
        expect(addDiscoveredTerms([])).toBe(0);
    });

    it('should increment version when terms are added', () => {
        const beforeVersion = loadGlossary().version;

        addDiscoveredTerms([
            { en: 'version-bump-test-xyz456', ar: 'اختبار', context: 'test' },
        ]);

        const afterVersion = loadGlossary().version;
        expect(afterVersion).toBe(beforeVersion + 1);
    });
});
