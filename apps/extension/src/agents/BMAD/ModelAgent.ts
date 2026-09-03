import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';

export class ModelAgent extends BaseAgent {
  name = 'model';
  description = 'Model - Create models and designs';

  constructor(protected logger: any, private llmService: LLMService) {
    super(logger);
  }

  async execute(context: IAgentContext): Promise<string> {
    this.log('Running Model Agent');
    const prompt = `Create a model for: ${context.metadata?.userRequest || 'project'}`;
    return await this.llmService.generateText(prompt);
  }
}
