import * as vscode from 'vscode';
import * as path from 'path';
import { JsDocGeneratorService } from '../services/documentation/JsDocGeneratorService';
import { ChangelogService } from '../services/documentation/ChangelogService';
import { LLMService } from '../services/llm';

/**
 * Register all Phase 11 documentation commands:
 * - verno.generateJsDocs        — generate JSDoc for the BMAD agents directory
 * - verno.generateJsDocsFile    — generate JSDoc for the currently active file
 * - verno.generateChangelog     — generate CHANGELOG.md from git history
 *
 * @param context - VSCode extension context for subscription management
 * @param llmService - Shared LLM service instance
 * @param logger - Verno logger instance
 */
export function registerDocumentationCommands(
  context: vscode.ExtensionContext,
  llmService: LLMService,
  logger: any
): void {
  const jsDocService = new JsDocGeneratorService(llmService, logger);
  const changelogService = new ChangelogService(logger);

  // ─── verno.generateJsDocs ────────────────────────────────────────────────
  // Generates JSDoc for all undocumented exported symbols in src/agents/BMAD/
  const generateJsDocsCmd = vscode.commands.registerCommand('verno.generateJsDocs', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('Verno: No workspace folder open.');
      return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const targetDir = path.join(workspaceRoot, 'src', 'agents', 'BMAD');

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Verno: Generating JSDoc for BMAD agents...',
        cancellable: false,
      },
      async () => {
        try {
          const results = await jsDocService.generateForDirectory(targetDir);
          const totalDocumented = results.reduce((sum, r) => sum + r.functionsDocumented, 0);
          const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
          const filesChanged = results.filter(r => r.functionsDocumented > 0).length;

          vscode.window.showInformationMessage(
            `Verno: JSDoc generation complete. ${totalDocumented} export(s) documented across ${filesChanged} file(s). ${totalSkipped} already had docs.`
          );
          logger.info(`[DocumentationCommands] JSDoc: ${totalDocumented} documented, ${totalSkipped} skipped`);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Verno: JSDoc generation failed — ${err.message}`);
          logger.error(`[DocumentationCommands] JSDoc generation error: ${err.message}`);
        }
      }
    );
  });

  // ─── verno.generateJsDocsFile ─────────────────────────────────────────────
  // Generates JSDoc for undocumented exports in the currently open .ts file
  const generateJsDocsFileCmd = vscode.commands.registerCommand('verno.generateJsDocsFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Verno: No active editor. Open a TypeScript file first.');
      return;
    }
    const filePath = editor.document.fileName;
    if (!filePath.endsWith('.ts')) {
      vscode.window.showWarningMessage('Verno: JSDoc generation is only supported for TypeScript (.ts) files.');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Verno: Generating JSDoc for ${path.basename(filePath)}...`,
        cancellable: false,
      },
      async () => {
        try {
          const result = await jsDocService.generateForFile(filePath);
          if (result.functionsDocumented > 0) {
            // Reload document to show updated content
            await vscode.commands.executeCommand('workbench.action.revertFile');
            vscode.window.showInformationMessage(
              `Verno: JSDoc generation complete. ${result.functionsDocumented} export(s) documented, ${result.skipped} already had docs.`
            );
          } else {
            vscode.window.showInformationMessage(
              `Verno: All ${result.skipped} export(s) in ${path.basename(filePath)} already have JSDoc — nothing to do.`
            );
          }
        } catch (err: any) {
          vscode.window.showErrorMessage(`Verno: JSDoc generation failed — ${err.message}`);
          logger.error(`[DocumentationCommands] JSDoc file generation error: ${err.message}`);
        }
      }
    );
  });

  // ─── verno.generateChangelog ──────────────────────────────────────────────
  // Parses git history using Conventional Commits and writes CHANGELOG.md
  const generateChangelogCmd = vscode.commands.registerCommand('verno.generateChangelog', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('Verno: No workspace folder open.');
      return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    const choice = await vscode.window.showQuickPick(
      ['Generate / Update CHANGELOG.md from git history', 'Cancel'],
      { placeHolder: 'Verno: Changelog Generator' }
    );
    if (!choice || choice === 'Cancel') { return; }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Verno: Generating CHANGELOG.md...',
        cancellable: false,
      },
      async () => {
        try {
          const outputPath = await changelogService.generate(workspaceRoot);
          const uri = vscode.Uri.file(outputPath);
          await vscode.window.showTextDocument(uri);
          vscode.window.showInformationMessage('Verno: CHANGELOG.md generated successfully.');
          logger.info(`[DocumentationCommands] CHANGELOG.md written to ${outputPath}`);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Verno: Changelog generation failed — ${err.message}`);
          logger.error(`[DocumentationCommands] Changelog generation error: ${err.message}`);
        }
      }
    );
  });

  context.subscriptions.push(generateJsDocsCmd, generateJsDocsFileCmd, generateChangelogCmd);
  logger.info('[DocumentationCommands] Documentation commands registered (generateJsDocs, generateJsDocsFile, generateChangelog)');
}
