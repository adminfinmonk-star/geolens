import {
  createDb,
  closeDb,
  loadProjectStore,
  persistCollectionEvidence,
} from "@geo/db";
import { queueMode, redisUrl, resetInlineJobState, parseRedis } from "./queue.js";
import { runProjectCollectAndApply, type CollectionSnapshot } from "./schedule.js";

export interface AnalyzeQueuePayload {
  job_id: string;
  project_id: string;
  domain: string;
  brand_name: string;
  prompts_activated: number;
  channel_ids: string[];
  run_date: string;
  seed: string;
  concurrency?: number;
  started_at: string;
  snapshot?: CollectionSnapshot;
}

export interface AnalyzeQueueResult {
  eligible_answers?: number;
  failed_attempts?: number;
  chats_written: number;
  run_date: string;
  mode: string;
  channels: string[];
  finished_at: string;
}

function redisConnection(): {
  host: string;
  port: number;
  password?: string;
  username?: string;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
} {
  const raw = redisUrl();
  if (!raw) throw new Error("REDIS_URL is required for durable analysis jobs");
  return parseRedis(raw);
}

export async function enqueueAnalyzeProject(
  payload: AnalyzeQueuePayload,
): Promise<{ status: "queued" | "duplicate" }> {
  if (queueMode() !== "bullmq") {
    throw new Error("Durable analysis queue requires REDIS_URL");
  }
  const { Queue } = await import("bullmq");
  const queue = new Queue<AnalyzeQueuePayload>("geo-analyze", {
    connection: redisConnection(),
  });
  try {
    const existing = await queue.getJob(payload.job_id);
    if (existing) return { status: "duplicate" };
    await queue.add("analyze", payload, {
      jobId: payload.job_id,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    });
    return { status: "queued" };
  } finally {
    await queue.close();
  }
}

export async function getAnalyzeProjectJob(jobId: string): Promise<{
  found: boolean;
  status?: "queued" | "running" | "done" | "error";
  payload?: AnalyzeQueuePayload;
  result?: AnalyzeQueueResult;
  message?: string;
}> {
  if (queueMode() !== "bullmq") return { found: false };
  const { Queue } = await import("bullmq");
  const queue = new Queue<AnalyzeQueuePayload, AnalyzeQueueResult>("geo-analyze", {
    connection: redisConnection(),
  });
  try {
    const job = await queue.getJob(jobId);
    if (!job) return { found: false };
    const state = await job.getState();
    const status =
      state === "completed"
        ? job.returnvalue?.eligible_answers === 0 ? "error" : "done"
        : state === "failed"
          ? "error"
          : state === "active"
            ? "running"
            : "queued";
    return {
      found: true,
      status,
      payload: job.data,
      result: state === "completed" ? job.returnvalue : undefined,
      message: state === "failed" ? job.failedReason : state === "completed" && job.returnvalue?.eligible_answers === 0
        ? "No eligible answers were collected. Review channel errors, restore provider access, and run a new analysis."
        : undefined,
    };
  } finally {
    await queue.close();
  }
}

async function processAnalyzeJob(
  payload: AnalyzeQueuePayload,
): Promise<AnalyzeQueueResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for durable analysis jobs");
  }
  const db = createDb(databaseUrl);
  try {
  const store = await loadProjectStore(db, payload.project_id);
  if (!store) throw new Error("project_not_found");

  // A BullMQ retry must be able to repeat an attempt that failed before its
  // database commit. The durable parent job remains the idempotency boundary.
  resetInlineJobState();
  const collect = await runProjectCollectAndApply(store, {
    forceInline: true,
    channelIds: payload.channel_ids,
    concurrency: payload.concurrency ?? 2,
    seed: payload.seed,
    runDate: payload.run_date,
    observationId: payload.job_id,
    snapshot: payload.snapshot,
  });
  await persistCollectionEvidence(db, store);
  return {
    chats_written: collect.chats_written,
    eligible_answers: collect.eligible_answers,
    failed_attempts: collect.failed_attempts,
    run_date: collect.run_date,
    mode: "bullmq",
    channels: payload.channel_ids,
    finished_at: new Date().toISOString(),
  };
  } finally { await closeDb(db); }
}

export async function startAnalyzeWorker(): Promise<{
  close: () => Promise<void>;
}> {
  if (queueMode() !== "bullmq") return { close: async () => undefined };
  const { Worker } = await import("bullmq");
  const worker = new Worker<AnalyzeQueuePayload, AnalyzeQueueResult>(
    "geo-analyze",
    async (job) => processAnalyzeJob(job.data),
    { connection: redisConnection(), concurrency: 1 },
  );
  return { close: async () => worker.close() };
}
