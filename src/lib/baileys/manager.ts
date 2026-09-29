import { BaileysAgent } from './agent';
import { loadConfig, getActiveAgents, AgentConfig } from './config';

class AgentManager {
  private agents: Map<string, BaileysAgent> = new Map();
  private currentIndex = 0;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const config = loadConfig();
    for (const agentConfig of config.agents) {
      const agent = new BaileysAgent(agentConfig);
      this.agents.set(agentConfig.id, agent);
    }
  }

  getAgent(id: string): BaileysAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): BaileysAgent[] {
    return Array.from(this.agents.values());
  }

  getActiveAgents(): BaileysAgent[] {
    return this.getAllAgents().filter((a) => a.isActive);
  }

  getNextAvailableAgent(): BaileysAgent | null {
    const activeAgents = this.getActiveAgents();
    if (activeAgents.length === 0) return null;

    // Round-robin
    const agent = activeAgents[this.currentIndex % activeAgents.length];
    this.currentIndex++;
    return agent;
  }

  async sendMessage(phone: string, message: string): Promise<{ success: boolean; agentId?: string; error?: string }> {
    const agent = this.getNextAvailableAgent();
    if (!agent) {
      return { success: false, error: 'No active agents available' };
    }

    const result = await agent.sendMessage(phone, message);
    return { ...result, agentId: agent.id };
  }

  getStatus() {
    return this.getAllAgents().map((a) => a.getStatusInfo());
  }
}

export const agentManager = new AgentManager();
