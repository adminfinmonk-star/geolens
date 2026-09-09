/**
 * Degraded-channel state (§6.5 / §21): never silently write empties.
 * When a channel is degraded, collectors should skip or mark chats `error`.
 */
export type ChannelHealthStatus = "ok" | "degraded" | "down";

export interface ChannelHealth {
  channelId: string;
  status: ChannelHealthStatus;
  reason?: string;
  since: string;
  failureRate?: number;
}

const health = new Map<string, ChannelHealth>();

export function getChannelHealth(channelId: string): ChannelHealth {
  return (
    health.get(channelId) ?? {
      channelId,
      status: "ok",
      since: new Date(0).toISOString(),
    }
  );
}

export function markChannelDegraded(
  channelId: string,
  reason: string,
  failureRate?: number,
) {
  health.set(channelId, {
    channelId,
    status: "degraded",
    reason,
    failureRate,
    since: new Date().toISOString(),
  });
}

export function markChannelDown(channelId: string, reason: string) {
  health.set(channelId, {
    channelId,
    status: "down",
    reason,
    since: new Date().toISOString(),
  });
}

export function clearChannelHealth(channelId: string) {
  health.set(channelId, {
    channelId,
    status: "ok",
    since: new Date().toISOString(),
  });
}

export function listChannelHealth(): ChannelHealth[] {
  return [...health.values()];
}

export function resetChannelHealth() {
  health.clear();
}

/**
 * Rolling failure tracker: mark degraded if failures ≥ threshold over window.
 */
export class FailureTracker {
  private events: { t: number; ok: boolean }[] = [];

  constructor(
    private readonly windowMs = 15 * 60_000,
    private readonly degradeAt = 0.02,
  ) {}

  record(ok: boolean) {
    const now = Date.now();
    this.events.push({ t: now, ok });
    this.events = this.events.filter((e) => now - e.t <= this.windowMs);
  }

  failureRate(): number {
    if (this.events.length === 0) return 0;
    const fails = this.events.filter((e) => !e.ok).length;
    return fails / this.events.length;
  }

  shouldDegrade(): boolean {
    return this.events.length >= 20 && this.failureRate() >= this.degradeAt;
  }
}
