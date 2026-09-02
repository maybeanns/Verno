/**
 * PRD markdown to PDF.
 *
 * Lives outside the component because none of it is a React concern, and
 * because keeping it importable is what makes it testable without a browser.
 *
 * Mirrors the block structure the on-screen preview renders, so the exported
 * file matches what the user approved: real headings, real bullet and numbered
 * lists, real bordered tables with wrapped cells and a header that repeats
 * across page breaks, and inline bold / italic / code preserved. The previous
 * exporter walked raw lines and knew none of that — every table arrived as
 * `| pipe | text |` reflowed as a paragraph.
 */

import {
    parseInlineSpans,
    parseMarkdownBlocks,
    stripInline,
    type InlineSpan,
    type MarkdownBlock,
} from '@/lib/prd/markdown';

// Collected here because the page-break arithmetic below only reads correctly
// when the bounds it compares against have names.

const PAGE = { width: 210, height: 297 };
const MARGIN = 15;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const TOP_Y = 20;
/** Last baseline that still clears the footer. */
const BOTTOM_Y = 272;
const FOOTER_Y = 286;

const INK = {
    title: [24, 24, 27],
    heading: [221, 131, 10],
    subheading: [55, 55, 60],
    body: [45, 45, 50],
    muted: [120, 120, 128],
    quote: [150, 100, 30],
    rule: [222, 222, 226],
    tableHeaderBg: [244, 244, 246],
    tableBorder: [214, 214, 220],
} as const;

type Rgb = readonly [number, number, number];

// ── PDF renderer ────────────────────────────────────────────────────────────
// Mirrors the block structure above so the exported file matches the preview:
// real headings, real bullet and numbered lists, real bordered tables with
// wrapped cells and a header that repeats across page breaks, and inline bold /
// italic / code preserved rather than stripped.

type PdfDoc = import('jspdf').jsPDF;

export function renderPrdPdf(doc: PdfDoc, title: string, content: string): void {
    const blocks = parseMarkdownBlocks(content);
    const state = { y: TOP_Y };

    /** Moves to a new page when `needed` mm will not fit above the footer. */
    const ensureSpace = (needed: number) => {
        if (state.y + needed > BOTTOM_Y) {
            doc.addPage();
            state.y = TOP_Y;
        }
    };

    const setInk = (rgb: Rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

    // The document title, when the body does not already open with one.
    const opensWithTitle = blocks[0]?.kind === 'heading' && blocks[0].level === 1;
    if (title && !opensWithTitle) {
        drawHeading(doc, state, ensureSpace, setInk, { kind: 'heading', level: 1, text: title });
    }

    for (const block of blocks) {
        switch (block.kind) {
            case 'heading':
                drawHeading(doc, state, ensureSpace, setInk, block);
                break;
            case 'paragraph':
                state.y += 1;
                drawSpans(doc, state, ensureSpace, parseInlineSpans(block.text), {
                    size: 9.5,
                    color: INK.body,
                    x: MARGIN,
                    width: CONTENT_WIDTH,
                });
                state.y += 2.5;
                break;
            case 'list':
                drawList(doc, state, ensureSpace, setInk, block);
                break;
            case 'blockquote':
                drawBlockquote(doc, state, ensureSpace, block);
                break;
            case 'table':
                drawTable(doc, state, block);
                break;
            case 'rule':
                ensureSpace(6);
                doc.setDrawColor(INK.rule[0], INK.rule[1], INK.rule[2]);
                doc.setLineWidth(0.2);
                doc.line(MARGIN, state.y, PAGE.width - MARGIN, state.y);
                state.y += 6;
                break;
        }
    }

    drawFooters(doc);
}

function drawHeading(
    doc: PdfDoc,
    state: { y: number },
    ensureSpace: (n: number) => void,
    setInk: (rgb: Rgb) => void,
    block: Extract<MarkdownBlock, { kind: 'heading' }>
): void {
    const spec = {
        1: { size: 17, gapBefore: 4, gapAfter: 4.5, color: INK.title, rule: true },
        2: { size: 12.5, gapBefore: 7, gapAfter: 3.5, color: INK.heading, rule: false },
        3: { size: 10.5, gapBefore: 5, gapAfter: 2.5, color: INK.subheading, rule: false },
    }[block.level];

    // Reserve the heading plus a line of whatever follows, so a heading never
    // ends up stranded alone at the foot of a page.
    ensureSpace(spec.size * 0.45 + spec.gapAfter + 8);
    state.y += spec.gapBefore;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(spec.size);
    setInk(spec.color);
    const lines = doc.splitTextToSize(block.text, CONTENT_WIDTH) as string[];
    for (const line of lines) {
        doc.text(line, MARGIN, state.y);
        state.y += spec.size * 0.45;
    }

    if (spec.rule) {
        state.y += 1.5;
        doc.setDrawColor(INK.rule[0], INK.rule[1], INK.rule[2]);
        doc.setLineWidth(0.4);
        doc.line(MARGIN, state.y, PAGE.width - MARGIN, state.y);
    }
    state.y += spec.gapAfter;
}

/**
 * Lays out inline spans as wrapped text, switching font per run so bold,
 * italic and code survive into the PDF instead of being stripped.
 */
function drawSpans(
    doc: PdfDoc,
    state: { y: number },
    ensureSpace: (n: number) => void,
    spans: InlineSpan[],
    opts: { size: number; color: Rgb; x: number; width: number; italicAll?: boolean }
): void {
    const lineHeight = opts.size * 0.52;
    doc.setFontSize(opts.size);
    doc.setTextColor(opts.color[0], opts.color[1], opts.color[2]);

    const applyFont = (span: InlineSpan) => {
        if (span.code) {
            doc.setFont('courier', span.bold ? 'bold' : 'normal');
            return;
        }
        const style = span.bold
            ? 'bold'
            : span.italic || opts.italicAll
                ? 'italic'
                : 'normal';
        doc.setFont('helvetica', style);
    };

    // Split into words but keep each word bound to the marks it carried.
    const words: { text: string; span: InlineSpan }[] = [];
    for (const span of spans) {
        for (const word of span.text.split(/(\s+)/)) {
            if (word !== '') {
                words.push({ text: word, span });
            }
        }
    }

    ensureSpace(lineHeight);
    let cursorX = opts.x;
    let lineStart = true;

    for (const word of words) {
        const isSpace = /^\s+$/.test(word.text);
        applyFont(word.span);
        const wordWidth = doc.getTextWidth(word.text);

        if (isSpace && lineStart) {
            continue; // no leading spaces after a wrap
        }
        if (!isSpace && cursorX + wordWidth > opts.x + opts.width && !lineStart) {
            state.y += lineHeight;
            ensureSpace(lineHeight);
            cursorX = opts.x;
            lineStart = true;
            if (isSpace) continue;
        }

        doc.text(word.text, cursorX, state.y);
        cursorX += wordWidth;
        lineStart = false;
    }
    state.y += lineHeight;
}

function drawList(
    doc: PdfDoc,
    state: { y: number },
    ensureSpace: (n: number) => void,
    setInk: (rgb: Rgb) => void,
    block: Extract<MarkdownBlock, { kind: 'list' }>
): void {
    const size = 9.5;
    const markerWidth = 6;
    state.y += 1;

    block.items.forEach((item, index) => {
        ensureSpace(size * 0.52);
        const marker = block.ordered ? `${index + 1}.` : '•';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(size);
        setInk(INK.body);
        doc.text(marker, MARGIN + 2, state.y);

        // Hanging indent: wrapped lines align under the text, not the marker.
        drawSpans(doc, state, ensureSpace, parseInlineSpans(item), {
            size,
            color: INK.body,
            x: MARGIN + 2 + markerWidth,
            width: CONTENT_WIDTH - 2 - markerWidth,
        });
        state.y += 0.8;
    });
    state.y += 2;
}

function drawBlockquote(
    doc: PdfDoc,
    state: { y: number },
    ensureSpace: (n: number) => void,
    block: Extract<MarkdownBlock, { kind: 'blockquote' }>
): void {
    const size = 9;
    const padding = 2.5;
    const innerX = MARGIN + 4;
    const innerWidth = CONTENT_WIDTH - 6;

    ensureSpace(size * 0.52 * block.lines.length + padding * 2);
    state.y += 2;
    const top = state.y - 3.5;

    for (const line of block.lines) {
        drawSpans(doc, state, ensureSpace, parseInlineSpans(line), {
            size,
            color: INK.quote,
            x: innerX,
            width: innerWidth,
            italicAll: true,
        });
    }

    // Accent bar drawn after the text, now that its height is known.
    doc.setDrawColor(INK.heading[0], INK.heading[1], INK.heading[2]);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, top, MARGIN, state.y - 1.5);
    state.y += 3;
}

/**
 * Draws a real table: proportional column widths, wrapped cells, a shaded
 * header, and the header repeated whenever the table crosses a page.
 */
function drawTable(
    doc: PdfDoc,
    state: { y: number },
    block: Extract<MarkdownBlock, { kind: 'table' }>
): void {
    const size = 8;
    const lineHeight = size * 0.5;
    const padX = 2;
    const padY = 2;
    const columnCount = Math.max(block.headers.length, ...block.rows.map((r) => r.length), 1);

    const cellText = (row: string[], i: number) => stripInline(row[i] ?? '');

    // Width follows the widest content in each column, then is normalised to
    // the page. Without this, a column of one-word values takes equal space to
    // one holding a paragraph and every long cell wraps into a tall stack.
    doc.setFontSize(size);

    /** Widest single word in a cell, measured in the font it will be drawn in. */
    const widestWord = (text: string, bold: boolean) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        return Math.max(0, ...text.split(/\s+/).map((w) => doc.getTextWidth(w)));
    };

    const weights: number[] = [];
    const minWidths: number[] = [];
    for (let c = 0; c < columnCount; c++) {
        const header = cellText(block.headers, c);
        const body = block.rows.map((r) => cellText(r, c));
        // Weight by content length, clamped so one prose cell cannot starve
        // every other column.
        const weight = Math.max(
            ...[header, ...body].map((text) => Math.min(text.length, 60)),
            6
        );
        // A column narrower than its longest single word makes splitTextToSize
        // break mid-word ("Fronte / nd"), so that word sets the floor. The
        // header is measured bold because that is how it is drawn. Capped,
        // because one long identifier must not blow the table off the page.
        const longest = Math.max(
            widestWord(header, true),
            ...body.map((text) => widestWord(text, false))
        );
        weights.push(weight);
        // Slack absorbs the rounding between measurement and layout, which
        // otherwise wraps the last character of a word that just barely fits.
        minWidths.push(Math.min(longest + padX * 2 + 0.8, CONTENT_WIDTH / 3));
    }

    const widths = distributeWidths(weights, minWidths, CONTENT_WIDTH);

    // splitTextToSize measures in whatever font is currently selected, so the
    // row's font must be set before wrapping, not after. Wrapping body rows
    // while bold was still active from the header made them measure wider than
    // they draw, breaking the last character of a word onto its own line.
    const wrapRow = (row: string[], isHeader: boolean) => {
        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
        doc.setFontSize(size);
        return widths.map((w, c) => doc.splitTextToSize(cellText(row, c), w - padX * 2) as string[]);
    };

    const drawRow = (row: string[], isHeader: boolean) => {
        const cells = wrapRow(row, isHeader);
        const rowHeight = Math.max(...cells.map((c) => c.length)) * lineHeight + padY * 2;

        if (state.y + rowHeight > BOTTOM_Y) {
            doc.addPage();
            state.y = TOP_Y;
            if (!isHeader) {
                drawRow(block.headers, true);
            }
        }

        let x = MARGIN;
        doc.setFontSize(size);
        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
        doc.setTextColor(isHeader ? INK.subheading[0] : INK.body[0], isHeader ? INK.subheading[1] : INK.body[1], isHeader ? INK.subheading[2] : INK.body[2]);
        doc.setDrawColor(INK.tableBorder[0], INK.tableBorder[1], INK.tableBorder[2]);
        doc.setLineWidth(0.15);

        cells.forEach((lines, c) => {
            if (isHeader) {
                doc.setFillColor(INK.tableHeaderBg[0], INK.tableHeaderBg[1], INK.tableHeaderBg[2]);
                doc.rect(x, state.y, widths[c], rowHeight, 'FD');
            } else {
                doc.rect(x, state.y, widths[c], rowHeight, 'D');
            }
            lines.forEach((line, li) => {
                doc.text(line, x + padX, state.y + padY + lineHeight * (li + 0.8));
            });
            x += widths[c];
        });
        state.y += rowHeight;
    };

    state.y += 2;
    drawRow(block.headers, true);
    for (const row of block.rows) {
        drawRow(row, false);
    }
    state.y += 4;
}

/**
 * Splits `total` across columns proportionally to `weights`, while never
 * putting a column below its minimum. Columns pinned to their minimum are
 * fixed and the rest re-share what is left, repeated until nothing else falls
 * below — a single pass would leave later columns short again.
 */
function distributeWidths(weights: number[], minWidths: number[], total: number): number[] {
    const minTotal = minWidths.reduce((a, b) => a + b, 0);
    if (minTotal >= total) {
        // Cannot satisfy every minimum; fall back to sharing by minimum.
        return minWidths.map((m) => (m / minTotal) * total);
    }

    const fixed = new Array(weights.length).fill(false);
    const widths = new Array(weights.length).fill(0);

    for (;;) {
        const remaining = total - widths.reduce((sum, w, i) => sum + (fixed[i] ? w : 0), 0);
        const weightLeft = weights.reduce((sum, w, i) => sum + (fixed[i] ? 0 : w), 0);
        if (weightLeft === 0) break;

        let pinnedThisPass = false;
        for (let i = 0; i < weights.length; i++) {
            if (fixed[i]) continue;
            const share = (weights[i] / weightLeft) * remaining;
            if (share < minWidths[i]) {
                widths[i] = minWidths[i];
                fixed[i] = true;
                pinnedThisPass = true;
            } else {
                widths[i] = share;
            }
        }
        if (!pinnedThisPass) break;
    }
    return widths;
}

function drawFooters(doc: PdfDoc): void {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(INK.muted[0], INK.muted[1], INK.muted[2]);
        doc.text('Generated by ProductHive', MARGIN, FOOTER_Y);
        doc.text(`Page ${i} of ${pageCount}`, PAGE.width - MARGIN, FOOTER_Y, { align: 'right' });
    }
}
