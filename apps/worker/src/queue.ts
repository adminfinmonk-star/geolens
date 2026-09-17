import type { CollectJobPayload } from "./collect.js";
import { processCollectJob } from "./collect.js";

export type CollectQueueMode = "inline" | "bullmq";

export interface EnqueueResult {
  job_key: string;
  mode: CollectQueueMode;
  status: "queued" | "completed" | "duplicate";
  result?: Awaited<ReturnType<typeof processCollectJob>>;
}

type JobHandler = (payload: CollectJobPayload) => Promise<unknown>;

let handler: JobHandler = async (p) => processCollectJob(p);
const completedKeys = new Set<string>();

/** Completed job keys in this process (inline idempotency). */
export function resetInlineJobState() {
  completedKeys.clear();
}

export function setCollectJobHandler(fn: JobHandler) {
  handler = fn;
}

export function redisUrl(): string | undefined {
  return process.env.REDIS_URL || undefined;
}

export function queueMode(): CollectQueueMode {
  return redisUrl() ? "bullmq" : "inline";
}

export async function checkQueueReadiness(): Promise<boolean> {
  const url = redisUrl();
  if (!url) return false;
  const { Queue } = await import("bullmq");
  const queue = new Queue("geo-collect", { connection: parseRedis(url) });
  try {
    await queue.getJobCounts("waiting", "active", "failed");
    return true;
  } catch {
    return false;
  } finally {
    await queue.close();
  }
}

/**
 * Enqueue a collect job. Without REDIS_URL, runs inline (CI/demo).
 * With Redis, uses BullMQ jobId = job_key for idempotency (§6.1).
 */
export async function enqueueCollectJob(
  payload: CollectJobPayload,
): Promise<EnqueueResult> {
  const mode = queueMode();
  if (mode === "inline") {
    if (completedKeys.has(payload.job_key)) {
      return { job_key: payload.job_key, mode, status: "duplicate" };
    }
    const result = (await handler(payload)) as Awaited<
      ReturnType<typeof processCollectJob>
    >;
    completedKeys.add(payload.job_key);
    return { job_key: payload.job_key, mode, status: "completed", result };
  }

  const { Queue } = await import("bullmq");
  const connection = parseRedis(redisUrl()!);
  const queue = new Queue("geo-collect", { connection });
  try {
    const existing = await queue.getJob(payload.job_key);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "active" || state === "waiting") {
        return { job_key: payload.job_key, mode, status: "duplicate" };
      }
    }
    await queue.add("collect", payload, {
      jobId: payload.job_key,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
    return { job_key: payload.job_key, mode, status: "queued" };
  } finally {
    await queue.close();
  }
}

export async function startCollectWorker(): Promise<{ close: () => Promise<void> }> {
  if (queueMode() === "inline") {
    return { close: async () => undefined };
  }
  const { Worker } = await import("bullmq");
  const connection = parseRedis(redisUrl()!);
  const worker = new Worker(
    "geo-collect",
    async (job) => {
      const payload = job.data as CollectJobPayload;
      return handler(payload);
    },
    { connection, concurrency: 4 },
  );
  return {
    close: async () => {
      await worker.close();
    },
  };
}

function parseRedis(url: string): { host: string; port: number; maxRetriesPerRequest: null } {
  const u = new URL(url);
  return {
    host: u.hostname || "127.0.0.1",
    port: Number(u.port || 6379),
    maxRetriesPerRequest: null,
  };
}
