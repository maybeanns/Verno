import { IssueSeverity } from '../../services/feedback';

export interface IssueRecord {
  severity: IssueSeverity;
  description: string;
  context: string;
  file?: string;
  line?: number;
  autoFixed?: boolean;
}

export interface BlackboardStateData {
  prd: {
    title: string;
    sections: Array<{ title: string; content: string; complianceFlags?: string[] }>;
    status: 'draft' | 'approved';
  } | null;
  architectureSpecs: {
    endpoints: Array<{ method: string; path: string; auth: boolean; rateLimit: string }>;
    dataModels: Record<string, string>;
    techStack: Record<string, string>;
  } | null;
  uxFlows: {
    screens: string[];
    accessibilityChecked: boolean;
  } | null;
  sprintTasks: Array<{ id: string; title: string; completed: boolean; assignedTo?: string }>;
  issues: IssueRecord[];
  dependencies: Record<string, string>;
  metadata: Record<string, any>;
}

export class BlackboardState {
  private state: BlackboardStateData;

  constructor() {
    this.state = {
      prd: null,
      architectureSpecs: null,
      uxFlows: null,
      sprintTasks: [],
      issues: [],
      dependencies: {},
      metadata: {},
    };
  }

  public get(): BlackboardStateData {
    return { ...this.state };
  }

  public update(updater: (state: BlackboardStateData) => void): void {
    updater(this.state);
  }

  public addIssue(issue: IssueRecord): void {
    this.state.issues.push(issue);
  }

  public clearIssues(): void {
    this.state.issues = [];
  }

  public setMetadata(key: string, value: any): void {
    this.state.metadata[key] = value;
  }

  public getMetadata<T>(key: string): T | undefined {
    return this.state.metadata[key] as T;
  }
}
