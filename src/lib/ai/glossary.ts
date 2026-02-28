// src/lib/ai/glossary.ts
// Cinema terminology glossary loader, filter, and updater.

import fs from 'fs';
import path from 'path';

// ── Types ──

export interface GlossaryEntry {
    en: string;
    ar: string;
    context?: string;
    aliases?: string[];
    added_at?: string;
    source?: 'manual' | 'ai_discovered';
    approved?: boolean;
}

export interface GlossaryFile {
    version: number;
    updated_at: string;
    entries: GlossaryEntry[];
}

// ── Constants ──

const GLOSSARY_PATH = path.join(process.cwd(), 'data', 'glossary.json');
const MAX_PROMPT_TERMS = 200;

// ── Loader ──

/**
 * Read and parse the glossary JSON file from disk.
 * Returns the full GlossaryFile including version and metadata.
 */
export function loadGlossary(): GlossaryFile {
    const raw = fs.readFileSync(GLOSSARY_PATH, 'utf-8');
    return JSON.parse(raw) as GlossaryFile;
}

/**
 * Filter glossary entries to only those whose English term (or aliases)
 * appear in the source text. Limits to MAX_PROMPT_TERMS to keep prompt
 * token budgets manageable.
 */
export function filterRelevantTerms(
    entries: GlossaryEntry[],
    sourceText: string,
): GlossaryEntry[] {
    const lowerSource = sourceText.toLowerCase();

    const relevant = entries.filter((entry) => {
        // Only include approved entries in prompts
        if (entry.approved === false) return false;

        // Check main term
        if (lowerSource.includes(entry.en.toLowerCase())) return true;

        // Check aliases
        if (entry.aliases) {
            return entry.aliases.some((alias) =>
                lowerSource.includes(alias.toLowerCase()),
            );
        }

        return false;
    });

    // Cap at MAX_PROMPT_TERMS to avoid degrading instruction-following
    return relevant.slice(0, MAX_PROMPT_TERMS);
}

/**
 * Format glossary entries as a Markdown table for injection into LLM prompts.
 */
export function formatGlossaryForPrompt(entries: GlossaryEntry[]): string {
    if (entries.length === 0) return '';

    const header = '| English Term | Arabic Translation | Domain |\n|---|---|---|';
    const rows = entries
        .map((e) => `| ${e.en} | ${e.ar} | ${e.context ?? ''} |`)
        .join('\n');

    return `${header}\n${rows}`;
}

// ── Discovery & Update (used by US2 — T016/T017) ──

/**
 * Extract newly discovered cinema terms from Phase 2 review structured output.
 * The review phase outputs a JSON array of new_terms_discovered.
 */
export function extractDiscoveredTerms(
    reviewOutput: { new_terms_discovered?: Array<{ en: string; ar: string; context?: string }> },
): Array<{ en: string; ar: string; context?: string }> {
    if (!reviewOutput.new_terms_discovered || !Array.isArray(reviewOutput.new_terms_discovered)) {
        return [];
    }

    return reviewOutput.new_terms_discovered.filter(
        (term) => term.en?.trim() && term.ar?.trim(),
    );
}

/**
 * Add newly discovered terms to the glossary file on disk.
 * New entries are marked as approved: false, source: ai_discovered.
 * Skips duplicates (case-insensitive match on `en` field).
 * Increments the version number and updates the timestamp.
 */
export function addDiscoveredTerms(
    newTerms: Array<{ en: string; ar: string; context?: string }>,
): number {
    if (newTerms.length === 0) return 0;

    const glossary = loadGlossary();
    const existingTerms = new Set(
        glossary.entries.map((e) => e.en.toLowerCase()),
    );

    let addedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const term of newTerms) {
        const normalizedEn = term.en.trim().toLowerCase();
        if (existingTerms.has(normalizedEn)) continue;

        glossary.entries.push({
            en: term.en.trim().toLowerCase(),
            ar: term.ar.trim(),
            context: term.context,
            added_at: today,
            source: 'ai_discovered',
            approved: false,
        });

        existingTerms.add(normalizedEn);
        addedCount += 1;
    }

    if (addedCount > 0) {
        glossary.version += 1;
        glossary.updated_at = new Date().toISOString();
        fs.writeFileSync(GLOSSARY_PATH, JSON.stringify(glossary, null, 2) + '\n', 'utf-8');
    }

    return addedCount;
}
