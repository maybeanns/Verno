import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';

export class ActAgent extends BaseAgent {
  name = 'act';
  description = 'Act - Execute actions';

  constructor(protected logger: any, private llmService: LLMService) {
    super(logger);
  }

  async execute(context: IAgentContext): Promise<string> {
    this.log('Running Act Agent');
    const prompt = `Execute action for: ${context.metadata?.userRequest || 'project'}`;
    return await this.llmService.generateText(prompt);
  }
}
