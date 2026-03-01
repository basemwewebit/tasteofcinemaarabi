import { describe, it, expect } from 'vitest';
import { tokenizeMdx } from '../../../src/lib/mdx/tokenizer';

describe('MDX Tokenizer Sanitization', () => {
    it('should replace = and ; with HTML entities in plain text', () => {
        const input = 'This is valid = text and it ends with ;';
        const expected = 'This is valid &#61; text and it ends with &#59;';
        expect(tokenizeMdx(input)).toBe(expected);
    });

    it('should NOT replace = and ; inside code blocks', () => {
        const input = 'Check this code:\n```javascript\nconst a = 1;\nconsole.log(a);\n```\nOutside again.';
        const expected = 'Check this code:\n```javascript\nconst a = 1;\nconsole.log(a);\n```\nOutside again.';
        expect(tokenizeMdx(input)).toBe(expected);
    });

    it('should NOT replace = and ; inside inline code', () => {
        const input = 'The variable `a = 1;` should be unchanged.';
        const expected = 'The variable `a = 1;` should be unchanged.';
        expect(tokenizeMdx(input)).toBe(expected);
    });

    it('should NOT replace = and ; inside JSX tags', () => {
        const input = '<Component prop="value" /> and some text = ;';
        const expected = '<Component prop="value" /> and some text &#61; &#59;';
        expect(tokenizeMdx(input)).toBe(expected);
    });

    it('should handle complex mixed content accurately', () => {
        const input = `
# Title =
Some text;
\`inline = code;\`
<div className="test">
  Content =
  \`\`\`
  block = code;
  \`\`\`
</div>
Finished;
        `.trim();
        const expected = `
# Title &#61;
Some text&#59;
\`inline = code;\`
<div className="test">
  Content &#61;
  \`\`\`
  block = code;
  \`\`\`
</div>
Finished&#59;
        `.trim();
        expect(tokenizeMdx(input)).toBe(expected);
    });

    it('should handle nested state-like sequences moderately', () => {
        // Though MDX doesn't support nested code blocks well, we should ensure the state machine recovers
        const input = 'Outside. `inline`. **Bold = ;**. Outside again.';
        const expected = 'Outside. `inline`. **Bold &#61; &#59;**. Outside again.';
        expect(tokenizeMdx(input)).toBe(expected);
    });

    it('should handle malformed tags gracefully', () => {
        // If we see an opening < but no closing >, we should eventually recover or treat it safely
        const input = 'Text < and = ;';
        // In a simple state machine, once it sees < it might stay in TAG state until newline or >
        // But for our purposes, if it's not a valid tag opening, we might want to sanitize anyway.
        // However, a simple state machine is often better than complex regex.
        const output = tokenizeMdx(input);
        expect(output).toContain('&#61;');
        expect(output).toContain('&#59;');
    });
});
