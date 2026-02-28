import { describe, it, expect } from 'vitest';
import { splitIntoChunks } from '@/lib/ai/translate';

// ══════════════════════════════════════════════════════════════════════════
// splitIntoChunks — smart content chunking at heading/paragraph boundaries
// ══════════════════════════════════════════════════════════════════════════

describe('splitIntoChunks', () => {
    it('should return single chunk when content is under threshold', () => {
        const content = '<p>Short content.</p>';
        const result = splitIntoChunks(content, 1000);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(content);
    });

    it('should return single chunk for empty content', () => {
        const result = splitIntoChunks('', 1000);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('');
    });

    it('should split at <h2> boundaries when content exceeds threshold', () => {
        const section1 = '<h2>Section 1</h2>' + '<p>' + 'A'.repeat(500) + '</p>';
        const section2 = '<h2>Section 2</h2>' + '<p>' + 'B'.repeat(500) + '</p>';
        const content = section1 + section2;

        // Set threshold low enough to force a split
        const result = splitIntoChunks(content, 600);

        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result[0]).toContain('Section 1');
        expect(result[result.length - 1]).toContain('Section 2');
    });

    it('should split at <h3> boundaries when h2 chunks are still too large', () => {
        // One h2 section with multiple h3 sub-sections
        const sub1 = '<h3>Sub 1</h3>' + '<p>' + 'A'.repeat(400) + '</p>';
        const sub2 = '<h3>Sub 2</h3>' + '<p>' + 'B'.repeat(400) + '</p>';
        const content = '<h2>Big Section</h2>' + sub1 + sub2;

        // h2 split produces one chunk still over threshold → falls to h3
        const result = splitIntoChunks(content, 500);

        expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should split at <p> boundaries as last resort', () => {
        const para1 = '<p>' + 'A'.repeat(300) + '</p>';
        const para2 = '<p>' + 'B'.repeat(300) + '</p>';
        const para3 = '<p>' + 'C'.repeat(300) + '</p>';
        const content = para1 + para2 + para3;

        const result = splitIntoChunks(content, 400);

        expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should merge tiny adjacent chunks', () => {
        // 5 tiny h2 sections
        const sections = Array.from({ length: 5 }, (_, i) =>
            `<h2>S${i}</h2><p>Text ${i}</p>`
        );
        const content = sections.join('');

        // Threshold is very large — everything should fit in one chunk
        const result = splitIntoChunks(content, 100000);

        expect(result).toHaveLength(1);
    });

    it('should preserve heading tags in their chunks', () => {
        const content = '<h2>Title A</h2><p>Content A.</p><h2>Title B</h2><p>Content B.</p>';
        const result = splitIntoChunks(content, 40);

        for (const chunk of result) {
            // Each chunk that has content should contain its heading
            if (chunk.includes('Content A')) {
                expect(chunk).toContain('<h2>Title A</h2>');
            }
            if (chunk.includes('Content B')) {
                expect(chunk).toContain('<h2>Title B</h2>');
            }
        }
    });

    it('should handle content with no headings', () => {
        const content = '<p>' + 'A'.repeat(1000) + '</p><p>' + 'B'.repeat(1000) + '</p>';
        const result = splitIntoChunks(content, 1200);

        // No h2/h3 to split on, falls to <p> boundary
        expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should use default threshold when not specified', () => {
        // Default threshold is 30000, short content should be single chunk
        const content = '<p>Short.</p>';
        const result = splitIntoChunks(content);

        expect(result).toHaveLength(1);
    });

    it('should handle h2 tags with attributes', () => {
        const content = '<h2 id="first" class="title">Section 1</h2>' +
            '<p>' + 'A'.repeat(500) + '</p>' +
            '<h2 id="second">Section 2</h2>' +
            '<p>' + 'B'.repeat(500) + '</p>';

        const result = splitIntoChunks(content, 600);
        expect(result.length).toBeGreaterThanOrEqual(2);
    });
});
