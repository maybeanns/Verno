import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';

export class DecideAgent extends BaseAgent {
  name = 'decide';
  description = 'Decide - Make decisions';

  constructor(protected logger: any, private llmService: LLMService) {
    super(logger);
  }

  async execute(context: IAgentContext): Promise<string> {
    this.log('Running Decide Agent');
    const prompt = `Make a decision for: ${context.metadata?.userRequest || 'project'}`;
    return await this.llmService.generateText(prompt);
  }
}
