/**
 * Stop recording command implementation
 */

import * as vscode from 'vscode';

export class StopRecordingCommand {
  static readonly id = 'verno.stopRecording';

  static register(context: vscode.ExtensionContext): void {
    vscode.commands.registerCommand(this.id, async () => {
      // TODO: Implement stop recording logic
      vscode.window.showInformationMessage('Recording stopped');
    });
  }
}
