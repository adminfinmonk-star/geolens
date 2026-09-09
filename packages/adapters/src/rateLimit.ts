/**
 * In-memory token bucket (§6.4). Swap for Redis-backed store in production.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillPerSec,
    );
    this.lastRefill = now;
  }

  /** Returns false if the request should wait / be deferred. */
  tryTake(cost = 1): boolean {
    this.refill();
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  /** Milliseconds until at least `cost` tokens are available. */
  waitMs(cost = 1): number {
    this.refill();
    if (this.tokens >= cost) return 0;
    const need = cost - this.tokens;
    return Math.ceil((need / this.refillPerSec) * 1000);
  }
}

const buckets = new Map<string, TokenBucket>();

/** Default: 60 rpm burst 10 — override per provider via opts. */
export function providerBucket(
  provider: string,
  opts?: { capacity?: number; refillPerSec?: number },
): TokenBucket {
  let b = buckets.get(provider);
  if (!b) {
    b = new TokenBucket(opts?.capacity ?? 10, opts?.refillPerSec ?? 1);
    buckets.set(provider, b);
  }
  return b;
}

export function resetRateLimiters() {
  buckets.clear();
}
