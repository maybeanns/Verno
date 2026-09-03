/**
 * Simplified LangChain Service - Lightweight wrapper for conversation management
 * Uses direct provider API calls with conversation memory
 */

import { ILLMProvider } from '../../types';

export type LangChainProviderType = 'openai' | 'anthropic' | 'gemini' | 'groq';

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Simplified LangChain-like service with conversation memory
 */
export class LangChainService {
  private provider: ILLMProvider | null = null;
  private providerType: LangChainProviderType | null = null;
  private sessions: Map<string, ConversationSession> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Initialize the provider
   */
  async initializeProvider(
    providerType: LangChainProviderType,
    apiKey: string,
    modelName?: string
  ): Promise<void> {
    this.providerType = providerType;
    // Provider will be set externally via setProvider method
  }

  /**
   * Set the LLM provider
   */
  setProvider(provider: ILLMProvider): void {
    this.provider = provider;
  }

  /**
   * Create a new conversation session
   */
  createSession(sessionId?: string): string {
    const id = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.sessions.set(id, {
      id,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.currentSessionId = id;
    return id;
  }

  /**
   * Send a chat message with conversation context
   */
  async chat(message: string, sessionId?: string): Promise<string> {
    const session = this.getSession(sessionId);

    // Add user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    // Build prompt with conversation history
    const prompt = this.buildPromptWithHistory(session);

    // Generate response using provider
    if (!this.provider) {
      throw new Error('Provider not set');
    }

    const response = await this.provider.generateText(prompt);

    // Add assistant message
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });

    session.updatedAt = Date.now();
    return response;
  }

  /**
   * Stream a chat message
   */
  async streamChat(
    message: string,
    sessionId: string | undefined,
    onToken: (token: string) => void
  ): Promise<void> {
    const session = this.getSession(sessionId);

    // Add user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    const prompt = this.buildPromptWithHistory(session);

    if (!this.provider) {
      throw new Error('Provider not set');
    }

    // Check if provider supports streaming
    const providerAny: any = this.provider;
    if (typeof providerAny.streamGenerate === 'function') {
      let fullResponse = '';
      await providerAny.streamGenerate(
        prompt,
        {},
        (token: string) => {
          fullResponse += token;
          onToken(token);
        }
      );

      // Add assistant message
      session.messages.push({
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      });
    } else {
      // Fallback to non-streaming
      const response = await this.provider.generateText(prompt);
      onToken(response);

      session.messages.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      });
    }

    session.updatedAt = Date.now();
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(sessionId?: string): Promise<ConversationMessage[]> {
    const session = this.getSession(sessionId);
    return [...session.messages];
  }

  /**
   * Clear conversation memory
   */
  async clearSession(sessionId?: string): Promise<void> {
    const session = this.getSession(sessionId);
    session.messages = [];
    session.updatedAt = Date.now();
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  /**
   * Get all session IDs
   */
  getAllSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Set current session
   */
  setCurrentSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }
    this.currentSessionId = sessionId;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get provider type
   */
  getProviderType(): LangChainProviderType | null {
    return this.providerType;
  }

  /**
   * Get session
   */
  private getSession(sessionId?: string): ConversationSession {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      throw new Error('No session ID provided and no current session set');
    }

    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    return session;
  }

  /**
   * Build prompt with conversation history
   */
  private buildPromptWithHistory(session: ConversationSession): string {
    let prompt = '';

    // Add conversation history
    for (const msg of session.messages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`;
      } else if (msg.role === 'system') {
        prompt += `System: ${msg.content}\n\n`;
      }
    }

    return prompt;
  }
}
