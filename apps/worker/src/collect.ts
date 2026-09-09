import {
  DEFAULT_API_CHANNELS,
  getAdapter,
  getChannelHealth,
} from "@geo/adapters";
import { getChannel } from "@geo/registry";
import { enrichChat, type BrandMatcher } from "@geo/core";
import { collectJobKey } from "./jobKey.js";

export interface CollectJobPayload {
  job_key: string;
  project_id: string;
  prompt_id: string;
  prompt_text: string;
  channel_id: string;
  country_code: string;
  run_date: string;
  seed?: string;
  brands: BrandMatcher[];
}

export interface CollectChannelResult {
  channelId: string;
  status: "ok" | "empty" | "error" | "blocked" | "skipped";
  errorCode?: string;
  text: string;
  mentions: {
    brandId: string;
    mentionCount: number;
    position: number;
    sentiment: number;
  }[];
  sources: {
    url: string;
    domain: string;
    cited: boolean;
    citationCount: number;
    retrievalRank: number;
  }[];
  surfaceKind: "ui" | "api" | "simulator";
  degraded?: boolean;
  geoCapability?: string;
}

/**
 * Multi-channel collect → enrich. Skips unsupported countries; refuses to
 * write silent empties when a channel is down (records status=error).
 */
export async function runCollectEnrichJob(input: {
  prompt: string;
  countryCode: string;
  runDate: string;
  brands: BrandMatcher[];
  seed?: string;
  channelIds?: string[];
}): Promise<{ results: CollectChannelResult[] }> {
  const channelIds = input.channelIds ?? [...DEFAULT_API_CHANNELS];
  const results: CollectChannelResult[] = [];

  for (const channelId of channelIds) {
    const meta = getChannel(channelId);
    if (!meta) {
      results.push({
        channelId,
        status: "error",
        errorCode: "UNKNOWN_CHANNEL",
        mentions: [],
        sources: [],
        text: "",
        surfaceKind: "api",
      });
      continue;
    }
    if (meta.unsupportedCountryCodes.includes(input.countryCode.toUpperCase())) {
      results.push({
        channelId,
        status: "skipped",
        errorCode: "UNSUPPORTED_COUNTRY",
        mentions: [],
        sources: [],
        text: "",
        surfaceKind: meta.surface,
      });
      continue;
    }

    const health = getChannelHealth(channelId);
    const adapter = getAdapter(channelId);
    const raw = await adapter.run({
      prompt: input.prompt,
      countryCode: input.countryCode,
      channelId,
      modelId: meta.currentModel,
      runDate: input.runDate,
      seed: input.seed ?? "worker",
    });

    if (raw.status !== "ok") {
      results.push({
        channelId,
        status: raw.status,
        errorCode: raw.errorCode,
        mentions: [],
        sources: [],
        text: raw.text,
        surfaceKind: raw.meta.surfaceKind,
        degraded: health.status !== "ok",
      });
      continue;
    }

    const enriched = enrichChat({
      text: raw.text,
      brands: input.brands,
      sources: raw.sources,
    });

    const byBrand = new Map<
      string,
      { count: number; position: number; sentimentSum: number }
    >();
    for (const m of enriched.mentions) {
      const cur = byBrand.get(m.brandId) ?? {
        count: 0,
        position: m.position,
        sentimentSum: 0,
      };
      cur.count += 1;
      cur.sentimentSum += m.sentiment;
      byBrand.set(m.brandId, cur);
    }

    results.push({
      channelId,
      status: raw.status,
      text: raw.text,
      mentions: [...byBrand.entries()].map(([brandId, v]) => ({
        brandId,
        mentionCount: v.count,
        position: v.position,
        sentiment: v.sentimentSum / v.count,
      })),
      sources: enriched.sources.map((s) => ({
        url: s.url,
        domain: s.domain,
        cited: s.cited,
        citationCount: s.citationCount,
        retrievalRank: s.retrievalRank,
      })),
      surfaceKind: raw.meta.surfaceKind,
      geoCapability: meta.geoCapability,
      degraded: health.status !== "ok",
    });
  }

  return { results };
}

export async function processCollectJob(
  payload: CollectJobPayload,
): Promise<CollectChannelResult> {
  const { results } = await runCollectEnrichJob({
    prompt: payload.prompt_text,
    countryCode: payload.country_code,
    runDate: payload.run_date,
    brands: payload.brands,
    seed: payload.seed ?? payload.job_key.slice(0, 16),
    channelIds: [payload.channel_id],
  });
  return (
    results[0] ?? {
      channelId: payload.channel_id,
      status: "error",
      errorCode: "NO_RESULT",
      text: "",
      mentions: [],
      sources: [],
      surfaceKind: "api",
    }
  );
}

export function buildCollectPayload(input: {
  projectId: string;
  promptId: string;
  promptText: string;
  channelId: string;
  countryCode: string;
  runDate: string;
  brands: BrandMatcher[];
  seed?: string;
}): CollectJobPayload {
  return {
    job_key: collectJobKey({
      projectId: input.projectId,
      promptId: input.promptId,
      channelId: input.channelId,
      countryCode: input.countryCode,
      runDate: input.runDate,
    }),
    project_id: input.projectId,
    prompt_id: input.promptId,
    prompt_text: input.promptText,
    channel_id: input.channelId,
    country_code: input.countryCode,
    run_date: input.runDate,
    seed: input.seed,
    brands: input.brands,
  };
}
