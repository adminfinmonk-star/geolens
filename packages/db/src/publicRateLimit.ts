/** Sliding-window rate limit — 200 req/min per project (§13.3). In-memory; Redis later. */

const WINDOW_MS = 60_000;
const LIMIT = 200;
const hits = new Map<string, number[]>();

export function resetRateLimitWindows() {
  hits.clear();
}

export function checkProjectRateLimit(projectId: string): {
  ok: boolean;
  limit: number;
  remaining: number;
  reset_seconds: number;
} {
  const now = Date.now();
  const arr = (hits.get(projectId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) {
    hits.set(projectId, arr);
    const oldest = arr[0] ?? now;
    return {
      ok: false,
      limit: LIMIT,
      remaining: 0,
      reset_seconds: Math.ceil((WINDOW_MS - (now - oldest)) / 1000),
    };
  }
  arr.push(now);
  hits.set(projectId, arr);
  return {
    ok: true,
    limit: LIMIT,
    remaining: LIMIT - arr.length,
    reset_seconds: Math.ceil(WINDOW_MS / 1000),
  };
}
