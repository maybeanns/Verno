/**
 * Parsing helpers for the section-batched PRD / Plan generator.
 *
 * Models routinely wrap JSON in code fences, prepend commentary, or run out of
 * output tokens mid-array. These helpers recover as much valid structure as
 * possible instead of throwing the whole document away.
 */

import { z } from 'zod';

export const prdSectionSchema = z.object({
    title: z.string(),
    content: z.string(),
    complianceFlags: z.array(z.string()).optional(),
});
export const prdSchema = z.array(prdSectionSchema);

export interface PRDSection {
    title: string;
    content: string;
    complianceFlags?: string[];
}

/** Normalizes a section title into a comparison key. */
export const titleKey = (t: string) => t.replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * Recovers every complete JSON object from a string, even when the enclosing
 * array was truncated mid-stream. Respects string literals and escapes so that
 * braces inside markdown content do not confuse the scanner.
 */
export function salvageObjects(raw: string): unknown[] {
    const objects: unknown[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{') {
            if (depth === 0) {
                start = i;
            }
            depth++;
            continue;
        }
        if (ch === '}' && depth > 0) {
            depth--;
            if (depth === 0 && start >= 0) {
                try {
                    objects.push(JSON.parse(raw.slice(start, i + 1)));
                } catch {
                    // Incomplete or malformed object — skip it.
                }
                start = -1;
            }
        }
    }
    return objects;
}

/** Coerces common model deviations (array / object content) into the schema shape. */
export function normalizeSection(value: unknown): PRDSection | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const obj = value as Record<string, unknown>;
    if (typeof obj.title !== 'string' || !obj.title.trim()) {
        return null;
    }

    let content: string;
    if (typeof obj.content === 'string') {
        content = obj.content;
    } else if (Array.isArray(obj.content)) {
        content = obj.content.map((c) => String(c)).join('\n');
    } else if (obj.content && typeof obj.content === 'object') {
        content = JSON.stringify(obj.content, null, 2);
    } else {
        return null;
    }

    if (!content.trim()) {
        return null;
    }

    const flags = Array.isArray(obj.complianceFlags)
        ? obj.complianceFlags.filter((f): f is string => typeof f === 'string')
        : undefined;

    return { title: obj.title.trim(), content, ...(flags ? { complianceFlags: flags } : {}) };
}

/**
 * Extracts sections from a raw model response. Tolerates code fences,
 * leading/trailing commentary, and responses truncated mid-array.
 */
export function extractSections(raw: string): PRDSection[] {
    if (!raw) {
        return [];
    }
    const text = raw.replace(/```(?:json)?/gi, '').trim();

    const first = text.indexOf('[');
    const last = text.lastIndexOf(']');
    if (first !== -1 && last > first) {
        try {
            const parsed = prdSchema.safeParse(JSON.parse(text.slice(first, last + 1)));
            if (parsed.success) {
                return parsed.data;
            }
        } catch {
            // Fall through to salvage.
        }
    }

    return salvageObjects(text)
        .map(normalizeSection)
        .filter((s): s is PRDSection => s !== null);
}
