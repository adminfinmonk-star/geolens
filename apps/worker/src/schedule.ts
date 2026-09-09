import { DEFAULT_API_CHANNELS } from "@geo/adapters";
import { getChannel } from "@geo/registry";
import type { DemoStore } from "@geo/db";
import {
  buildCollectPayload,
  type CollectChannelResult,
  type CollectJobPayload,
} from "./collect.js";
import { enqueueCollectJob, type EnqueueResult } from "./queue.js";

export interface ScheduleCollectOptions {
  runDate?: string;
  channelIds?: string[];
  /** When true, process inline even if Redis is configured (tests). */
  forceInline?: boolean;
  seed?: string;
}

/**
 * §6.1 scheduler: for each active prompt × channel, enqueue collect_job
 * with job_key idempotency. Skips unsupported country pairs (no chat row).
 */
export async function scheduleProjectCollect(
  store: DemoStore,
  opts?: ScheduleCollectOptions,
): Promise<{
  run_date: string;
  mode: string;
  enqueued: EnqueueResult[];
  skipped: { prompt_id: string; channel_id: string; reason: string }[];
  payloads: CollectJobPayload[];
}> {
  const runDate =
    opts?.runDate ?? new Date().toISOString().slice(0, 10);
  const channelIds = opts?.channelIds ?? [...DEFAULT_API_CHANNELS];
  const brands = store.brands.map((b) => ({
    brandId: b.id,
    name: b.name,
    aliases: b.aliases,
    patterns: b.patterns,
  }));

  const active = store.prompts.filter((p) => p.status === "active");
  const enqueued: EnqueueResult[] = [];
  const skipped: { prompt_id: string; channel_id: string; reason: string }[] =
    [];
  const payloads: CollectJobPayload[] = [];

  const prevRedis = process.env.REDIS_URL;
  if (opts?.forceInline) {
    delete process.env.REDIS_URL;
  }

  try {
    for (const prompt of active) {
      for (const channelId of channelIds) {
        const meta = getChannel(channelId);
        if (
          meta?.unsupportedCountryCodes.includes(
            prompt.country_code.toUpperCase(),
          )
        ) {
          skipped.push({
            prompt_id: prompt.id,
            channel_id: channelId,
            reason: "UNSUPPORTED_COUNTRY",
          });
          continue;
        }

        const payload = buildCollectPayload({
          projectId: store.project.id,
          promptId: prompt.id,
          promptText: prompt.text,
          channelId,
          countryCode: prompt.country_code,
          runDate,
          brands,
          seed: opts?.seed,
        });
        payloads.push(payload);
        enqueued.push(await enqueueCollectJob(payload));
      }
    }
  } finally {
    if (opts?.forceInline) {
      if (prevRedis !== undefined) process.env.REDIS_URL = prevRedis;
      else delete process.env.REDIS_URL;
    }
  }

  return {
    run_date: runDate,
    mode: opts?.forceInline ? "inline" : enqueued[0]?.mode ?? "inline",
    enqueued,
    skipped,
    payloads,
  };
}

/** Apply a single channel collect result onto the DemoStore (skipped = no row). */
export function applyCollectResultToStore(
  store: DemoStore,
  payload: CollectJobPayload,
  result: CollectChannelResult,
): { chat_id: string | null } {
  if (result.status === "skipped") {
    return { chat_id: null };
  }

  // Idempotent: same job_key day already written?
  const existing = store.chats.find(
    (c) =>
      c.prompt_id === payload.prompt_id &&
      c.model_channel_id === payload.channel_id &&
      c.run_date === payload.run_date &&
      c.country_code === payload.country_code,
  );
  if (existing) {
    return { chat_id: existing.id };
  }

  const chatId = `cht_${payload.job_key.slice(0, 16)}`;
  store.chats.push({
    id: chatId,
    project_id: payload.project_id,
    prompt_id: payload.prompt_id,
    model_channel_id: payload.channel_id,
    country_code: payload.country_code,
    run_date: payload.run_date,
    status:
      result.status === "ok" ||
      result.status === "empty" ||
      result.status === "error" ||
      result.status === "blocked"
        ? result.status
        : "error",
    text: result.text,
    raw_uri: `memory://collect/${payload.job_key}`,
    surface_kind: result.surfaceKind,
  });

  for (const m of result.mentions) {
    store.mentions.push({
      chat_id: chatId,
      brand_id: m.brandId,
      mention_count: m.mentionCount,
      position: m.position,
      sentiment: m.sentiment,
    });
  }
  for (const s of result.sources) {
    store.sources.push({
      chat_id: chatId,
      url: s.url,
      domain: s.domain,
      cited: s.cited,
      citation_count: s.citationCount,
      retrieval_rank: s.retrievalRank,
    });
  }

  return { chat_id: chatId };
}

/**
 * Schedule + run inline (or enqueue), then apply completed results to store.
 * Used by API when Redis is absent or forceInline.
 */
export async function runProjectCollectAndApply(
  store: DemoStore,
  opts?: ScheduleCollectOptions,
): Promise<{
  run_date: string;
  mode: string;
  chats_written: number;
  jobs: EnqueueResult[];
  skipped: { prompt_id: string; channel_id: string; reason: string }[];
}> {
  const schedule = await scheduleProjectCollect(store, {
    ...opts,
    forceInline: opts?.forceInline ?? true,
  });

  let chats_written = 0;
  for (let i = 0; i < schedule.payloads.length; i++) {
    const payload = schedule.payloads[i]!;
    const job = schedule.enqueued[i]!;
    if (job.status === "completed" && job.result) {
      const { chat_id } = applyCollectResultToStore(
        store,
        payload,
        job.result,
      );
      if (chat_id) chats_written += 1;
    }
  }

  return {
    run_date: schedule.run_date,
    mode: schedule.mode,
    chats_written,
    jobs: schedule.enqueued,
    skipped: schedule.skipped,
  };
}
