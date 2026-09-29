export interface AgentConfig {
  id: string;
  name: string;
  phone: string;
  sessionPath: string;
  rateLimitPerMinute: number;
  dailyLimit: number;
  status: 'active' | 'inactive' | 'banned';
  region: string;
}

export interface BaileysConfig {
  agents: AgentConfig[];
}

export const defaultConfig: BaileysConfig = {
  agents: [
    {
      id: 'agent-1',
      name: 'Verification Agent 1',
      phone: '',
      sessionPath: './sessions/agent-1',
      rateLimitPerMinute: 5,
      dailyLimit: 100,
      status: 'inactive',
      region: 'jakarta',
    },
    {
      id: 'agent-2',
      name: 'Verification Agent 2',
      phone: '',
      sessionPath: './sessions/agent-2',
      rateLimitPerMinute: 5,
      dailyLimit: 100,
      status: 'inactive',
      region: 'surabaya',
    },
    {
      id: 'agent-3',
      name: 'Verification Agent 3',
      phone: '',
      sessionPath: './sessions/agent-3',
      rateLimitPerMinute: 5,
      dailyLimit: 100,
      status: 'inactive',
      region: 'bandung',
    },
    {
      id: 'agent-4',
      name: 'Verification Agent 4',
      phone: '',
      sessionPath: './sessions/agent-4',
      rateLimitPerMinute: 5,
      dailyLimit: 100,
      status: 'inactive',
      region: 'medan',
    },
    {
      id: 'agent-5',
      name: 'Verification Agent 5',
      phone: '',
      sessionPath: './sessions/agent-5',
      rateLimitPerMinute: 5,
      dailyLimit: 100,
      status: 'inactive',
      region: 'makassar',
    },
  ],
};

export function loadConfig(): BaileysConfig {
  try {
    const configPath = process.env.BAILEYS_CONFIG_PATH || './baileys-config.json';
    // In production, load from file or database
    return defaultConfig;
  } catch {
    return defaultConfig;
  }
}

export function getActiveAgents(): AgentConfig[] {
  return loadConfig().agents.filter((a) => a.status === 'active' && a.phone !== '');
}

export function getAgentById(id: string): AgentConfig | undefined {
  return loadConfig().agents.find((a) => a.id === id);
}
