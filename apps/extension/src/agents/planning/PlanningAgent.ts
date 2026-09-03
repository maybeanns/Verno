/**
 * Planning Agent: Dedicated agent for structured project planning
 * Uses LangChain for conversation-based iterative planning
 */

import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LangChainService } from '../../services/llm/LangChainService';
import { PlanningService } from '../../services/planning/PlanningService';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Planning Agent for generating detailed project plans
 */
export class PlanningAgent extends BaseAgent {
    name = 'PlanningAgent';
    description = 'Generates structured project plans with requirements, architecture, and milestones';

    private langChainService: LangChainService | null = null;
    private planningService: PlanningService | null = null;
    private apiKey?: string; // API key field for initialization

    constructor(
        logger: any,
        private llmService?: any // Accept LLMService for compatibility
    ) {
        super(logger);
    }

    /**
     * Initialize the planning agent with LangChain
     */
    async initialize(
        apiKey: string,
        providerType: 'openai' | 'anthropic' | 'gemini' | 'groq' = 'gemini'
    ): Promise<void> {
        this.apiKey = apiKey;
        this.langChainService = new LangChainService();
        await this.langChainService.initializeProvider(providerType, apiKey);
        this.log('Planning agent initialized with LangChain');
    }

    /**
     * Execute planning agent to generate project plan
     */
    async execute(context: IAgentContext): Promise<string> {
        if (!this.validateContext(context)) {
            throw new Error('Invalid context for PlanningAgent');
        }

        this.log('Starting planning phase');

        // Initialize PlanningService
        if (!this.planningService) {
            this.planningService = new PlanningService(context.workspaceRoot);
        }

        const userRequest: string = String(context.metadata?.userRequest || '');
        const planningConversation: string = String(context.metadata?.planningConversation || '');

        // Generate structured plan
        const plan = await this.generatePlan(userRequest, planningConversation);

        // Save plan to workspace
        if (context.workspaceRoot) {
            await this.savePlanToFile(context.workspaceRoot, plan);
        }

        this.log('Planning phase completed');
        return plan;
    }

    /**
     * Generate structured project plan using LLM (LangChain or direct llmService)
     */
    async generatePlan(userRequest: string, conversationHistory?: string): Promise<string> {
        const planningPrompt = this.buildPlanningPrompt(userRequest, conversationHistory || '');

        // Use LangChain if initialized, otherwise fall back to llmService
        if (this.langChainService) {
            const sessionId = this.langChainService.createSession();
            return await this.langChainService.chat(planningPrompt, sessionId);
        } else if (this.llmService && typeof this.llmService.generateText === 'function') {
            // Direct fallback to llmService
            this.log('Using llmService directly (LangChain not initialized)');
            return await this.llmService.generateText(planningPrompt);
        } else {
            throw new Error('No LLM service available. Ensure the extension is configured with an API key.');
        }
    }

    /**
     * Stream plan generation with real-time updates
     */
    async streamPlan(
        userRequest: string,
        conversationHistory: string = '',
        onToken: (token: string) => void
    ): Promise<void> {
        if (!this.langChainService) {
            throw new Error('Planning agent not initialized. Call initialize() first.');
        }

        const sessionId = this.langChainService.createSession();
        const planningPrompt = this.buildPlanningPrompt(userRequest, conversationHistory);

        await this.langChainService.streamChat(planningPrompt, sessionId, onToken);
    }

    /**
     * Continue planning conversation interactively
     */
    async continueConversation(
        sessionId: string,
        userMessage: string
    ): Promise<string> {
        if (!this.langChainService) {
            throw new Error('Planning agent not initialized');
        }

        return await this.langChainService.chat(userMessage, sessionId);
    }

    /**
     * Build planning prompt with structured requirements
     */
    private buildPlanningPrompt(userRequest: string, conversationHistory: string): string {
        return `You are an expert software planning and architecture consultant. Your goal is to create a comprehensive, actionable project plan based on the user's requirements.

Generate a detailed project plan that includes:

1. **Project Overview**
   - High-level summary of the project
   - Primary objectives and goals
   - Target users/audience

2. **Requirements Analysis**
   - Functional requirements (what the system should do)
   - Non-functional requirements (performance, security, scalability, etc.)
   - Constraints and assumptions

3. **Architecture Decisions**
   - Technology stack recommendations with justification
   - System architecture (monolithic, microservices, serverless, etc.)
   - Database design approach
   - Key architectural patterns to use

4. **Implementation Milestones**
   - Phase 1: Foundation/MVP features
   - Phase 2: Core functionality
   - Phase 3: Advanced features
   - Phase 4: Optimization and polish
   - Each phase should have clear deliverables and estimated timeline

5. **Dependencies and Risks**
   - External dependencies (APIs, services, libraries)
   - Technical risks and mitigation strategies
   - Potential blockers and how to address them

6. **Development Workflow**
   - Recommended development practices
   - Testing strategy
   - Deployment approach

User Request:
${userRequest}

${conversationHistory ? `\nPrevious Planning Conversation:\n${conversationHistory}` : ''}

Provide a comprehensive plan in markdown format with clear sections and actionable details.`;
    }

    /**
     * Save plan to workspace file
     */
    private async savePlanToFile(workspaceRoot: string, plan: string): Promise<void> {
        try {
            const planningDir = path.join(workspaceRoot, '.verno');
            if (!fs.existsSync(planningDir)) {
                fs.mkdirSync(planningDir, { recursive: true });
            }

            const planPath = path.join(planningDir, 'PROJECT_PLAN.md');
            fs.writeFileSync(planPath, plan, 'utf-8');
            this.log(`Plan saved to ${planPath}`);
        } catch (err) {
            this.log(`Failed to save plan: ${err}`, 'error');
        }
    }
}
