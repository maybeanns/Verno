import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';
import { LLMService } from '../../services/llm';

export class BrainstormAgent extends BaseAgent {
  name = 'brainstorm';
  description = 'Brainstorm - Initial idea generation';

  constructor(protected logger: any, private llmService: LLMService) {
    super(logger);
  }

  async execute(context: IAgentContext): Promise<string> {
    this.log('Running Brainstorm Agent');
    const prompt = `Generate initial ideas for: ${context.metadata?.userRequest || 'project'}`;
    return await this.llmService.generateText(prompt);
  }
}
