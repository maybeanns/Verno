/**
 * Sprint plan types — separate from sdlc.ts to avoid circular imports.
 * Imported by SprintPlannerAgent, SDLCWebviewPanel, and EnhancedSidebarProvider.
 */

import { Story } from './sdlc';

export interface Sprint {
    /** 1-indexed sprint number */
    number: number;
    /** Display name: "Sprint 1", "Sprint 2", etc. */
    name: string;
    /** Jira sprint ID after creation (undefined until synced) */
    jiraSprintId?: string;
    /** Stories scheduled in this sprint */
    stories: Story[];
    /** Sum of story points in this sprint */
    totalPoints: number;
}

export interface SprintPlan {
    /** Team capacity in story points per sprint */
    capacityPerSprint: number;
    /** Sum of all story points across all sprints */
    totalStoryPoints: number;
    /** Story IDs on the longest dependency chain (scheduled first) */
    criticalPath: string[];
    /** Ordered list of sprints */
    sprints: Sprint[];
    /** Unix timestamp when plan was generated */
    generatedAt: number;
}
