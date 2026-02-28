import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const VOID_TAGS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

function sanitizeForMdx(content: string): string {
    let normalized = content;

    // React expects style as object; string inline styles in imported HTML break rendering.
    normalized = normalized.replace(/\sstyle=(["']).*?\1/gi, '');

    // The AI might truncate translations leaving unclosed HTML tags (like <p><span>...).
    // We use Cheerio to safely parse and re-serialize the markup, forcing tag completion.
    try {
        const $ = cheerio.load(normalized, null, false);
        normalized = $.html();
    } catch {
        // Fallback to original if cheerio fails inexplicably
    }

    // Normalize common HTML attributes to React/JSX prop casing.
    normalized = normalized
        .replace(/\sclass=/gi, ' className=')
        .replace(/\sfetchpriority=/gi, ' fetchPriority=')
        .replace(/\ssrcset=/gi, ' srcSet=')
        .replace(/\stabindex=/gi, ' tabIndex=')
        .replace(/\sreadonly=/gi, ' readOnly=')
        .replace(/\smaxlength=/gi, ' maxLength=')
        .replace(/\sminlength=/gi, ' minLength=')
        .replace(/\scolspan=/gi, ' colSpan=')
        .replace(/\srowspan=/gi, ' rowSpan=')
        .replace(/\sfor=/gi, ' htmlFor=');

    // MDX parses HTML-like tags as JSX; void tags must be self-closing.
    for (const tag of VOID_TAGS) {
        const pattern = new RegExp(`<${tag}(\\s[^>]*?)?>`, 'gi');
        normalized = normalized.replace(pattern, (match, attrs = '') => {
            if (/\/\s*>$/.test(match)) {
                return match;
            }
            return `<${tag}${attrs} />`;
        });
    }

    return normalized;
}

export async function saveMarkdownFile(slug: string, mdxContent: string): Promise<string> {
    if (!existsSync(CONTENT_DIR)) {
        mkdirSync(CONTENT_DIR, { recursive: true });
    }

    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
    const sanitized = sanitizeForMdx(mdxContent);
    await fs.writeFile(filePath, sanitized, 'utf-8');

    return filePath;
}

export async function readMarkdownFile(slug: string): Promise<string | null> {
    try {
        const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
        const content = await fs.readFile(filePath, 'utf-8');
        const sanitized = sanitizeForMdx(content);

        // Self-heal old files produced before sanitization.
        if (sanitized !== content) {
            await fs.writeFile(filePath, sanitized, 'utf-8');
        }

        return sanitized;
    } catch (error) {
        console.error(`Error reading markdown file for slug ${slug}:`, error);
        return null;
    }
}

export async function deleteMarkdownFile(slug: string): Promise<boolean> {
    try {
        const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
        if (existsSync(filePath)) {
            await fs.unlink(filePath);
        }
        return true;
    } catch (error) {
        console.error(`Error deleting markdown file for slug ${slug}:`, error);
        return false;
    }
}
