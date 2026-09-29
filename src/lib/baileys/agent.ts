import { AgentConfig } from './config';
import { RateLimiter } from './rate-limiter';

export type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'banned';

export class BaileysAgent {
  readonly config: AgentConfig;
  private status: AgentStatus = 'disconnected';
  private rateLimiter: RateLimiter;
  private lastActivity: Date | null = null;
  private messageCount = 0;

  constructor(config: AgentConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimitPerMinute, config.dailyLimit);
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get phone(): string {
    return this.config.phone;
  }

  get currentStatus(): AgentStatus {
    return this.status;
  }

  get isActive(): boolean {
    return this.config.status === 'active' && this.status === 'connected';
  }

  get rateLimitStatus() {
    return this.rateLimiter.getStatus(this.config.id);
  }

  canSend(): boolean {
    return this.isActive && this.rateLimiter.canSend(this.config.id);
  }

  async connect(): Promise<void> {
    if (this.status === 'connected') return;
    this.status = 'connecting';
    // TODO: Implement Baileys connection
    // const makeWASocket = (await import('baileys')).default;
    // this.socket = makeWASocket({...});
    this.status = 'connected';
    this.lastActivity = new Date();
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    // TODO: Implement Baileys disconnection
  }

  async sendMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    if (!this.canSend()) {
      return { success: false, error: 'Rate limit exceeded or agent not active' };
    }

    try {
      // TODO: Implement Baileys send message
      // await this.socket.sendMessage(phone, { text: message });
      this.rateLimiter.record(this.config.id);
      this.messageCount++;
      this.lastActivity = new Date();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  getStatusInfo() {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      status: this.currentStatus,
      isActive: this.isActive,
      messageCount: this.messageCount,
      lastActivity: this.lastActivity,
      rateLimit: this.rateLimitStatus,
      region: this.config.region,
    };
  }
}
