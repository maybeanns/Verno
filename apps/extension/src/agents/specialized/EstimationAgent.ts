import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';
import { Epic, Story } from '../../types/sdlc';

export class EstimationAgent extends BaseAgent {
  name = 'estimator';
  description = 'Estimates complexity and effort of stories using Fibonacci sequence.';

  constructor(
    protected logger: any,
    private llmService: LLMService
  ) {
    super(logger);
  }

  /**
   * Evaluates stories and mutates their storyPoints field in place.
   */
  async execute(context: IAgentContext, epics?: Epic[]): Promise<string> {
    this.log('Running Estimation Agent');
    if (!epics || epics.length === 0) {
        return 'No epics to estimate.';
    }

    // In a real scenario, we'd chunk this if there are many stories.
    for (const epic of epics) {
        for (const story of epic.stories) {
            const prompt = `
You are an Agile Estimator. Estimate the software point complexity (Fibonacci: 1, 2, 3, 5, 8, 13) for this story:

Title: ${story.title}
Description: ${story.description || ''}

Respond with only a single integer.`;

            try {
                const response = await this.llmService.generateText(prompt);
                const points = parseInt(response.trim(), 10);
                if (!isNaN(points)) {
                    story.storyPoints = points;
                } else {
                    story.storyPoints = 3; // Fallback
                }
            } catch (err) {
                this.log(`Estimation failed for ${story.id}, falling back to 3.`, 'warn');
                story.storyPoints = 3;
            }
        }
    }
    
    return 'Estimation complete.';
  }
}
