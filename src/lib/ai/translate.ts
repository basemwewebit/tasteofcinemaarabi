// src/lib/ai/translate.ts
import OpenAI from 'openai';
import { TranslateRequest, TranslateResponse, TranslationQualityReport, PhaseReport, ReviewPhaseReport, ProofreadPhaseReport } from '@/types/api';
import { loadGlossary, filterRelevantTerms, extractDiscoveredTerms, addDiscoveredTerms, GlossaryEntry } from './glossary';
import { buildPhase1SystemMessage, buildPhase1UserMessage, Phase1Output } from './prompts/phase1-translate';
import { buildPhase2SystemMessage, buildPhase2UserMessage, BannedPattern, Phase2Output, Phase2CorrectionItem } from './prompts/phase2-review';
import { buildPhase3SystemMessage, buildPhase3UserMessage, Phase3Output } from './prompts/phase3-proofread';
import fs from 'fs';
import path from 'path';

// ── Placeholder types ──

export interface PlaceholderMap {
    placeholder: string;
    original: string;
}

export interface PlaceholderResult {
    processed: string;
    map: PlaceholderMap[];
}

function getAIClient(): OpenAI {
    const apiKey = process.env.OPENROUTER_API_KEY || (process.env.NODE_ENV === 'test' ? 'test-key' : '');
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured');
    }

    return new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
        defaultHeaders: {
            'HTTP-Referer': 'https://mazaqalsinema.com',
            'X-Title': encodeURIComponent('مذاق السينما'),
        },
    });
}

const MAX_TRANSLATION_RETRIES = 3;
const PHASE_RETRY_LIMIT = 1; // Retry once for phases 2 & 3
const CHUNK_THRESHOLD = 30000;
const BANNED_PATTERNS_PATH = path.join(process.cwd(), 'data', 'banned-patterns.json');

/**
 * Replace every HTML/JSX tag with a simple [TAG_N] text marker.
 * This prevents the AI from mangling attributes like style, src, or class.
 */
export function extractTags(content: string): { processed: string; tags: string[] } {
    const tags: string[] = [];
    const processed = content.replace(/<[^>]+>/gi, (tag) => {
        tags.push(tag);
        return `[TAG_${tags.length}]`;
    });
    return { processed, tags };
}

/**
 * Re-inject extracted tags back into translation.
 */
export function restoreTags(content: string, tags: string[]): string {
    let result = content;
    tags.forEach((tag, i) => {
        const placeholder = `[TAG_${i + 1}]`;
        if (result.includes(placeholder)) {
            result = result.replace(placeholder, tag);
        } else {
            // If the AI dropped the tag, append it at the end to avoid data loss
            result += `\n${tag}`;
        }
    });
    return result;
}

// ── Placeholder substitution for movie title protection ──

/**
 * Replace movie titles in content with [[TITLE_N]] placeholders.
 * Sorts titles by length descending to prevent partial matches.
 * Escapes regex special characters in title text.
 */
export function insertPlaceholders(content: string, movieTitles: string[]): PlaceholderResult {
    if (!movieTitles || movieTitles.length === 0) {
        return { processed: content, map: [] };
    }

    // Sort by length descending — longest first to prevent partial matches
    const sorted = [...movieTitles].sort((a, b) => b.length - a.length);
    const map: PlaceholderMap[] = [];
    let processed = content;

    for (let i = 0; i < sorted.length; i++) {
        const title = sorted[i];
        const placeholder = `[[TITLE_${i + 1}]]`;

        // Escape regex special characters in the title
        const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');

        if (regex.test(processed)) {
            processed = processed.replace(regex, placeholder);
            map.push({ placeholder, original: title });
        }
    }

    return { processed, map };
}

/**
 * Restore [[TITLE_N]] placeholders back to original movie titles.
 * Includes fuzzy fallback matching for whitespace-modified placeholders.
 */
export function restorePlaceholders(translated: string, map: PlaceholderMap[]): string {
    if (!map || map.length === 0) return translated;

    let result = translated;

    // Exact replacement first
    for (const { placeholder, original } of map) {
        result = result.replaceAll(placeholder, original);
    }

    // Fuzzy fallback: match [[  TITLE_N  ]] with extra whitespace
    result = result.replace(/\[\[\s*TITLE_(\d+)\s*\]\]/g, (match, numStr) => {
        const num = parseInt(numStr, 10);
        const entry = map.find(m => m.placeholder === `[[TITLE_${num}]]`);
        return entry ? entry.original : match;
    });

    return result;
}

export async function translateArticle(req: TranslateRequest): Promise<TranslateResponse> {
    const safeTitle = req.title?.trim() || 'Untitled';
    const safeUrl = req.url?.trim() || '';
    const rawContent = req.content || '';

    // Extract tags BEFORE placeholder insertion so tags stay untouched by AI
    const { processed: contentNoTags, tags: extractedTags } = extractTags(rawContent);

    // Insert placeholders for movie titles before translation
    const titlePlaceholders = req.movieTitles
        ? insertPlaceholders(safeTitle, req.movieTitles)
        : { processed: safeTitle, map: [] };
    const contentPlaceholders = req.movieTitles
        ? insertPlaceholders(contentNoTags, req.movieTitles)
        : { processed: contentNoTags, map: [] };

    // Merge both maps (title + content share the same numbering from sorted titles)
    const allMaps = [...titlePlaceholders.map, ...contentPlaceholders.map];
    // Deduplicate by placeholder token
    const uniqueMap = Array.from(
        new Map(allMaps.map(m => [m.placeholder, m])).values()
    );

    const processedTitle = titlePlaceholders.processed;
    const content = contentPlaceholders.processed;

    // Load glossary and filter to relevant terms
    let glossaryEntries: GlossaryEntry[] = [];
    try {
        const glossary = loadGlossary();
        glossaryEntries = filterRelevantTerms(glossary.entries, `${processedTitle} ${content}`);
    } catch (e) {
        console.warn('Failed to load glossary, proceeding without:', e);
    }

    // Load banned patterns
    let bannedPatterns: BannedPattern[] = [];
    try {
        const raw = fs.readFileSync(BANNED_PATTERNS_PATH, 'utf-8');
        bannedPatterns = JSON.parse(raw) as BannedPattern[];
    } catch (e) {
        console.warn('Failed to load banned patterns, proceeding without:', e);
    }

    // Split into chunks if content is too long
    const chunks = splitIntoChunks(content, CHUNK_THRESHOLD);
    const totalChunks = chunks.length;

    const ai = getAIClient();
    const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o';
    const pipelineStart = Date.now();

    // Aggregate metrics across chunks
    const phase1Metrics: PhaseReport = { status: 'success', duration_ms: 0, tokens_in: 0, tokens_out: 0, retries: 0 };
    const phase2Metrics: ReviewPhaseReport = { status: 'success', duration_ms: 0, tokens_in: 0, tokens_out: 0, retries: 0, corrections: 0, by_type: {}, new_terms: 0 };
    const phase3Metrics: ProofreadPhaseReport = { status: 'success', duration_ms: 0, tokens_in: 0, tokens_out: 0, retries: 0, polishes: 0, by_type: {} };

    let aggregatedTitle: Phase1Output | null = null;
    const translatedChunks: string[] = [];
    const allNewTerms: string[] = [];
    const allCorrections: Phase2CorrectionItem[] = [];

    try {
        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
            const chunk = chunks[chunkIdx];
            const isFirstChunk = chunkIdx === 0;
            const previousChunkLastParagraph = chunkIdx > 0
                ? extractLastParagraph(translatedChunks[chunkIdx - 1])
                : undefined;

            // ── Phase 1: Translate ──
            const phase1Start = Date.now();
            let phase1Result: Phase1Output | undefined;
            let phase1Retries = 0;
            let lastPhase1Error: Error | null = null;

            for (let attempt = 1; attempt <= MAX_TRANSLATION_RETRIES; attempt++) {
                try {
                    const systemMsg = buildPhase1SystemMessage(glossaryEntries);
                    const userMsg = buildPhase1UserMessage({
                        title: processedTitle,
                        url: safeUrl,
                        content: chunk,
                        glossaryEntries,
                        chunkContext: totalChunks > 1 ? {
                            chunkIndex: chunkIdx,
                            totalChunks,
                            previousChunkLastParagraph,
                        } : undefined,
                    });

                    const aiResponse = await ai.chat.completions.create({
                        model,
                        messages: [
                            { role: 'system', content: systemMsg },
                            { role: 'user', content: userMsg },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.3,
                    });

                    phase1Metrics.tokens_in += aiResponse.usage?.prompt_tokens ?? 0;
                    phase1Metrics.tokens_out += aiResponse.usage?.completion_tokens ?? 0;

                    const resultText = aiResponse.choices[0].message.content;
                    if (!resultText) throw new Error('Empty response from OpenRouter (Phase 1)');

                    phase1Result = parseJsonResponse<Phase1Output>(resultText);
                    if (!phase1Result.content_mdx || !phase1Result.title_ar) {
                        throw new Error('Phase 1 response missing required keys (title_ar/content_mdx)');
                    }

                    phase1Retries = attempt - 1;
                    break;
                } catch (error: unknown) {
                    lastPhase1Error = error instanceof Error ? error : new Error('Unknown Phase 1 error');
                    console.error(`Phase 1 attempt ${attempt} failed:`, lastPhase1Error.message);
                    if (attempt < MAX_TRANSLATION_RETRIES) {
                        await sleep(700 * attempt);
                    }
                }
            }

            if (!phase1Result) {
                phase1Metrics.status = 'failed';
                phase1Metrics.retries = MAX_TRANSLATION_RETRIES;
                phase1Metrics.duration_ms += Date.now() - phase1Start;
                throw new Error(`Phase 1 translation failed after ${MAX_TRANSLATION_RETRIES} retries: ${lastPhase1Error?.message}`);
            }

            phase1Metrics.retries += phase1Retries;
            phase1Metrics.duration_ms += Date.now() - phase1Start;

            if (isFirstChunk) {
                aggregatedTitle = phase1Result;
            }

            let currentArabicText = phase1Result.content_mdx;

            // ── Phase 2: Review ──
            const phase2Start = Date.now();
            try {
                const phase2Output = await runPhaseWithRetry<Phase2Output>(
                    ai, model, 0.15,
                    buildPhase2SystemMessage(glossaryEntries, bannedPatterns),
                    buildPhase2UserMessage({
                        englishSource: chunk,
                        arabicTranslation: currentArabicText,
                        glossaryEntries,
                        bannedPatterns,
                    }),
                    PHASE_RETRY_LIMIT,
                );

                phase2Metrics.tokens_in += phase2Output.tokens_in;
                phase2Metrics.tokens_out += phase2Output.tokens_out;
                phase2Metrics.retries += phase2Output.retries;

                if (phase2Output.data) {
                    currentArabicText = phase2Output.data.corrected_text || currentArabicText;

                    // Parse corrections
                    const corrections = phase2Output.data.corrections || [];
                    allCorrections.push(...corrections);
                    phase2Metrics.corrections += corrections.length;
                    for (const c of corrections) {
                        phase2Metrics.by_type[c.type] = (phase2Metrics.by_type[c.type] || 0) + 1;
                    }

                    // Extract discovered terms
                    const discoveredTerms = extractDiscoveredTerms(phase2Output.data);
                    if (discoveredTerms.length > 0) {
                        const addedCount = addDiscoveredTerms(discoveredTerms);
                        phase2Metrics.new_terms += addedCount;
                        allNewTerms.push(...discoveredTerms.map(t => t.en));
                    }
                }
            } catch (e) {
                console.error('Phase 2 review failed, using Phase 1 output:', e);
                phase2Metrics.status = 'failed';
            }
            phase2Metrics.duration_ms += Date.now() - phase2Start;

            // ── Phase 3: Proofread (skip if Phase 2 failed) ──
            const phase3Start = Date.now();
            if (phase2Metrics.status !== 'failed') {
                try {
                    const phase3Output = await runPhaseWithRetry<Phase3Output>(
                        ai, model, 0.1,
                        buildPhase3SystemMessage(),
                        buildPhase3UserMessage({ arabicText: currentArabicText }),
                        PHASE_RETRY_LIMIT,
                    );

                    phase3Metrics.tokens_in += phase3Output.tokens_in;
                    phase3Metrics.tokens_out += phase3Output.tokens_out;
                    phase3Metrics.retries += phase3Output.retries;

                    if (phase3Output.data) {
                        currentArabicText = phase3Output.data.polished_text || currentArabicText;

                        const polishes = phase3Output.data.polishes || [];
                        phase3Metrics.polishes += polishes.length;
                        for (const p of polishes) {
                            phase3Metrics.by_type[p.type] = (phase3Metrics.by_type[p.type] || 0) + 1;
                        }
                    }
                } catch (e) {
                    console.error('Phase 3 proofread failed, using Phase 2 output:', e);
                    phase3Metrics.status = 'failed';
                }
            } else {
                phase3Metrics.status = 'skipped';
            }
            phase3Metrics.duration_ms += Date.now() - phase3Start;

            translatedChunks.push(currentArabicText);
        }

        // Reassemble chunks
        const fullArabicContent = translatedChunks.join('\n\n');

        // Restore movie title placeholders
        const restoredTitleAr = restorePlaceholders(aggregatedTitle!.title_ar, uniqueMap);
        const restoredContentRaw = restorePlaceholders(fullArabicContent, uniqueMap);
        const restoredExcerpt = aggregatedTitle!.excerpt_ar
            ? restorePlaceholders(aggregatedTitle!.excerpt_ar, uniqueMap)
            : '';

        // Re-inject tags
        const restoredContent = restoreTags(restoredContentRaw, extractedTags);

        // Safety: strip any stray placeholders the AI may have hallucinated
        const validTitlePlaceholders = new Set(uniqueMap.map(m => m.placeholder));
        let cleanedContent = restoredContent.replace(/\[\[TITLE_\d+\]\]/g, (match) =>
            validTitlePlaceholders.has(match) ? match : ''
        );

        // Clean up halluncinated [TAG_N] placeholders
        const validTagPlaceholders = new Set(extractedTags.map((_, i) => `[TAG_${i + 1}]`));
        cleanedContent = cleanedContent.replace(/\[TAG_\d+\]/g, (match) =>
            validTagPlaceholders.has(match) ? match : ''
        );

        // ── Post-processing (programmatic, not AI) ──
        cleanedContent = toEasternArabicNumerals(cleanedContent);
        cleanedContent = applyBidiIsolation(cleanedContent);
        cleanedContent = formatArabicQuotationMarks(cleanedContent);

        // Build quality report
        const qualityReport = buildQualityReport(
            model, totalChunks, pipelineStart,
            phase1Metrics, phase2Metrics, phase3Metrics,
            allNewTerms,
        );

        return {
            success: true,
            data: {
                title_ar: restoredTitleAr,
                title_en: aggregatedTitle!.title_en || safeTitle,
                excerpt_ar: restoredExcerpt,
                content_mdx: cleanedContent,
                category: aggregatedTitle!.category || 'uncategorized',
                tags: Array.isArray(aggregatedTitle!.tags) ? aggregatedTitle!.tags : [],
                slug: aggregatedTitle!.slug || safeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            },
            quality_report: qualityReport,
        };
    } catch (error: unknown) {
        const lastError = error instanceof Error ? error : new Error('Unknown translation error');
        console.error('Translation pipeline failed:', lastError.message);

        return {
            success: false,
            error: 'Failed to translate article',
            details: lastError.message,
        };
    }
}

// ── Chunking ──

/**
 * Split content at heading boundaries when it exceeds the character threshold.
 * Splitting hierarchy: <h2> → <h3> → <p> boundaries.
 * Merges adjacent tiny chunks to avoid excessive API calls.
 */
export function splitIntoChunks(content: string, threshold: number = CHUNK_THRESHOLD): string[] {
    if (!content || content.length <= threshold) {
        return [content || ''];
    }

    // Try splitting at <h2> boundaries first
    const chunks = splitAtBoundary(content, /<h2\b[^>]*>/gi);
    if (chunks.every(c => c.length <= threshold)) {
        return mergeTinyChunks(chunks, threshold);
    }

    // If any chunk still too large, split those at <h3>
    const refinedChunks: string[] = [];
    for (const chunk of chunks) {
        if (chunk.length <= threshold) {
            refinedChunks.push(chunk);
        } else {
            const subChunks = splitAtBoundary(chunk, /<h3\b[^>]*>/gi);
            refinedChunks.push(...subChunks);
        }
    }

    if (refinedChunks.every(c => c.length <= threshold)) {
        return mergeTinyChunks(refinedChunks, threshold);
    }

    // If still too large, split at <p> boundaries
    const finalChunks: string[] = [];
    for (const chunk of refinedChunks) {
        if (chunk.length <= threshold) {
            finalChunks.push(chunk);
        } else {
            const subChunks = splitAtBoundary(chunk, /<p\b[^>]*>/gi);
            finalChunks.push(...subChunks);
        }
    }

    return mergeTinyChunks(finalChunks, threshold);
}

/**
 * Split content at regex boundary matches, keeping the boundary token
 * with the chunk that follows it.
 */
function splitAtBoundary(content: string, boundaryRegex: RegExp): string[] {
    const parts: string[] = [];
    let lastIndex = 0;

    const matches = [...content.matchAll(new RegExp(boundaryRegex.source, 'gi'))];

    if (matches.length === 0) return [content];

    for (const match of matches) {
        const matchIndex = match.index!;
        if (matchIndex > lastIndex) {
            parts.push(content.slice(lastIndex, matchIndex));
        }
        lastIndex = matchIndex;
    }

    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts.filter(p => p.trim().length > 0);
}

/**
 * Merge adjacent tiny chunks (< 20% of threshold) to avoid excessive API calls.
 */
function mergeTinyChunks(chunks: string[], threshold: number): string[] {
    const minSize = threshold * 0.2;
    const result: string[] = [];
    let buffer = '';

    for (const chunk of chunks) {
        if (buffer.length + chunk.length <= threshold) {
            buffer += chunk;
        } else {
            if (buffer) result.push(buffer);
            buffer = chunk;
        }
    }

    if (buffer) result.push(buffer);

    // Final pass: if last chunk is tiny, merge with previous
    if (result.length > 1 && result[result.length - 1].length < minSize) {
        const last = result.pop()!;
        result[result.length - 1] += last;
    }

    return result;
}

// ── Post-processing ──

/**
 * Convert Western Arabic numerals (0-9) to Eastern Arabic numerals (٠-٩).
 * Skips numbers inside [IMAGE_N], [[TITLE_N]], URLs, and code blocks.
 */
export function toEasternArabicNumerals(text: string): string {
    const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    // Protect zones that should NOT be converted
    const protectedZones: Array<{ start: number; end: number }> = [];

    // Protect [TAG_N] markers
    for (const match of text.matchAll(/\[TAG_\d+\]/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    // Protect [IMAGE_N] markers (legacy support if still used, though extractTags covers it)
    for (const match of text.matchAll(/\[IMAGE_\d+\]/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    // Protect [[TITLE_N]] markers
    for (const match of text.matchAll(/\[\[TITLE_\d+\]\]/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    // Protect URLs (http/https)
    for (const match of text.matchAll(/https?:\/\/[^\s)>\]]+/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    // Protect inline code (backticks)
    for (const match of text.matchAll(/`[^`]+`/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    // Protect HTML/JSX tags
    for (const match of text.matchAll(/<[^>]+>/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    // Protect Markdown links/images destination: [text](URL)
    // We catch the (URL) part
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        // match.index is the start of the whole match (the ']' character)
        // We want to protect from match.index + 2 (the start of the URL) to match.index + 1 + match[0].length - 1
        // Actually, just protecting the whole '](' + URL + ')' is safer.
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    // Protect code blocks
    for (const match of text.matchAll(/```[\s\S]*?```/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    function isProtected(index: number): boolean {
        return protectedZones.some(z => index >= z.start && index < z.end);
    }

    let result = '';
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= 48 && code <= 57 && !isProtected(i)) {
            result += EASTERN_DIGITS[code - 48];
        } else {
            result += text[i];
        }
    }

    return result;
}

/**
 * Apply Unicode bidi isolation (FSI/PDI) around embedded Latin text segments
 * in Arabic context. Uses U+2068 (First Strong Isolate) and U+2069 (Pop Directional Isolate).
 */
export function applyBidiIsolation(text: string): string {
    const FSI = '\u2068';
    const PDI = '\u2069';

    // 1. Identify and protect all tags and markdown link destinations
    const protectedZones: Array<{ start: number; end: number }> = [];

    // HTML/JSX tags
    for (const match of text.matchAll(/<[^>]+>/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    // Markdown links/images: [text](URL)
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    function isInsideProtected(index: number): boolean {
        return protectedZones.some(z => index >= z.start && index < z.end);
    }

    // Match sequences of Latin characters that are at least 2 chars long
    // only if they are NOT inside a protected zone.
    return text.replace(
        /(?<=[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s])([A-Za-z][A-Za-z0-9\s\-'.:,&*()\u00C0-\u024F]+[A-Za-z0-9)])(?=[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s.,!?،؛:»«]|$)/g,
        (match, p1, offset) => {
            if (isInsideProtected(offset)) {
                return match;
            }
            return `${FSI}${match}${PDI}`;
        }
    );
}

/**
 * Convert straight quotes and English quotation marks to Arabic «» guillemets.
 * Handles: "text", "text", 'text', «text» (already correct).
 */
export function formatArabicQuotationMarks(text: string): string {
    // 1. Identify and protect all tags so quotes INSIDE tags are never modified
    const protectedZones: Array<{ start: number; end: number }> = [];
    for (const match of text.matchAll(/<[^>]+>/g)) {
        protectedZones.push({ start: match.index!, end: match.index! + match[0].length });
    }

    function isInsideTag(index: number): boolean {
        return protectedZones.some(z => index >= z.start && index < z.end);
    }

    // Convert double quotes to guillemets, but ONLY if they are not part of a tag
    let result = '';
    let inDoubleQuotes = false;

    for (let i = 0; i < text.length; i++) {
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

    // Convert curly quotes (these are typically only in text)
    result = result.replace(/\u201C([^\u201D]*)\u201D/g, '«$1»');

    return result;
}

// ── Phase runner with retry ──

interface PhaseResult<T> {
    data: T | null;
    tokens_in: number;
    tokens_out: number;
    retries: number;
}

/**
 * Run a single AI phase with retry logic.
 * Retries once on failure (PHASE_RETRY_LIMIT=1).
 * On complete failure, throws an error.
 */
async function runPhaseWithRetry<T>(
    ai: OpenAI,
    model: string,
    temperature: number,
    systemMessage: string,
    userMessage: string,
    maxRetries: number,
): Promise<PhaseResult<T>> {
    let tokensIn = 0;
    let tokensOut = 0;
    let retries = 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const aiResponse = await ai.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: userMessage },
                ],
                response_format: { type: 'json_object' },
                temperature,
            });

            tokensIn += aiResponse.usage?.prompt_tokens ?? 0;
            tokensOut += aiResponse.usage?.completion_tokens ?? 0;

            const resultText = aiResponse.choices[0].message.content;
            if (!resultText) throw new Error('Empty response from OpenRouter');

            const parsed = parseJsonResponse<T>(resultText);
            return { data: parsed, tokens_in: tokensIn, tokens_out: tokensOut, retries };
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error('Unknown phase error');
            retries = attempt + 1;
            if (attempt < maxRetries) {
                await sleep(700 * (attempt + 1));
            }
        }
    }

    throw lastError || new Error('Phase failed after retries');
}

// ── Quality Report ──

/**
 * Assemble a TranslationQualityReport from per-phase metrics.
 */
export function buildQualityReport(
    model: string,
    chunks: number,
    pipelineStart: number,
    phase1: PhaseReport,
    phase2: ReviewPhaseReport,
    phase3: ProofreadPhaseReport,
    newTerms: string[],
): TranslationQualityReport {
    const totalDuration = Date.now() - pipelineStart;

    return {
        v: 1,
        ts: new Date().toISOString(),
        model,
        chunks,
        phases: {
            translate: phase1,
            review: phase2,
            proofread: phase3,
        },
        totals: {
            duration_ms: totalDuration,
            tokens_in: phase1.tokens_in + phase2.tokens_in + phase3.tokens_in,
            tokens_out: phase1.tokens_out + phase2.tokens_out + phase3.tokens_out,
            corrections: phase2.corrections + phase3.polishes,
            new_terms: newTerms,
        },
    };
}

// ── Helpers ──

/**
 * Parse JSON from AI response text. Handles responses wrapped in markdown code fences.
 */
function parseJsonResponse<T>(text: string): T {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Failed to parse JSON from AI response');
    }
    return JSON.parse(jsonMatch[0]) as T;
}

/**
 * Extract the last non-empty paragraph from a text block.
 * Used for chunk context continuity.
 */
function extractLastParagraph(text: string): string {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    return paragraphs[paragraphs.length - 1]?.trim().slice(0, 500) || '';
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
