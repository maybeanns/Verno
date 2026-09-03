import * as vscode from 'vscode';
import { SecurityComplianceService } from '../services/project/SecurityComplianceService';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export function registerSecurityCommands(
    context: vscode.ExtensionContext,
    logger: Logger
): void {
    const securityService = new SecurityComplianceService();

    // ── verno.generateOwaspChecklist ────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('verno.generateOwaspChecklist', async () => {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('Verno: No workspace open');
                return;
            }

            const prdPath = path.join(workspaceRoot, '.verno', 'PRD.md');
            if (!fs.existsSync(prdPath)) {
                vscode.window.showWarningMessage(
                    'Verno: No PRD.md found in .verno/. Run a debate first to generate a PRD.'
                );
                return;
            }

            const prdContent = fs.readFileSync(prdPath, 'utf-8');
            const owaspItems = securityService.getOwaspItemsForFeature(prdContent);
            const checklist = securityService.formatOwaspChecklist(owaspItems);

            const outputChannel = vscode.window.createOutputChannel('Verno Security');
            outputChannel.clear();
            outputChannel.appendLine('═══════════════════════════════════════════════════');
            outputChannel.appendLine(' Verno — OWASP Checklist for Current PRD');
            outputChannel.appendLine('═══════════════════════════════════════════════════');
            outputChannel.appendLine('');
            outputChannel.appendLine(`PRD: ${prdPath}`);
            outputChannel.appendLine(`OWASP items applicable: ${owaspItems.length}`);
            outputChannel.appendLine('');
            owaspItems.forEach(item => {
                outputChannel.appendLine(`[ ] ${item.id}: ${item.title}`);
                outputChannel.appendLine(`    → ${item.check}`);
                outputChannel.appendLine('');
            });
            outputChannel.show();

            logger.info('[SecurityCommands] OWASP checklist generated');
            vscode.window.showInformationMessage(
                `Verno: ${owaspItems.length} OWASP checks identified for this PRD`
            );
        })
    );

    // ── verno.checkCompliance ───────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('verno.checkCompliance', async () => {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('Verno: No workspace open');
                return;
            }

            const prdPath = path.join(workspaceRoot, '.verno', 'PRD.md');
            if (!fs.existsSync(prdPath)) {
                vscode.window.showWarningMessage(
                    'Verno: No PRD.md found in .verno/. Run a debate first.'
                );
                return;
            }

            const prdContent = fs.readFileSync(prdPath, 'utf-8');
            const complianceFlags = securityService.scanForFlags(prdContent);

            const outputChannel = vscode.window.createOutputChannel('Verno Security');
            outputChannel.clear();
            outputChannel.appendLine('═══════════════════════════════════════════════════');
            outputChannel.appendLine(' Verno — Compliance Scan Results');
            outputChannel.appendLine('═══════════════════════════════════════════════════');
            outputChannel.appendLine('');

            if (complianceFlags.length === 0) {
                outputChannel.appendLine('✓ No GDPR or HIPAA signals detected in PRD.');
            } else {
                const errors = complianceFlags.filter(f => f.severity === 'error');
                const warns = complianceFlags.filter(f => f.severity === 'warn');
                outputChannel.appendLine(`Found: ${errors.length} error(s), ${warns.length} warning(s)`);
                outputChannel.appendLine('');

                complianceFlags.forEach(flag => {
                    const icon = flag.severity === 'error' ? '✗' : '⚠';
                    outputChannel.appendLine(
                        `${icon} [${flag.regulation}] ${flag.article}`
                    );
                    outputChannel.appendLine(`  Trigger: "${flag.trigger}"`);
                    outputChannel.appendLine(`  Action:  ${flag.recommendation}`);
                    outputChannel.appendLine('');
                });
            }

            outputChannel.show();
            logger.info(`[SecurityCommands] Compliance scan: ${complianceFlags.length} flag(s)`);

            if (complianceFlags.some(f => f.severity === 'error')) {
                vscode.window.showWarningMessage(
                    `Verno: ${complianceFlags.filter(f=>f.severity==='error').length} compliance issues require attention — see Verno Security output`
                );
            } else {
                vscode.window.showInformationMessage(
                    `Verno: Compliance scan complete — ${complianceFlags.length} flag(s) found`
                );
            }
        })
    );
}
