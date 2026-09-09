export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    maxAttempts?: number;
    isRetryable?: (err: unknown) => boolean;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const max = opts?.maxAttempts ?? 4;
  const sleep =
    opts?.sleep ??
    ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const isRetryable =
    opts?.isRetryable ??
    ((err: unknown) => {
      if (err && typeof err === "object" && "status" in err) {
        const s = (err as { status: number }).status;
        return s === 429 || s >= 500;
      }
      return false;
    });

  let last: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt === max || !isRetryable(err)) throw err;
      const base = Math.min(8_000, 250 * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 200);
      await sleep(base + jitter);
    }
  }
  throw last;
}

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}
