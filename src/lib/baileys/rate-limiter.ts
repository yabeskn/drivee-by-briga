interface RateLimitEntry {
  timestamps: number[];
  dailyCount: number;
  lastReset: number;
}

export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxPerWindow: number;
  private readonly dailyLimit: number;

  constructor(maxPerMinute: number = 5, dailyLimit: number = 100) {
    this.windowMs = 60_000;
    this.maxPerWindow = maxPerMinute;
    this.dailyLimit = dailyLimit;
  }

  canSend(agentId: string): boolean {
    this.cleanup();
    const now = Date.now();
    const entry = this.entries.get(agentId) || { timestamps: [], dailyCount: 0, lastReset: now };

    // Reset daily count if new day
    if (now - entry.lastReset > 86_400_000) {
      entry.dailyCount = 0;
      entry.lastReset = now;
    }

    // Check daily limit
    if (entry.dailyCount >= this.dailyLimit) {
      return false;
    }

    // Check rate limit
    const recentTimestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
    if (recentTimestamps.length >= this.maxPerWindow) {
      return false;
    }

    return true;
  }

  record(agentId: string): void {
    const now = Date.now();
    const entry = this.entries.get(agentId) || { timestamps: [], dailyCount: 0, lastReset: now };
    entry.timestamps.push(now);
    entry.dailyCount++;
    this.entries.set(agentId, entry);
  }

  getStatus(agentId: string): { canSend: boolean; remaining: number; dailyRemaining: number } {
    const now = Date.now();
    const entry = this.entries.get(agentId) || { timestamps: [], dailyCount: 0, lastReset: now };
    const recentTimestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
    const remaining = Math.max(0, this.maxPerWindow - recentTimestamps.length);
    const dailyRemaining = Math.max(0, this.dailyLimit - entry.dailyCount);
    return { canSend: remaining > 0 && dailyRemaining > 0, remaining, dailyRemaining };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
      if (entry.timestamps.length === 0 && now - entry.lastReset > 86_400_000) {
        this.entries.delete(key);
      }
    }
  }
}
