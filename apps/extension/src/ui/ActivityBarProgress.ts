/**
 * Progress Display Component for Activity Bar
 * Shows real-time agent progress in VSCode activity bar
 */

import * as vscode from 'vscode';
import { ProgressIndicator, ProgressState } from '../services/progress/ProgressIndicator';

export class ActivityBarProgress {
    private statusBarItem: vscode.StatusBarItem;
    private progressIndicator?: ProgressIndicator;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.text = '$(pulse) Verno Ready';
        this.statusBarItem.show();
    }

    /**
     * Attach to a progress indicator
     */
    attachProgressIndicator(progressIndicator: ProgressIndicator): void {
        this.progressIndicator = progressIndicator;

        // Listen to progress updates
        this.progressIndicator.addListener((state: ProgressState) => {
            this.updateDisplay(state);
        });
    }

    /**
     * Update progress manually
     */
    updateProgress(stage: string, percentage: number): void {
        const agentName = stage.replace('Agent', '');
        this.statusBarItem.text = `$(sync~spin) ${agentName}: ${percentage}%`;
        this.statusBarItem.tooltip = `Processing: ${stage}`;
    }

    /**
     * Mark as complete
     */
    complete(): void {
        this.statusBarItem.text = '$(check) Verno Complete';
        this.statusBarItem.tooltip = 'Task completed successfully';

        // Reset to ready state after 3 seconds
        setTimeout(() => {
            this.statusBarItem.text = '$(pulse) Verno Ready';
            this.statusBarItem.tooltip = undefined;
        }, 3000);
    }

    /**
     * Update the status bar display
     */
    private updateDisplay(state: ProgressState): void {
        if (state.status === 'idle') {
            this.statusBarItem.text = '$(pulse) Verno Ready';
            this.statusBarItem.tooltip = 'No active agents';
        } else if (state.status === 'running') {
            const percentage = Math.round(state.percentage);
            const timeRemaining = state.estimatedTimeRemaining
                ? ` (~${Math.round(state.estimatedTimeRemaining / 1000)}s remaining)`
                : '';

            this.statusBarItem.text = `$(sync~spin) ${state.currentAgent}: ${percentage}%`;
            this.statusBarItem.tooltip = `Stage: ${state.currentStage}\n${state.completedStages}/${state.totalStages} stages complete${timeRemaining}`;
        } else if (state.status === 'completed') {
            this.complete();
        } else if (state.status === 'error') {
            this.statusBarItem.text = '$(error) Verno Error';
            this.statusBarItem.tooltip = 'An error occurred during execution';
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.statusBarItem.dispose();
    }
}
