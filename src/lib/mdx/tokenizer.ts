/**
 * Context-aware MDX content tokenizer/sanitizer.
 * Iterates through raw content and replaces characters that break MDX compilation
 * (= and ;) with safe HTML entities only when outside of code blocks, inline code, or JSX tags.
 */
export function tokenizeMdx(content: string): string {
    if (!content) return '';

    let result = '';
    let i = 0;
    let isCodeBlock = false;
    let isInlineCode = false;
    let isInsideTag = false;

    while (i < content.length) {
        const char = content[i];
        const nextTwo = content.slice(i, i + 3);

        // 1. Check for Code Block boundaries (```)
        if (nextTwo === '```') {
            isCodeBlock = !isCodeBlock;
            result += '```';
            i += 3;
            continue;
        }

        // In code block, we ignore everything else
        if (isCodeBlock) {
            result += char;
            i++;
            continue;
        }

        // 2. Check for Inline Code boundaries (`)
        if (char === '`') {
            isInlineCode = !isInlineCode;
            result += char;
            i++;
            continue;
        }

        // In inline code, we ignore everything else
        if (isInlineCode) {
            result += char;
            i++;
            continue;
        }

        // 3. Check for Tag boundaries (< and >)
        // Note: Simple state machine, doesn't handle nested JSX perfectly but works for basic sanitization
        if (char === '<' && !isInsideTag) {
            // Check if it's followed by a space (likely "less than") or a char (likely a tag)
            const nextChar = content[i + 1];
            if (nextChar && /[a-zA-Z/]/.test(nextChar)) {
                isInsideTag = true;
            }
        }

        if (char === '>' && isInsideTag) {
            isInsideTag = false;
            result += char;
            i++;
            continue;
        }

        if (isInsideTag) {
            result += char;
            i++;
            continue;
        }

        // 4. Sanitize context-free character
        if (char === '=') {
            result += '&#61;';
        } else if (char === ';') {
            result += '&#59;';
        } else {
            result += char;
        }

        i++;
    }

    return result;
}
