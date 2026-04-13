export enum SDLCPhase {
    TOPIC_INPUT = 'TOPIC_INPUT',
    DEBATE = 'DEBATE',
    PRD_REVIEW = 'PRD_REVIEW',
    TASK_BREAKDOWN = 'TASK_BREAKDOWN',
    JIRA_PUSH = 'JIRA_PUSH',
    COMPLETE = 'COMPLETE'
}

export type SyncStatus = 'pending' | 'pushing' | 'pushed' | 'failed' | 'skipped';

export interface Agent {
    id: string;
    name: string;
    role: string;
    color?: string;
}

export interface DebateMessage {
    agentId: string;
    content: string;
    round: number;
    timestamp: number;
    type: 'argument' | 'counter' | 'consensus';
}

export interface PRDSection {
    title: string;
    content: string;
    /** GDPR / HIPAA compliance warnings auto-detected from section content. */
    complianceFlags?: string[];
}


export interface PRDDocument {
    title: string;
    sections: PRDSection[];
    status: 'draft' | 'approved' | 'revised';
}

export interface SubTask {
    id: string;
    title: string;
    status: string;
    jiraKey?: string;
    jiraId?: string;
    syncStatus: SyncStatus;
    parentStoryId: string;
    assignedAgent?: string;
}

export interface Story {
    id: string;
    title: string;
    description: string;
    storyPoints?: number;
    priority: string;
    status: string;
    jiraKey?: string;
    jiraId?: string;
    syncStatus: SyncStatus;
    parentEpicId: string;
    assignedAgent?: string;
    subtasks: SubTask[];
}

export interface Epic {
    id: string;
    title: string;
    description: string;
    jiraKey?: string;
    jiraId?: string;
    syncStatus: SyncStatus;
    assignedAgent?: string;
    stories: Story[];
}

export interface JiraCredentials {
    domain: string;
    email: string;
    apiToken: string;
}

export interface JiraProject {
    id: string;
    key: string;
    name: string;
    availableIssueTypes: string[];
}

export interface JiraFieldMapping {
    storyPointsFieldId: string;
}

export interface OrchestratorAdapter {
    pushTasks(epics: Epic[]): Promise<void>;
    getProjects(): Promise<JiraProject[]>;
    onSyncUpdate(callback: (itemId: string, syncStatus: SyncStatus) => void): void;
    isAvailable(): boolean;
}
