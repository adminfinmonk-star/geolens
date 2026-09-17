import { CHANNEL_PROVIDER_ROUTE } from "@geo/adapters";
import { getDemoStore, resetDemoStore } from "@geo/db";
import { describe, expect, it } from "vitest";
import {
  collectJobKey,
  projectCollectionIsDue,
  resetInlineJobState,
  runCollectEnrichJob,
  runProjectCollectAndApply,
  scheduleProjectCollect,
} from "./index.js";

describe("runCollectEnrichJob", () => {
  it("collects across ≥3 API providers with surface_kind=api", async () => {
    process.env.GEO_ADAPTER_MODE = "fixture";
    const result = await runCollectEnrichJob({
      prompt: "best CRM for a 20-person agency",
      countryCode: "US",
      runDate: "2026-03-01",
      seed: "worker-test",
      brands: [
        { brandId: "br_acme", name: "Acme", aliases: [], patterns: [] },
        {
          brandId: "br_beta",
          name: "BetaSoft",
          aliases: [],
          patterns: [],
        },
      ],
    });
    expect(result.results.length).toBeGreaterThanOrEqual(3);
    const okish = result.results.filter((r) => r.status === "ok");
    expect(okish.length).toBeGreaterThan(0);
    for (const r of okish) {
      expect(r.surfaceKind).toBe("api");
      expect(r.text.length).toBeGreaterThan(0);
    }
    const providers = new Set(
      result.results.map((r) => CHANNEL_PROVIDER_ROUTE[r.channelId]?.provider),
    );
    providers.delete(undefined);
    expect(providers.size).toBeGreaterThanOrEqual(3);
  });
});

describe("job_key + schedule", () => {
  it("honors daily and weekly project collection frequency", () => {
    expect(
      projectCollectionIsDue({
        frequency: "daily",
        runDate: "2026-09-17",
        latestRunDate: "2026-09-16",
      }),
    ).toBe(true);
    expect(
      projectCollectionIsDue({
        frequency: "weekly",
        runDate: "2026-09-17",
        latestRunDate: "2026-09-11",
      }),
    ).toBe(false);
    expect(
      projectCollectionIsDue({
        frequency: "weekly",
        runDate: "2026-09-17",
        latestRunDate: "2026-09-10",
      }),
    ).toBe(true);
  });

  it("job_key is stable sha256 of identity fields", () => {
    const a = collectJobKey({
      projectId: "prj_1",
      promptId: "pr_1",
      channelId: "openai-1",
      countryCode: "us",
      runDate: "2026-09-01",
    });
    const b = collectJobKey({
      projectId: "prj_1",
      promptId: "pr_1",
      channelId: "openai-1",
      countryCode: "US",
      runDate: "2026-09-01",
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("schedules idempotent inline collect and writes chats", async () => {
    process.env.GEO_ADAPTER_MODE = "fixture";
    delete process.env.REDIS_URL;
    resetInlineJobState();
    resetDemoStore();
    const store = await getDemoStore();
    const before = store.chats.length;

    const first = await runProjectCollectAndApply(store, {
      runDate: "2026-09-05",
      forceInline: true,
      seed: "sched-1",
      channelIds: ["openai-1", "perplexity-1", "anthropic-1"],
    });
    expect(first.chats_written).toBeGreaterThan(0);
    expect(store.chats.length).toBeGreaterThan(before);

    const second = await scheduleProjectCollect(store, {
      runDate: "2026-09-05",
      forceInline: true,
      seed: "sched-1",
      channelIds: ["openai-1"],
    });
    expect(second.enqueued.every((j) => j.status === "duplicate")).toBe(true);
  }, 60_000);
});
