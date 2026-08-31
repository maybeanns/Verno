/**
 * JiraCreateIssueTool — creates a Jira issue (Epic/Story/Subtask) via REST API.
 * Tool name: "jira-create-issue"
 *
 * Wraps the Jira REST API. Credentials are expected to be passed via input
 * (retrieved from VS Code SecretStorage by the caller) rather than hardcoded.
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { VernoTool } from '../ToolRegistry';

export interface JiraCreateIssueInput {
  jiraBaseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueType: 'Epic' | 'Story' | 'Subtask' | 'Task' | 'Bug';
  summary: string;
  description?: string;
  parentKey?: string;
  storyPoints?: number;
  labels?: string[];
}

export interface JiraCreateIssueOutput {
  issueKey: string;
  issueUrl: string;
  id: string;
}

export const JiraCreateIssueTool: VernoTool<JiraCreateIssueInput, JiraCreateIssueOutput> = {
  name: 'jira-create-issue',
  description: 'Create a Jira issue (Epic, Story, Task, Subtask, or Bug) in the specified project.',
  inputSchema: {
    type: 'object',
    properties: {
      jiraBaseUrl: { type: 'string', description: 'Jira instance base URL (e.g. https://yourorg.atlassian.net)' },
      email: { type: 'string', description: 'Jira user email for Basic Auth' },
      apiToken: { type: 'string', description: 'Jira API token (from https://id.atlassian.com/manage/api-tokens)' },
      projectKey: { type: 'string', description: 'Jira project key (e.g. VERNO)' },
      issueType: { type: 'string', description: 'Jira issue type', enum: ['Epic', 'Story', 'Subtask', 'Task', 'Bug'] },
      summary: { type: 'string', description: 'Issue summary/title' },
      description: { type: 'string', description: 'Issue description (Atlassian Document Format or plain text)' },
      parentKey: { type: 'string', description: 'Parent issue key (required for Subtask)' },
      storyPoints: { type: 'number', description: 'Story points estimate' },
      labels: { type: 'string', description: 'Labels to attach (array as comma-separated string)' },
    },
    required: ['jiraBaseUrl', 'email', 'apiToken', 'projectKey', 'issueType', 'summary'],
  },

  async execute(input: JiraCreateIssueInput): Promise<JiraCreateIssueOutput> {
    const body: Record<string, unknown> = {
      fields: {
        project: { key: input.projectKey },
        issuetype: { name: input.issueType },
        summary: input.summary,
        ...(input.description && {
          description: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: input.description }] }],
          },
        }),
        ...(input.parentKey && { parent: { key: input.parentKey } }),
        ...(input.storyPoints !== undefined && { story_points: input.storyPoints }),
        ...(input.labels && input.labels.length > 0 && { labels: input.labels }),
      },
    };

    const auth = Buffer.from(`${input.email}:${input.apiToken}`).toString('base64');
    const parsed = new URL('/rest/api/3/issue', input.jiraBaseUrl);
    const payload = JSON.stringify(body);

    const response = await makeRequest({
      hostname: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      protocol: parsed.protocol,
      payload,
    });

    const result = JSON.parse(response) as { id: string; key: string; self: string };
    return {
      issueKey: result.key,
      issueUrl: `${input.jiraBaseUrl}/browse/${result.key}`,
      id: result.id,
    };
  },
};

function makeRequest(opts: {
  hostname: string; port: number; path: string; method: string;
  headers: Record<string, string | number>; protocol: string; payload: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = opts.protocol === 'https:' ? https : http;
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Jira API error ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(opts.payload);
    req.end();
  });
}
