/**
 * MermaidRenderService — Extracts Mermaid code blocks from markdown and converts them to PNG.
 * 
 * Uses @mermaid-js/mermaid-cli with puppeteer-core (no bundled Chromium).
 * Auto-detects installed Chrome/Edge/Chromium. Falls back to .mmd-only if no browser found.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MermaidBlock {
    /** Sequential index within the document */
    index: number;
    /** Inferred title from the heading above the block, or a generic label */
    title: string;
    /** Raw Mermaid syntax (without the ```mermaid fences) */
    code: string;
    /** The original fenced block including ```mermaid ... ``` */
    originalBlock: string;
}

export interface DiagramResult {
    /** Path to the .mmd source file */
    mmdPath: string;
    /** Path to the generated .png file, or null if rendering failed/unavailable */
    pngPath: string | null;
    /** Title of the diagram */
    title: string;
    /** Relative path for embedding in markdown (e.g., docs/diagrams/arch-1.png) */
    relativePngPath: string | null;
    /** The original ```mermaid block that was replaced */
    originalBlock: string;
}

export class MermaidRenderService {
    private workspaceRoot: string;
    private logger: any;
    private diagramDir: string;

    constructor(workspaceRoot: string, logger?: any) {
        this.workspaceRoot = workspaceRoot;
        this.logger = logger;
        this.diagramDir = path.join(workspaceRoot, 'docs', 'diagrams');
    }

    /**
     * Extract all ```mermaid code blocks from a markdown string.
     */
    extractMermaidBlocks(markdown: string): MermaidBlock[] {
        const blocks: MermaidBlock[] = [];
        // Match ```mermaid ... ``` blocks (with optional whitespace)
        const regex = /```mermaid\s*\n([\s\S]*?)```/g;
        let match: RegExpExecArray | null;
        let index = 0;

        while ((match = regex.exec(markdown)) !== null) {
            const code = match[1].trim();
            const originalBlock = match[0];

            // Try to infer title from the nearest heading above this block
            const textBefore = markdown.substring(0, match.index);
            const headingMatch = textBefore.match(/#+\s+(.+?)(?:\r?\n)/g);
            let title = `diagram-${index + 1}`;
            if (headingMatch && headingMatch.length > 0) {
                const lastHeading = headingMatch[headingMatch.length - 1];
                title = lastHeading.replace(/^#+\s+/, '').replace(/\r?\n/, '').trim();
            }

            // Sanitize title for filename
            title = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            if (!title) { title = `diagram-${index + 1}`; }

            blocks.push({ index, title, code, originalBlock });
            index++;
        }

        return blocks;
    }

    /**
     * Process all mermaid blocks from a markdown document.
     * Extracts blocks, saves .mmd source files, and renders to PNG.
     */
    async processDocument(markdown: string, docName: string): Promise<DiagramResult[]> {
        const blocks = this.extractMermaidBlocks(markdown);
        if (blocks.length === 0) {
            this.log('No mermaid blocks found in document');
            return [];
        }

        this.log(`Found ${blocks.length} mermaid block(s) in ${docName}`);

        // Ensure output directory exists
        if (!fs.existsSync(this.diagramDir)) {
            fs.mkdirSync(this.diagramDir, { recursive: true });
        }

        const results: DiagramResult[] = [];

        for (const block of blocks) {
            const baseName = `${docName}-${block.index + 1}-${block.title}`;
            const mmdPath = path.join(this.diagramDir, `${baseName}.mmd`);
            const pngPath = path.join(this.diagramDir, `${baseName}.png`);
            const relativePngPath = path.relative(this.workspaceRoot, pngPath).replace(/\\/g, '/');

            // Sanitize mermaid code before writing — fix common LLM syntax errors
            const sanitizedCode = this.sanitizeMermaidCode(block.code);

            // Always write .mmd source (sanitized)
            fs.writeFileSync(mmdPath, sanitizedCode, 'utf-8');
            this.log(`Saved mermaid source: ${mmdPath}`);

            // Attempt PNG conversion
            let pngGenerated: string | null = null;
            try {
                pngGenerated = await this.renderToPng(sanitizedCode, pngPath);
            } catch (err: any) {
                this.log(`PNG rendering failed for ${baseName}: ${err.message || err}`, 'warn');
            }

            results.push({
                mmdPath,
                pngPath: pngGenerated,
                title: block.title,
                relativePngPath: pngGenerated ? relativePngPath : null,
                originalBlock: block.originalBlock,
            });
        }

        const successCount = results.filter(r => r.pngPath !== null).length;
        this.log(`Rendered ${successCount}/${blocks.length} diagrams to PNG`);

        return results;
    }

    /**
     * Render mermaid code to a PNG file.
     * Returns the output path on success, or null on failure.
     */
    async renderToPng(mermaidCode: string, outputPath: string): Promise<string | null> {
        const browserPath = this.detectBrowserPath();
        if (!browserPath) {
            this.log('No Chrome/Edge/Chromium detected. Skipping PNG rendering. Install a Chromium-based browser for diagram image generation.', 'warn');
            return null;
        }

        // Write temp .mmd file
        const tmpDir = path.join(this.workspaceRoot, '.verno', 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        const tmpMmdPath = path.join(tmpDir, `render-${Date.now()}.mmd`);
        fs.writeFileSync(tmpMmdPath, mermaidCode, 'utf-8');

        try {
            // Use dynamic import to load ESM module into CJS context
            const mermaidModule = await Function('return import("@mermaid-js/mermaid-cli")')();
            const { run } = mermaidModule;
            
            await run(tmpMmdPath, outputPath, {
                puppeteerConfig: {
                    executablePath: browserPath,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                },
                parseMMDOptions: {
                    backgroundColor: 'transparent',
                },
            });

            this.log(`PNG rendered: ${outputPath}`);
            return outputPath;
        } catch (err: any) {
            this.log(`mermaid-cli render failed: ${err.message || err}`, 'error');
            return null;
        } finally {
            // Clean up temp file
            try { fs.unlinkSync(tmpMmdPath); } catch { /* ignore */ }
        }
    }

    /**
     * Auto-detect installed Chromium-based browser.
     * Checks common paths on Windows, macOS, and Linux.
     */
    private detectBrowserPath(): string | null {
        const platform = os.platform();
        const candidates: string[] = [];

        if (platform === 'win32') {
            const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
            const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
            const localAppData = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');
            candidates.push(
                path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
            );
        } else if (platform === 'darwin') {
            candidates.push(
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
            );
        } else {
            // Linux
            candidates.push(
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/usr/bin/microsoft-edge',
                '/snap/bin/chromium',
            );
        }

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                this.log(`Detected browser: ${candidate}`);
                return candidate;
            }
        }

        return null;
    }

    /**
     * Fix common LLM-generated Mermaid syntax errors.
     * 
     * Common mistakes:
     * - Using `participant` in `graph` or `flowchart` diagrams (sequenceDiagram-only keyword)
     * - Invalid arrow syntax like `-->|label|>` (should be `-->|label|`)
     * - Mixed diagram types
     */
    private sanitizeMermaidCode(code: string): string {
        let lines = code.split('\n');
        let sanitized: string[] = [];
        let diagramType = '';

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trimEnd();
            
            // Detect diagram type from the first non-empty line
            if (!diagramType && line.trim()) {
                const typeMatch = line.trim().match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitgraph|mindmap|C4Context|C4Container|C4Component|C4Deployment)/i);
                if (typeMatch) {
                    diagramType = typeMatch[1].toLowerCase();
                }
            }

            // Fix 1: `participant` used in graph/flowchart → convert to node definitions
            if ((diagramType === 'graph' || diagramType === 'flowchart') && /^\s*participant\s+/i.test(line)) {
                const m = line.match(/^\s*participant\s+(\w+)\s+as\s+"([^"]+)"/i);
                if (m) {
                    // Skip — we'll use the node ID inline in edges
                    continue;
                }
                const m2 = line.match(/^\s*participant\s+(\w+)/i);
                if (m2) {
                    continue; // Skip bare participant declarations — they'll appear as node IDs in edges
                }
            }

            // Fix 2: Invalid arrow syntax `-->|label|>` → `-->|label|`
            line = line.replace(/-->\|([^|]*)\|>/g, '-->|$1|');
            
            // Fix 3: Invalid arrow syntax `-->|label|>NodeId` → `-->|label| NodeId`
            line = line.replace(/-->\|([^|]*)\|>(\w)/g, '-->|$1| $2');
            
            // Fix 4: Arrow `-- label -->` is valid, but `-- label ->` is not — fix to `-->` 
            line = line.replace(/--\s*([^-]*?)\s*->/g, '-->|$1|');
            
            // Fix 5: Remove empty labels `-->||`
            line = line.replace(/-->\|\|/g, '-->');

            sanitized.push(line);
        }

        // If diagram is graph/flowchart but had `participant` (now removed), 
        // ensure it's still valid by keeping it as-is
        let result = sanitized.join('\n');

        // Fix 6: If the diagram has NO valid diagram type, prefix with `graph LR`
        const firstLine = result.trim().split('\n')[0]?.trim() || '';
        const validTypes = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitgraph|mindmap|C4Context|C4Container|C4Component|C4Deployment)/i;
        if (!validTypes.test(firstLine)) {
            result = 'graph LR\n' + result;
        }

        return result;
    }

    private log(message: string, level: string = 'info') {
        if (this.logger) {
            if (level === 'error') {
                this.logger.error(`[MermaidRenderService] ${message}`);
            } else if (level === 'warn') {
                this.logger.warn(`[MermaidRenderService] ${message}`);
            } else {
                this.logger.info(`[MermaidRenderService] ${message}`);
            }
        }
    }
}
