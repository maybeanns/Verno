/**
 * One markdown reader for the PRD, shared by the on-screen preview and the PDF
 * export.
 *
 * The two used to parse the document separately. The preview understood tables,
 * ordered lists and inline emphasis; the PDF exporter did not, so it printed
 * every table as raw `| pipe | text |` wrapped as a paragraph, dropped ordered
 * lists into plain prose, and stripped bold and italic entirely. A PRD is
 * mostly tables, so the exported file barely resembled what was on screen.
 *
 * Both now render from the same block list. A change to the document's grammar
 * lands in one place and shows up in both.
 */

export type MarkdownBlock =
    | { kind: 'heading'; level: 1 | 2 | 3; text: string }
    | { kind: 'paragraph'; text: string }
    | { kind: 'list'; ordered: boolean; items: string[] }
    | { kind: 'blockquote'; lines: string[] }
    | { kind: 'table'; headers: string[]; rows: string[][] }
    | { kind: 'rule' };

/** A run of text carrying the inline marks that applied to it. */
export interface InlineSpan {
    text: string;
    bold: boolean;
    italic: boolean;
    code: boolean;
}

/** Splits a markdown table row into trimmed cells, tolerating edge pipes. */
function parseTableRow(row: string): string[] {
    let content = row.trim();
    if (content.startsWith('|')) {
        content = content.slice(1);
    }
    if (content.endsWith('|')) {
        content = content.slice(0, -1);
    }
    return content.split('|').map((cell) => cell.trim());
}

/**
 * Reads a document into ordered blocks.
 *
 * Deliberately line-based and forgiving rather than a full CommonMark parser:
 * the input is model-generated markdown restricted to the small grammar the
 * section prompts ask for (three heading levels, lists, tables, blockquotes,
 * rules), and a strict parser would drop content on any deviation.
 */
export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    const lines = content.split('\n');

    let paragraphLines: string[] = [];
    let listItems: string[] = [];
    let listOrdered = false;
    let blockquoteLines: string[] = [];
    let tableLines: string[] = [];

    const flushParagraph = () => {
        if (paragraphLines.length > 0) {
            blocks.push({ kind: 'paragraph', text: paragraphLines.join(' ') });
            paragraphLines = [];
        }
    };
    const flushList = () => {
        if (listItems.length > 0) {
            blocks.push({ kind: 'list', ordered: listOrdered, items: listItems });
            listItems = [];
        }
    };
    const flushBlockquote = () => {
        if (blockquoteLines.length > 0) {
            blocks.push({ kind: 'blockquote', lines: blockquoteLines });
            blockquoteLines = [];
        }
    };
    const flushTable = () => {
        // Header row plus the `---|---` separator is the minimum that carries
        // any structure; anything shorter is not a table worth rendering.
        if (tableLines.length >= 2) {
            blocks.push({
                kind: 'table',
                headers: parseTableRow(tableLines[0]),
                rows: tableLines.slice(2).map(parseTableRow),
            });
        }
        tableLines = [];
    };
    const flushAll = () => {
        flushParagraph();
        flushList();
        flushBlockquote();
        flushTable();
    };

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('|')) {
            if (tableLines.length === 0) {
                flushParagraph();
                flushList();
                flushBlockquote();
            }
            tableLines.push(line);
            continue;
        }
        flushTable();

        if (trimmed.startsWith('> ')) {
            if (blockquoteLines.length === 0) {
                flushParagraph();
                flushList();
            }
            blockquoteLines.push(trimmed.slice(2));
            continue;
        }
        flushBlockquote();

        if (!trimmed) {
            flushParagraph();
            flushList();
            continue;
        }

        const heading = line.match(/^(#{1,3})\s+(.*)$/);
        if (heading) {
            flushParagraph();
            flushList();
            blocks.push({
                kind: 'heading',
                level: heading[1].length as 1 | 2 | 3,
                text: heading[2].trim(),
            });
            continue;
        }

        if (trimmed === '---') {
            flushParagraph();
            flushList();
            blocks.push({ kind: 'rule' });
            continue;
        }

        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
        if (bullet || numbered) {
            flushParagraph();
            // A switch between bullets and numbers starts a new list rather
            // than silently relabelling the items already collected.
            const ordered = Boolean(numbered);
            if (listItems.length > 0 && ordered !== listOrdered) {
                flushList();
            }
            if (listItems.length === 0) {
                listOrdered = ordered;
            }
            listItems.push((bullet ? bullet[1] : numbered![1]).trim());
            continue;
        }

        flushList();
        paragraphLines.push(line);
    }

    flushAll();
    return blocks;
}

/**
 * Splits text into runs carrying their inline marks, so a renderer that cannot
 * accept HTML — the PDF exporter — can still show bold, italic and code.
 */
export function parseInlineSpans(text: string): InlineSpan[] {
    const spans: InlineSpan[] = [];
    // Longest markers first so `**bold**` is not read as two `*italic*` runs.
    const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
    let lastIndex = 0;

    const push = (value: string, marks: Omit<InlineSpan, 'text'>) => {
        if (value) {
            spans.push({ text: value, ...marks });
        }
    };

    for (const match of text.matchAll(pattern)) {
        const token = match[0];
        const start = match.index ?? 0;
        push(text.slice(lastIndex, start), { bold: false, italic: false, code: false });

        if (token.startsWith('**') || token.startsWith('__')) {
            push(token.slice(2, -2), { bold: true, italic: false, code: false });
        } else if (token.startsWith('`')) {
            push(token.slice(1, -1), { bold: false, italic: false, code: true });
        } else {
            push(token.slice(1, -1), { bold: false, italic: true, code: false });
        }
        lastIndex = start + token.length;
    }

    push(text.slice(lastIndex), { bold: false, italic: false, code: false });
    return spans.length > 0 ? spans : [{ text, bold: false, italic: false, code: false }];
}

/** The same text with every inline marker removed. */
export function stripInline(text: string): string {
    return parseInlineSpans(text)
        .map((span) => span.text)
        .join('');
}
