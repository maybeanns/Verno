import * as fs from 'fs';
import * as path from 'path';

export interface PlanningMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface PlanningSession {
  id: string;
  userRequest: string;
  conversationHistory: PlanningMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Manages planning sessions and conversation history
 */
export class PlanningService {
  private sessions: Map<string, PlanningSession> = new Map();
  private currentSessionId: string | null = null;

  constructor(private workspaceRoot: string) {
    this.loadSessions();
  }

  /**
   * Create a new planning session
   */
  createSession(userRequest: string): string {
    const sessionId = `plan-${Date.now()}`;
    const session: PlanningSession = {
      id: sessionId,
      userRequest,
      conversationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    this.saveSessions();
    return sessionId;
  }

  /**
   * Add a message to the current planning session
   */
  addMessage(role: 'user' | 'assistant', content: string): void {
    if (!this.currentSessionId) {
      throw new Error('No active planning session');
    }
    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    session.conversationHistory.push({
      role,
      content,
      timestamp: Date.now()
    });
    session.updatedAt = Date.now();
    this.saveSessions();
  }

  /**
   * Get the current session
   */
  getCurrentSession(): PlanningSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): PlanningSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Set the active session
   */
  setCurrentSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }
    this.currentSessionId = sessionId;
  }

  /**
   * Get conversation history as text
   */
  getConversationAsText(sessionId?: string): string {
    const session = this.sessions.get(sessionId || this.currentSessionId || '');
    if (!session) return '';
    
    let text = `Planning Session: ${session.userRequest}\n\n`;
    for (const msg of session.conversationHistory) {
      text += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
    }
    return text;
  }

  /**
   * Get conversation history for context injection
   */
  getConversationForContext(sessionId?: string): string {
    return this.getConversationAsText(sessionId);
  }

  /**
   * Save sessions to disk
   */
  private saveSessions(): void {
    try {
      const planningDir = path.join(this.workspaceRoot, '.verno-planning');
      if (!fs.existsSync(planningDir)) {
        fs.mkdirSync(planningDir, { recursive: true });
      }
      const indexPath = path.join(planningDir, 'sessions.json');
      fs.writeFileSync(indexPath, JSON.stringify(Array.from(this.sessions.values()), null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save planning sessions:', err);
    }
  }

  /**
   * Load sessions from disk
   */
  private loadSessions(): void {
    try {
      const planningDir = path.join(this.workspaceRoot, '.verno-planning');
      const indexPath = path.join(planningDir, 'sessions.json');
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, 'utf-8');
        const sessions = JSON.parse(data) as PlanningSession[];
        for (const session of sessions) {
          this.sessions.set(session.id, session);
        }
      }
    } catch (err) {
      console.error('Failed to load planning sessions:', err);
    }
  }
}
