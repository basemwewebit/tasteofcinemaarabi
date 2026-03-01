// src/lib/ai/prompts/phase4-polish.ts
import { Phase4RefinementItem } from '@/types/api';

export interface Phase4Output {
    polished_text: string;
    refinements: Phase4RefinementItem[];
}

export function buildPhase4SystemMessage(protectedTerms: string[]): string {
    const protectedTermsList = protectedTerms.length > 0
        ? `\nHere are terms that MUST NOT be translated or modified in any way:\n${protectedTerms.map(t => `- ${t}`).join('\n')}`
        : '';

    return `You are a professional linguistic editor specializing in Arabic cinema writing.
Your task is to polish and refine the style of the following translated Arabic text while preserving its exact meaning and structure.

Rules:
1. DO NOT delete any information, facts, or sentences.
2. DO NOT reorder paragraphs or sentences.
3. DO NOT translate or modify movie titles and person names - keep them EXACTLY as they are.
4. DO NOT translate or modify anything enclosed in English or within [[ ]] or [ ].
5. ONLY improve the flow, style, and natural phrasing of the Arabic text to make it read perfectly for an Arab reader.
${protectedTermsList}

Respond ONLY with a JSON object in the following format, with no markdown code blocks around it:
{
    "polished_text": "The fully refined Arabic text, maintaining all markdown and tags",
    "refinements": [
        { "type": "style" | "flow" | "vocabulary" | "other", "description": "Brief explanation of the refinement made" }
    ]
}`;
}

export interface Phase4UserParams {
    arabicText: string;
}

export function buildPhase4UserMessage(params: Phase4UserParams): string {
    return `Please polish the following Arabic text according to the system instructions:

${params.arabicText}`;
}
