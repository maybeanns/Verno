import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LLMService } from '../llm';

/**
 * ReadmeSyncService — Phase 11 (DOC-01)
 *
 * Listens for file save events and checks whether the workspace README.md
 * references the saved file. If it does, offers an LLM-driven section
 * regeneration prompt (non-destructive — never auto-overwrites).
 */
export class ReadmeSyncService {
  constructor(
    private llmService: LLMService,
    private logger: any
  ) {}

  /**
   * Called from the vscode.workspace.onDidSaveTextDocument listener.
   * Checks whether README.md contains a section referencing the saved file.
   * If stale markers are detected, offers to regenerate that section.
   * @param document - The document that was just saved
   * @param workspaceRoot - Absolute path to the workspace root folder
   */
  async onFileSaved(document: vscode.TextDocument, workspaceRoot: string): Promise<void> {
    // Skip non-source files and the README itself
    if (document.fileName.endsWith('README.md')) { return; }

    const savedRelPath = path.relative(workspaceRoot, document.fileName).replace(/\\/g, '/');
    const readmePath = path.join(workspaceRoot, 'README.md');

    if (!fs.existsSync(readmePath)) { return; }

    const readmeContent = fs.readFileSync(readmePath, 'utf-8');

    // Check if README references the saved file path or its basename (without extension)
    const basename = path.basename(savedRelPath, path.extname(savedRelPath));
    const isReferenced = readmeContent.includes(savedRelPath) || readmeContent.includes(basename);
    if (!isReferenced) { return; }

    const choice = await vscode.window.showInformationMessage(
      `README.md may have a stale section referencing ${basename} — regenerate it?`,
      'Regenerate Section',
      'Dismiss'
    );

    if (choice !== 'Regenerate Section') { return; }

    await this.regenerateSection(savedRelPath, document.getText(), readmePath, readmeContent);
  }

  /**
   * Uses the LLM to rewrite only the README section(s) that describe the changed file.
   * Writes the result back to README.md only if the response is valid.
   * @param relPath - Relative path of the changed source file
   * @param fileContent - Current content of the changed file
   * @param readmePath - Absolute path to README.md
   * @param readmeContent - Current content of README.md
   */
  private async regenerateSection(
    relPath: string,
    fileContent: string,
    readmePath: string,
    readmeContent: string
  ): Promise<void> {
    const prompt = `You are a technical writer. A source file has changed and the README section referencing it may be stale.

Source file: ${relPath}
Current file content (first 3000 chars):
${fileContent.substring(0, 3000)}

Current README.md:
${readmeContent.substring(0, 6000)}

Task: Identify the section(s) in README.md that describe or reference "${relPath}".
Rewrite ONLY those section(s) to reflect the current file content.
Output the COMPLETE updated README.md with your changes applied.
Do not change sections unrelated to this file.
Output raw markdown only — no code fences, no explanations.`;

    let updatedReadme = '';
    try {
      await this.llmService.streamGenerate(prompt, undefined, (token: string) => {
        updatedReadme += token;
      });
    } catch (err: any) {
      this.logger.error(`[ReadmeSyncService] LLM error during section regeneration: ${err.message}`);
      vscode.window.showErrorMessage(`Verno: README regeneration failed — ${err.message}`);
      return;
    }

    // Strip markdown fences if the LLM wrapped the output
    updatedReadme = updatedReadme
      .replace(/^```(?:markdown|md)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();

    // Only write if the response looks like valid README content
    if (updatedReadme.length > 100 && updatedReadme.includes('#')) {
      fs.writeFileSync(readmePath, updatedReadme, 'utf-8');
      this.logger.info(`[ReadmeSyncService] README.md updated for changes in ${relPath}`);
      vscode.window.showInformationMessage(
        `Verno: README.md updated for changes in ${path.basename(relPath)}.`
      );
    } else {
      this.logger.warn('[ReadmeSyncService] LLM response too short or invalid — README not updated');
      vscode.window.showWarningMessage('Verno: README regeneration produced no useful content — file unchanged.');
    }
  }
}
