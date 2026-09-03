/**
 * Agent registry for managing available agents
 */

import { IAgent } from '../../types';

export class AgentRegistry {
  private agents: Map<string, IAgent> = new Map();

  register(name: string, agent: IAgent): void {
    this.agents.set(name, agent);
  }

  unregister(name: string): boolean {
    return this.agents.delete(name);
  }

  get(name: string): IAgent | undefined {
    return this.agents.get(name);
  }

  getAll(): Map<string, IAgent> {
    return new Map(this.agents);
  }

  exists(name: string): boolean {
    return this.agents.has(name);
  }

  list(): string[] {
    return Array.from(this.agents.keys());
  }
}
