import { describe, expect, it } from 'vitest';
import { sanitizeForMdx } from '@/lib/content/mdx';

describe('sanitizeForMdx', () => {
    it('unwraps entry-content wrappers and removes page-links', () => {
        const input = `
<div class="entry-content">
  <p>فقرة أولى</p>
  <div class="page-links">Pages: <a href="/2/">2</a></div>
</div>
        `.trim();

        const output = sanitizeForMdx(input);
        expect(output).toContain('<p>فقرة أولى</p>');
        expect(output).not.toContain('entry-content');
        expect(output).not.toContain('page-links');
    });

    it('removes empty paragraphs and spans', () => {
        const input = `
<p><span> </span></p>
<p><span>&nbsp;</span></p>
<p>نص صالح</p>
        `.trim();

        const output = sanitizeForMdx(input);
        expect(output).toContain('<p>نص صالح</p>');
        expect(output).not.toContain('&nbsp;');
        expect(output).not.toContain('<span>');
    });

    it('normalizes classname attr and fixes img closing tags', () => {
        const input = `
<p>
  <img classname="aligncenter size-full" src="/x.webp" alt="x" width="560" height="320"></img>
</p>
        `.trim();

        const output = sanitizeForMdx(input);
        expect(output).toContain('className="aligncenter size-full"');
        expect(output).toContain('<img');
        expect(output).toContain('/>');
        expect(output).not.toContain('</img>');
    });
});
