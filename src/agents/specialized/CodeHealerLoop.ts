import { exec } from 'child_process';
import * as util from 'util';
import { BaseAgent } from '../base/BaseAgent';
import { IAgentContext } from '../../types';

const execAsync = require('util').promisify(exec);

export class CodeHealerLoop {
  constructor(
    private developerAgent: BaseAgent,
    private logger: any
  ) {}

  /**
   * Runs the passed compilation/validation command.
   * If it fails, feeds the error trace back to the developer agent to attempt a fix.
   */
  public async executeWithHealing(
    context: IAgentContext, 
    command: string = 'npx tsc --noEmit', 
    maxRetries: number = 3
  ): Promise<boolean> {
    let attempts = 0;
    
    while (attempts < maxRetries) {
      this.logger.info(`[CodeHealer] Running validation: ${command} (Attempt ${attempts + 1}/${maxRetries})`);
      
      try {
        const { stdout, stderr } = await execAsync(command, { cwd: context.workspaceRoot });
        this.logger.info(`[CodeHealer] Validation passed!`);
        return true; 
      } catch (error: any) {
        attempts++;
        this.logger.warn(`[CodeHealer] Validation failed. Trace:\n${error.stdout}\n${error.stderr}`);
        
        if (attempts >= maxRetries) {
          this.logger.error(`[CodeHealer] Max retries reached. Validation still failing.`);
          return false;
        }

        // Prepare context for the Developer Agent to heal the code
        const healingContext = {
          ...context,
          metadata: {
            ...context.metadata,
            healingRequest: true,
            errorTrace: error.stdout || error.stderr || error.message
          }
        };

        this.logger.info(`[CodeHealer] Requesting DeveloperAgent to fix compilation errors...`);
        await this.developerAgent.execute(healingContext);
      }
    }

    return false;
  }
}
