/**
 * Progress Indicator Service: Tracks agent pipeline execution progress
 * Emits events for UI updates
 */

import * as vscode from 'vscode';

/**
 * Progress state interface
 */
export interface ProgressState {
    currentStage: string;
    currentAgent: string;
    totalStages: number;
    completedStages: number;
    percentage: number;
    estimatedTimeRemaining?: number;
    status: 'idle' | 'running' | 'completed' | 'error';
}

/**
 * Progress event listener type
 */
export type ProgressListener = (state: ProgressState) => void;

/**
 * Service for tracking and reporting agent pipeline progress
 */
export class ProgressIndicator {
    private currentState: ProgressState;
    private listeners: ProgressListener[] = [];
    private stageStartTimes: Map<string, number> = new Map();
    private stageDurations: Map<string, number> = new Map();

    constructor() {
        this.currentState = {
            currentStage: '',
            currentAgent: '',
            totalStages: 0,
            completedStages: 0,
            percentage: 0,
            status: 'idle',
        };
    }

    /**
     * Initialize progress tracking for a pipeline
     * @param stages Array of stage names
     */
    initialize(stages: string[]): void {
        this.currentState = {
            currentStage: '',
            currentAgent: '',
            totalStages: stages.length,
            completedStages: 0,
            percentage: 0,
            status: 'idle',
        };
        this.stageStartTimes.clear();
        this.notifyListeners();
    }

    /**
     * Start a new stage
     * @param stageName Name of the stage
     * @param agentName Name of the agent executing the stage
     */
    startStage(stageName: string, agentName: string): void {
        this.currentState.currentStage = stageName;
        this.currentState.currentAgent = agentName;
        this.currentState.status = 'running';
        this.stageStartTimes.set(stageName, Date.now());

        this.updatePercentage();
        this.calculateEstimatedTime();
        this.notifyListeners();

        // Show VSCode progress notification
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Verno: ${agentName}`,
                cancellable: false,
            },
            async (progress) => {
                progress.report({ message: `Running stage: ${stageName}` });
                // Progress notification will auto-close when stage completes
            }
        );
    }

    /**
     * Complete the current stage
     */
    completeStage(): void {
        const stageName = this.currentState.currentStage;
        if (stageName && this.stageStartTimes.has(stageName)) {
            const duration = Date.now() - this.stageStartTimes.get(stageName)!;
            this.stageDurations.set(stageName, duration);
        }

        this.currentState.completedStages++;
        this.updatePercentage();
        this.calculateEstimatedTime();
        this.notifyListeners();
    }

    /**
     * Mark pipeline as completed
     */
    complete(): void {
        this.currentState.status = 'completed';
        this.currentState.percentage = 100;
        this.currentState.estimatedTimeRemaining = 0;
        this.notifyListeners();

        vscode.window.showInformationMessage('Verno: Pipeline completed successfully!');
    }

    /**
     * Mark pipeline as failed
     * @param error Error message
     */
    error(error: string): void {
        this.currentState.status = 'error';
        this.notifyListeners();

        vscode.window.showErrorMessage(`Verno: Pipeline failed - ${error}`);
    }

    /**
     * Get current progress state
     */
    getState(): ProgressState {
        return { ...this.currentState };
    }

    /**
     * Add a progress listener
     * @param listener Callback function
     */
    addListener(listener: ProgressListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove a progress listener
     * @param listener Callback function to remove
     */
    removeListener(listener: ProgressListener): void {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Reset progress state
     */
    reset(): void {
        this.currentState = {
            currentStage: '',
            currentAgent: '',
            totalStages: 0,
            completedStages: 0,
            percentage: 0,
            status: 'idle',
        };
        this.stageStartTimes.clear();
        this.stageDurations.clear();
        this.notifyListeners();
    }

    /**
     * Update percentage completion
     */
    private updatePercentage(): void {
        if (this.currentState.totalStages === 0) {
            this.currentState.percentage = 0;
            return;
        }
        this.currentState.percentage = Math.round(
            (this.currentState.completedStages / this.currentState.totalStages) * 100
        );
    }

    /**
     * Calculate estimated time remaining based on completed stage durations
     */
    private calculateEstimatedTime(): void {
        if (this.stageDurations.size === 0) {
            this.currentState.estimatedTimeRemaining = undefined;
            return;
        }

        // Calculate average stage duration
        const totalDuration = Array.from(this.stageDurations.values()).reduce((a, b) => a + b, 0);
        const avgDuration = totalDuration / this.stageDurations.size;

        // Estimate remaining time
        const remainingStages = this.currentState.totalStages - this.currentState.completedStages;
        this.currentState.estimatedTimeRemaining = Math.round(avgDuration * remainingStages / 1000); // Convert to seconds
    }

    /**
     * Notify all listeners of state change
     */
    private notifyListeners(): void {
        for (const listener of this.listeners) {
            try {
                listener(this.currentState);
            } catch (err) {
                console.error('Error in progress listener:', err);
            }
        }
    }

    /**
     * Format time for display
     * @param seconds Time in seconds
     * @returns Formatted string
     */
    static formatTime(seconds: number): string {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }
}
