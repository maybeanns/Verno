/**
 * Recording status bar item
 */

import * as vscode from 'vscode';

export class RecordingStatus {
  private statusBarItem: vscode.StatusBarItem;
  private isRecording: boolean = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'verno.toggleRecording';
    this.hide();
  }

  show(): void {
    this.statusBarItem.show();
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  startRecording(): void {
    this.isRecording = true;
    this.statusBarItem.text = '● Recording...';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    this.show();
  }

  stopRecording(): void {
    this.isRecording = false;
    this.statusBarItem.text = '○ Start Recording';
    this.statusBarItem.backgroundColor = undefined;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
