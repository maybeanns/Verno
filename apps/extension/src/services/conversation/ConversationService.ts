/**
 * Conversation Service: Manages conversation persistence and retrieval
 * Stores conversations in .verno/conversations/ directory
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Conversation message interface
 */
export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    agentId?: string;
}

/**
 * Conversation interface
 */
export interface Conversation {
    id: string;
    title: string;
    messages: ConversationMessage[];
    createdAt: number;
    updatedAt: number;
    mode?: 'planning' | 'development' | 'chat';
}

/**
 * Service for managing conversation persistence and retrieval
 */
export class ConversationService {
    private workspaceRoot: string;
    private conversationsDir: string;
    private conversations: Map<string, Conversation> = new Map();
    private currentConversationId: string | null = null;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.conversationsDir = path.join(workspaceRoot, '.verno', 'conversations');
        this.ensureDirectoryExists();
        this.loadAllConversations();
    }

    /**
     * Create a new conversation
     * @param title Conversation title
     * @param mode Conversation mode (planning, development, chat)
     * @returns Conversation ID
     */
    createConversation(title: string, mode?: 'planning' | 'development' | 'chat'): string {
        const id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const conversation: Conversation = {
            id,
            title,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            mode: mode || 'chat',
        };

        this.conversations.set(id, conversation);
        this.currentConversationId = id;
        this.saveConversation(conversation);
        return id;
    }

    /**
     * Add a message to a conversation
     * @param conversationId Conversation ID
     * @param role Message role
     * @param content Message content
     * @param agentId Optional agent identifier
     */
    addMessage(
        conversationId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        agentId?: string
    ): void {
        const conversation = this.getConversation(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }

        const message: ConversationMessage = {
            role,
            content,
            timestamp: Date.now(),
            agentId,
        };

        conversation.messages.push(message);
        conversation.updatedAt = Date.now();
        this.saveConversation(conversation);
    }

    /**
     * Get a conversation by ID
     * @param conversationId Conversation ID
     * @returns Conversation or null
     */
    getConversation(conversationId: string): Conversation | null {
        return this.conversations.get(conversationId) || null;
    }

    /**
     * Get all conversations
     * @returns Array of conversations sorted by update time
     */
    getAllConversations(): Conversation[] {
        return Array.from(this.conversations.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /**
     * Get current conversation
     * @returns Current conversation or null
     */
    getCurrentConversation(): Conversation | null {
        if (!this.currentConversationId) {
            return null;
        }
        return this.getConversation(this.currentConversationId);
    }

    /**
     * Set the current active conversation
     * @param conversationId Conversation ID
     */
    setCurrentConversation(conversationId: string): void {
        if (!this.conversations.has(conversationId)) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        this.currentConversationId = conversationId;
    }

    /**
     * Delete a conversation
     * @param conversationId Conversation ID
     */
    deleteConversation(conversationId: string): void {
        const filePath = this.getConversationFilePath(conversationId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        this.conversations.delete(conversationId);
        if (this.currentConversationId === conversationId) {
            this.currentConversationId = null;
        }
    }

    /**
     * Export a conversation to JSON
     * @param conversationId Conversation ID
     * @param exportPath Export file path
     */
    exportConversation(conversationId: string, exportPath: string): void {
        const conversation = this.getConversation(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        fs.writeFileSync(exportPath, JSON.stringify(conversation, null, 2), 'utf-8');
    }

    /**
     * Import a conversation from JSON
     * @param importPath Import file path
     * @returns Imported conversation ID
     */
    importConversation(importPath: string): string {
        const data = fs.readFileSync(importPath, 'utf-8');
        const conversation = JSON.parse(data) as Conversation;

        // Generate new ID to avoid conflicts
        const newId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        conversation.id = newId;

        this.conversations.set(newId, conversation);
        this.saveConversation(conversation);
        return newId;
    }

    /**
     * Get conversation messages as text
     * @param conversationId Conversation ID
     * @returns Formatted conversation text
     */
    getConversationAsText(conversationId: string): string {
        const conversation = this.getConversation(conversationId);
        if (!conversation) {
            return '';
        }

        let text = `Conversation: ${conversation.title}\n`;
        text += `Mode: ${conversation.mode}\n\n`;

        for (const msg of conversation.messages) {
            const roleLabel = msg.role.toUpperCase();
            const agentLabel = msg.agentId ? ` [${msg.agentId}]` : '';
            text += `${roleLabel}${agentLabel}: ${msg.content}\n\n`;
        }

        return text;
    }

    /**
     * Clear all messages from a conversation
     * @param conversationId Conversation ID
     */
    clearMessages(conversationId: string): void {
        const conversation = this.getConversation(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        conversation.messages = [];
        conversation.updatedAt = Date.now();
        this.saveConversation(conversation);
    }

    /**
     * Save a conversation to disk
     */
    private saveConversation(conversation: Conversation): void {
        try {
            const filePath = this.getConversationFilePath(conversation.id);
            fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
        } catch (err) {
            console.error(`Failed to save conversation ${conversation.id}:`, err);
        }
    }

    /**
     * Load all conversations from disk
     */
    private loadAllConversations(): void {
        try {
            if (!fs.existsSync(this.conversationsDir)) {
                return;
            }

            const files = fs.readdirSync(this.conversationsDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.conversationsDir, file);
                    const data = fs.readFileSync(filePath, 'utf-8');
                    const conversation = JSON.parse(data) as Conversation;
                    this.conversations.set(conversation.id, conversation);
                }
            }
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }

    /**
     * Ensure conversations directory exists
     */
    private ensureDirectoryExists(): void {
        if (!fs.existsSync(this.conversationsDir)) {
            fs.mkdirSync(this.conversationsDir, { recursive: true });
        }
    }

    /**
     * Get file path for a conversation
     */
    private getConversationFilePath(conversationId: string): string {
        return path.join(this.conversationsDir, `${conversationId}.json`);
    }
}
