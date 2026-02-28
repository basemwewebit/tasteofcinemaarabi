import * as cheerio from 'cheerio';
import { ScrapeResponse } from '@/types/api';

/**
 * Scrapes a tasteofcinema.com article and handles pagination if multiple pages exist.
 */
export async function scrapeArticle(url: string): Promise<ScrapeResponse> {
    try {
        const fetchPage = async (pageUrl: string) => {
            const response = await fetch(pageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${pageUrl}: ${response.statusText}`);
            }
            return await response.text();
        };

        const fullHtml = await fetchPage(url);
        const $ = cheerio.load(fullHtml);

        // Core details
        const title = $('.entry-title').first().text().trim() || $('title').text().trim();
        const author = $('.author-name').text().trim() || 'Taste of Cinema';

        // Attempt pagination
        let rawContent = extractContent($('.entry-content'));

        // Taste of cinema pagination typically looks like `<div class="pagination">...`
        // Wait, the specification (T017) says: Add pagination handling inside the scraper logic to ensure full article ingestion
        // Let's grab next page link if it exists
        let nextLink = $('.pagination .next').attr('href');

        while (nextLink) {
            try {
                const nextHtml = await fetchPage(nextLink);
                const $next = cheerio.load(nextHtml);
                const nextContent = extractContent($next('.entry-content'));

                rawContent += `\n\n${nextContent}`;

                nextLink = $next('.pagination .next').attr('href');
            } catch (err) {
                console.warn('Pagination fetch failed:', err);
                break;
            }
        }

        return {
            success: true,
            data: {
                title,
                content: cleanHTML(rawContent),
                url,
                author
            }
        };
    } catch (err: unknown) {
        console.error('Scrape error:', err);
        return {
            success: false,
            error: 'Failed to scrape article',
            data: undefined
        };
    }
}

/**
 * Helper to pull just the necessary tags from the main content container
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContent($el: cheerio.Cheerio<any>): string {
    // Return early if not found
    if (!$el.length) return '';

    // They usually have <p>, <h2>, <h3>. 
    // Let's extract the main tags.
    const contentStack: string[] = [];

    $el.children().each((_, el) => {
        // Avoid scripts, ads, social shares
        if (el.tagName === 'script' || el.tagName === 'style' || el.tagName === 'iframe') return;

        // We can just grab the outerHTML of the element if it's a p or heading
        const tag = el.tagName.toLowerCase();
        if (['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote'].includes(tag)) {
            contentStack.push(cheerio.load(el).html() || '');
        }
    });

    return contentStack.join('\n');
}

function cleanHTML(str: string): string {
    // Strip out multiple newlines, ad placeholders, etc.
    return str.replace(/\n\s*\n/g, '\n\n').trim();
}
