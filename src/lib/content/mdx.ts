import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { tokenizeMdx } from '../mdx/tokenizer';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const VOID_TAGS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

function sanitizeForMdx(content: string): string {
    // 0. Tokenize content to escape = and ; outside of code/tags
    let normalized = tokenizeMdx(content);

    // React expects style as object; string inline styles in imported HTML break rendering.
    normalized = normalized.replace(/\sstyle=(["']).*?\1/gi, '');

    // The AI might truncate translations leaving unclosed HTML tags (like <p><span>...).
    // We use Cheerio to safely parse and re-serialize the markup, forcing tag completion.
    try {
        const $ = cheerio.load(normalized, null, false);

        // 1. Remove WordPress pagination links
        $('.page-links, [classname*="page-links"], [className*="page-links"]').remove();

        // 2. Remove empty or garbage-only paragraphs
        $('p').each(function () {
            const el = $(this);
            // Do not remove if it contains media
            if (el.find('img, iframe, video, audio, picture, source').length > 0) return;

            // Check the textual content of the paragraph
            const textContent = el.text()
                // Strip known garbage
                .replace(/&nbsp;/gi, '')
                .replace(/&amp;/gi, '')
                .replace(/[&;]/g, '') // strip & and ;
                .replace(/(nbsp)+/gi, '')
                .replace(/[\u00a0\u200b-\u200d\u2066-\u2069]/g, '')
                .replace(/\s+/g, '') // remove all whitespace
                .trim();

            if (textContent === '') {
                // Check if it's literally just HTML entities that .text() might not decode fully if malformed
                const rawHtml = (el.html() || '').replace(/&[a-zA-Z]+;/g, '').replace(/[&;]/g, '').replace(/nbsp/g, '').trim();
                if (!rawHtml.match(/[a-zA-Z0-9\u0600-\u06FF]/)) {
                    el.remove();
                }
            }
        });

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
