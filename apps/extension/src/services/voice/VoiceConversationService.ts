/**
 * VoiceConversationService
 * 
 * Manages the voice conversation flow for Verno.
 * Defines the scripted question bank and generates structured summaries
 * from voice conversation transcripts.
 */

export interface VoiceConversationTurn {
    role: 'verno' | 'user';
    text: string;
    timestamp: number;
}

export interface VoiceConversationResult {
    summary: string;
    transcript: VoiceConversationTurn[];
    duration: number;
    questionsAsked: number;
    questionsAnswered: number;
}

export interface ConversationQuestion {
    id: string;
    question: string;
    followUp?: string;
    category: 'goal' | 'tech' | 'constraints' | 'details' | 'confirmation';
}

/**
 * The scripted conversational flow questions.
 * Verno uses these to guide a structured conversation with the user.
 */
export const CONVERSATION_FLOW: ConversationQuestion[] = [
    {
        id: 'greeting',
        question: "Hey there! I'm Verno, your AI coding assistant. Let's talk about what you'd like to build today. So, what's on your mind?",
        category: 'goal'
    },
    {
        id: 'clarify',
        question: "That sounds interesting! Can you tell me a bit more about the main features or functionality you're looking for?",
        followUp: "What's the most important thing this should do?",
        category: 'goal'
    },
    {
        id: 'tech_stack',
        question: "Great. Do you have any preferences for the tech stack? Things like programming language, framework, or database?",
        followUp: "Any particular tools or libraries you'd like to use?",
        category: 'tech'
    },
    {
        id: 'constraints',
        question: "Got it. Are there any constraints I should know about? Like specific patterns, existing code to integrate with, or things to avoid?",
        category: 'constraints'
    },
    {
        id: 'details',
        question: "Almost done! Any other specific details — like how the code should be structured, naming conventions, or particular edge cases to handle?",
        category: 'details'
    },
    {
        id: 'confirmation',
        question: "Perfect, I think I have a good picture now. Let me put together a summary and get started. Sound good?",
        category: 'confirmation'
    }
];

export class VoiceConversationService {
    private isActive: boolean = false;
    private transcript: VoiceConversationTurn[] = [];
    private startTime: number = 0;

    /**
     * Get the conversation flow questions
     */
    getQuestions(): ConversationQuestion[] {
        return CONVERSATION_FLOW;
    }

    /**
     * Start a new voice conversation session
     */
    startSession(): void {
        this.isActive = true;
        this.transcript = [];
        this.startTime = Date.now();
    }

    /**
     * End the current session and generate a summary
     */
    endSession(): VoiceConversationResult {
        this.isActive = false;
        const duration = Date.now() - this.startTime;

        const userTurns = this.transcript.filter(t => t.role === 'user');
        const vernoTurns = this.transcript.filter(t => t.role === 'verno');

        const summary = this.generateSummary(userTurns);

        return {
            summary,
            transcript: this.transcript,
            duration,
            questionsAsked: vernoTurns.length,
            questionsAnswered: userTurns.length
        };
    }

    /**
     * Add a turn to the transcript
     */
    addTurn(role: 'verno' | 'user', text: string): void {
        this.transcript.push({
            role,
            text,
            timestamp: Date.now()
        });
    }

    /**
     * Check if a session is active
     */
    isSessionActive(): boolean {
        return this.isActive;
    }

    /**
     * Generate a structured summary from user responses for the orchestrator
     */
    private generateSummary(userTurns: VoiceConversationTurn[]): string {
        if (userTurns.length === 0) {
            return 'No information gathered from voice conversation.';
        }

        const sections: string[] = [];

        // Map user responses to categories based on question order
        const questionFlow = CONVERSATION_FLOW;

        for (let i = 0; i < userTurns.length && i < questionFlow.length; i++) {
            const q = questionFlow[i];
            const response = userTurns[i].text.trim();

            if (!response || response.length < 3) { continue; }

            switch (q.category) {
                case 'goal':
                    sections.push(`**Project Goal:** ${response}`);
                    break;
                case 'tech':
                    sections.push(`**Tech Preferences:** ${response}`);
                    break;
                case 'constraints':
                    sections.push(`**Constraints:** ${response}`);
                    break;
                case 'details':
                    sections.push(`**Additional Details:** ${response}`);
                    break;
                case 'confirmation':
                    // Skip confirmation responses
                    break;
            }
        }

        if (sections.length === 0) {
            // Fallback: just combine all user responses
            return userTurns.map(t => t.text).join('. ');
        }

        return `Voice Conversation Summary:\n${sections.join('\n')}`;
    }
}
