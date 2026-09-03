/**
 * Manage agents command implementation
 */

import * as vscode from 'vscode';

export class ManageAgentsCommand {
  static readonly id = 'verno.manageAgents';

  static register(context: vscode.ExtensionContext): void {
    vscode.commands.registerCommand(this.id, async () => {
      // TODO: Implement agent management UI
      vscode.window.showInformationMessage('Opening agent manager');
    });
  }
}
