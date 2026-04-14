import * as fs from 'fs';
import * as path from 'path';
import { LLMService } from '../llm';

/**
 * Result of a JSDoc generation pass on a single file.
 */
export interface JsDocResult {
  /** Absolute path to the processed file */
  file: string;
  /** Number of exported symbols that received new JSDoc comments */
  functionsDocumented: number;
  /** Number of exported symbols that already had JSDoc and were skipped */
  skipped: number;
}

/**
 * JsDocGeneratorService — Phase 11 (DOC-03)
 *
 * Scans TypeScript files for exported functions and classes that lack JSDoc
 * comments and generates them via LLM. Never modifies existing JSDoc blocks.
 */
export class JsDocGeneratorService {
  constructor(
    private llmService: LLMService,
    private logger: any
  ) {}

  /**
   * Scan all .ts files in the given directory (recursively) and inject JSDoc
   * for exported symbols that do not already have a JSDoc comment block.
   * @param targetDir - Absolute path to the directory to scan
   * @returns Array of results, one per processed file
   */
  async generateForDirectory(targetDir: string): Promise<JsDocResult[]> {
    const results: JsDocResult[] = [];
    const tsFiles = this.collectTsFiles(targetDir);
    this.logger.info(`[JsDocGeneratorService] Found ${tsFiles.length} TypeScript files in ${targetDir}`);

    for (const filePath of tsFiles) {
      const result = await this.processFile(filePath);
      results.push(result);
    }
    return results;
  }

  /**
   * Generate JSDoc for exported symbols in a single TypeScript file.
   * @param filePath - Absolute path to the .ts file
   * @returns Result with counts of documented and skipped symbols
   */
  async generateForFile(filePath: string): Promise<JsDocResult> {
    return this.processFile(filePath);
  }

  /**
   * Recursively collect all .ts source files, excluding tests, declarations,
   * and node_modules / out directories.
   */
  private collectTsFiles(dir: string): string[] {
    const files: string[] = [];
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return files;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'out', 'dist', '.git'].includes(entry.name)) { continue; }
        files.push(...this.collectTsFiles(fullPath));
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.spec.ts') &&
        !entry.name.endsWith('.d.ts')
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  /**
   * Core processing logic — reads a file, counts undocumented exports,
   * calls the LLM to add JSDoc, and writes the result back.
   */
  private async processFile(filePath: string): Promise<JsDocResult> {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return { file: filePath, functionsDocumented: 0, skipped: 0 };
    }

    // Match exported functions, async functions, and classes
    const exportedFnRegex = /^export\s+(async\s+)?function\s+\w+|^export\s+(abstract\s+)?class\s+\w+/gm;
    const allExports = content.match(exportedFnRegex) || [];

    if (allExports.length === 0) {
      return { file: filePath, functionsDocumented: 0, skipped: 0 };
    }

    // Count how many already have a JSDoc block immediately preceding them
    // Pattern: /** ... */ followed (possibly with whitespace) by "export"
    const jsDocPrecedingExport = /\/\*\*[\s\S]*?\*\/\s*\n\s*export/g;
    const alreadyDocumented = (content.match(jsDocPrecedingExport) || []).length;
    const needsDoc = allExports.length - alreadyDocumented;

    if (needsDoc === 0) {
      this.logger.info(`[JsDocGeneratorService] ${path.basename(filePath)} — all ${allExports.length} export(s) already documented`);
      return { file: filePath, functionsDocumented: 0, skipped: allExports.length };
    }

    this.logger.info(`[JsDocGeneratorService] ${path.basename(filePath)} — ${needsDoc} undocumented export(s), generating JSDoc...`);

    const prompt = `You are a TypeScript documentation expert. Add JSDoc comments to all exported functions and classes that are missing them.

File: ${path.basename(filePath)}
Content:
${content.substring(0, 8000)}

Rules:
- ONLY add JSDoc where it is MISSING (do not touch existing /** ... */ blocks).
- Use @param, @returns, and @throws tags where appropriate.
- Keep descriptions concise — 1-2 sentences per param maximum.
- Do NOT change any logic, imports, or existing code.
- Output the COMPLETE updated file content with JSDoc added.
- Output raw TypeScript only — no markdown code fences, no explanations.`;

    let updatedContent = '';
    try {
      await this.llmService.streamGenerate(prompt, undefined, (token: string) => {
        updatedContent += token;
      });
    } catch (err: any) {
      this.logger.error(`[JsDocGeneratorService] LLM error for ${filePath}: ${err.message}`);
      return { file: filePath, functionsDocumented: 0, skipped: alreadyDocumented };
    }

    // Strip markdown fences if LLM wrapped the output
    updatedContent = updatedContent
      .replace(/^```(?:typescript|ts)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();

    // Sanity check: response must be substantial and contain exports
    if (updatedContent.length > 50 && updatedContent.includes('export')) {
      fs.writeFileSync(filePath, updatedContent, 'utf-8');
      this.logger.info(`[JsDocGeneratorService] Documented ${needsDoc} export(s) in ${path.basename(filePath)}`);
      return { file: filePath, functionsDocumented: needsDoc, skipped: alreadyDocumented };
    }

    this.logger.warn(`[JsDocGeneratorService] LLM response invalid for ${path.basename(filePath)} — file unchanged`);
    return { file: filePath, functionsDocumented: 0, skipped: allExports.length };
  }
}
