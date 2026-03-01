import fs from 'fs';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'content');

interface CliOptions {
    slug?: string;
    all: boolean;
}

function cleanInvisibleChars(text: string): string {
    return text
        .replace(/[\u200b\u200c\u200d\u00ad\u2068\u2069]/g, '')
        .replace(/;{3,}/g, '')
        .replace(/\u00a0/g, ' ');
}

function normalizeWhitespace(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ');
}

function normalizeBlankLines(text: string): string {
    return text.replace(/\n{3,}/g, '\n\n');
}

function normalizeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;;/gi, '&')
        .replace(/&amp;/gi, '&')
        .replace(/&nbsp;/gi, ' ');
}

function promoteNumberedItemsToH2(text: string): string {
    const lines = text.split('\n');
    const output: string[] = [];
    let inCodeBlock = false;

    for (const line of lines) {
        if (line.trimStart().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            output.push(line);
            continue;
        }

        if (inCodeBlock || /^\s*#{1,6}\s/.test(line)) {
            output.push(line);
            continue;
        }

        const match = line.match(/^\s*(?:\*\*)?([0-9\u0660-\u0669]+[.)]\s+.+?)(?:\*\*)?\s*$/u);
        if (match) {
            output.push(`## ${match[1].trim()}`);
            continue;
        }

        output.push(line);
    }

    return output.join('\n');
}

function toLatinNumerals(text: string): string {
    return text.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function formatArabicQuotationMarks(text: string): string {
    const protectedZones: Array<{ start: number; end: number }> = [];
    for (const match of text.matchAll(/<[^>]+>/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    function isInsideTag(index: number): boolean {
        return protectedZones.some((z) => index >= z.start && index < z.end);
    }

    let result = '';
    let inDoubleQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (char === '"' && !isInsideTag(i)) {
            if (!inDoubleQuotes) {
                result += '«';
                inDoubleQuotes = true;
            } else {
                result += '»';
                inDoubleQuotes = false;
            }
        } else {
            result += char;
        }
    }

    result = result.replace(/\u201C([^\u201D]*)\u201D/g, '«$1»');
    result = result.replace(/[\u2018\u2019]/g, '');
    return result;
}

function sanitizeForMdx(content: string): string {
    let normalized = content;

    normalized = normalized.replace(/\sstyle=(["']).*?\1/gi, '');
    normalized = normalized.replace(/<div[^>]*(?:class|className|classname)=(["'])[^"']*page-links[^"']*\1[^>]*>[\s\S]*?<\/div>/gi, '');

    normalized = normalized
        .replace(/<div[^>]*(?:class|className|classname)=(["'])[^"']*entry-content[^"']*\1[^>]*>/gi, '')
        .replace(/<\/div>/gi, '\n');

    normalized = normalized
        .replace(/\sclassname=/gi, ' className=')
        .replace(/\sclass=/gi, ' className=')
        .replace(/\sfetchpriority=/gi, ' fetchPriority=')
        .replace(/\ssrcset=/gi, ' srcSet=')
        .replace(/=«([^»]*)»/g, '="$1"')
        .replace(/\s+\/\s*\/>/g, ' />');

    normalized = normalized
        .replace(/<img\b([^>]*?)>(?:<\/img>)?/gi, (_match, attrs: string) => {
            const trimmed = attrs.trimEnd();
            if (trimmed.endsWith('/')) {
                return `<img${attrs}>`;
            }
            return `<img${attrs} />`;
        })
        .replace(/<p>\s*<span>\s*<\/span>\s*<\/p>/gi, '')
        .replace(/<span>\s*<\/span>/gi, '')
        .replace(/<p>\s*(?:&nbsp;|;|&#59;|\u00a0)*\s*<\/p>/gi, '')
        .replace(/<p>\s*<em>\s*<\/em>\s*<\/p>/gi, '');

    return normalizeBlankLines(normalized);
}

function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = { all: false };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--all') {
            options.all = true;
        } else if (arg === '--slug') {
            options.slug = argv[i + 1];
            i += 1;
        } else if (arg === '.' || arg === './') {
            // Support: npm run content:backfill .
            options.all = true;
        } else if (!arg.startsWith('-') && !options.slug) {
            // Support positional slug: npm run content:backfill my-slug
            options.slug = arg;
        }
    }

    return options;
}

function getTargetFiles(options: CliOptions): string[] {
    if (!fs.existsSync(CONTENT_DIR)) {
        return [];
    }

    if (options.slug) {
        return [path.join(CONTENT_DIR, `${options.slug}.mdx`)];
    }

    if (options.all) {
        return fs
            .readdirSync(CONTENT_DIR)
            .filter((name) => name.endsWith('.mdx'))
            .map((name) => path.join(CONTENT_DIR, name))
            .sort();
    }

    return [];
}

function isStackedAtBottom(text: string): boolean {
    const lines = text.split('\n');
    const headingIndexes: number[] = [];
    const imageIndexes: number[] = [];

    const headingRegex = /^##\s*[0-9]+\s*[.)]\s+/;
    const imageRegex = /<img\b/i;

    lines.forEach((line, i) => {
        if (headingRegex.test(line)) {
            headingIndexes.push(i);
        }
        if (imageRegex.test(line)) {
            imageIndexes.push(i);
        }
    });

    if (headingIndexes.length === 0 || imageIndexes.length < 2) {
        return false;
    }

    const lastHeading = headingIndexes[headingIndexes.length - 1];
    return imageIndexes.every((idx) => idx > lastHeading);
}

function redistributeStackedImages(text: string): string {
    if (!isStackedAtBottom(text)) {
        return text;
    }

    const images = text.match(/<img\b[^>]*\/?>/gi) || [];
    if (images.length === 0) {
        return text;
    }

    let withoutImages = text.replace(/<img\b[^>]*\/?>/gi, '');
    withoutImages = withoutImages
        .replace(/<p>\s*<\/p>/gi, '')
        .replace(/<p>\s*<span>\s*<\/span>\s*<\/p>/gi, '');

    const lines = withoutImages.split('\n');
    const headingRegex = /^##\s*[0-9]+\s*[.)]\s+/;
    const headingCount = lines.filter((line) => headingRegex.test(line)).length;

    if (headingCount === 0) {
        return text;
    }

    const extraBeforeHeadings = Math.max(0, images.length - headingCount);
    const leadingImages = images.slice(0, extraBeforeHeadings);
    const itemImages = images.slice(extraBeforeHeadings);

    const output: string[] = [];
    let leadingInserted = false;
    let itemImageIndex = 0;

    for (const line of lines) {
        if (headingRegex.test(line)) {
            if (!leadingInserted && leadingImages.length > 0) {
                output.push('');
                output.push(...leadingImages);
                output.push('');
                leadingInserted = true;
            }

            output.push(line);
            if (itemImageIndex < itemImages.length) {
                output.push('');
                output.push(itemImages[itemImageIndex]);
                output.push('');
                itemImageIndex += 1;
            }
            continue;
        }

        output.push(line);
    }

    while (itemImageIndex < itemImages.length) {
        output.push('');
        output.push(itemImages[itemImageIndex]);
        output.push('');
        itemImageIndex += 1;
    }

    return normalizeBlankLines(output.join('\n'));
}

function normalizeArticleMdx(input: string): string {
    let result = sanitizeForMdx(input);
    result = cleanInvisibleChars(result);
    result = normalizeWhitespace(result);
    result = normalizeBlankLines(result);
    result = normalizeHtmlEntities(result);
    result = promoteNumberedItemsToH2(result);
    result = toLatinNumerals(result);
    result = formatArabicQuotationMarks(result);
    result = redistributeStackedImages(result);
    result = normalizeBlankLines(result).trim();
    return `${result}\n`;
}

function main(): void {
    const options = parseArgs(process.argv.slice(2));
    const files = getTargetFiles(options);

    if (files.length === 0) {
        console.error('No target MDX files found. Use --slug <slug> or --all.');
        process.exit(1);
    }

    let changed = 0;

    for (const filePath of files) {
        if (!fs.existsSync(filePath)) {
            console.warn(`Skipping missing file: ${filePath}`);
            continue;
        }

        const original = fs.readFileSync(filePath, 'utf-8');
        const normalized = normalizeArticleMdx(original);

        if (normalized !== original) {
            fs.writeFileSync(filePath, normalized, 'utf-8');
            changed += 1;
            console.log(`Updated: ${path.basename(filePath)}`);
        } else {
            console.log(`No changes: ${path.basename(filePath)}`);
        }
    }

    console.log(`Done. Updated ${changed} file(s).`);
}

main();
