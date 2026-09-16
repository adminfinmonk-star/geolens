import { describe, expect, it } from "vitest";
import {
  brandsReportPayload,
  createApiKey,
  getDemoStore,
  overviewReportPayload,
  parseOverviewFilters,
  resetApiKeyStore,
  resetDemoStore,
  verifyApiKey,
} from "./index.js";

describe("Phase 10 reports + api keys", () => {
  it("create/verify api key in memory", async () => {
    resetApiKeyStore();
    const { plaintext, record } = await createApiKey(null, {
      organizationId: "org_demo",
      projectId: "prj_demo",
      name: "ci",
    });
    expect(plaintext.startsWith("geo_")).toBe(true);
    expect(record.key_prefix.length).toBeGreaterThan(4);
    const ok = await verifyApiKey(null, plaintext);
    expect(ok?.project_id).toBe("prj_demo");
    expect(await verifyApiKey(null, "geo_bad")).toBeNull();
  });

  it("brandsReportPayload is stable for demo store", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const a = brandsReportPayload(store);
    const b = brandsReportPayload(store);
    expect(a.rows.map((r) => r.visibility)).toEqual(
      b.rows.map((r) => r.visibility),
    );
    expect(a.rows.some((r) => r.is_own)).toBe(true);
  }, 60_000);

  it("parseOverviewFilters defaults invalid range and all channel", () => {
    expect(parseOverviewFilters({ range: "nope", channel: "all" })).toEqual({
      range: "7d",
      channel: null,
    });
    expect(parseOverviewFilters({ range: "30d", channel: "openai" })).toEqual({
      range: "30d",
      channel: "openai",
    });
  });

  it("overviewReportPayload slices by range and channel", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const all90 = overviewReportPayload(store, { range: "90d" });
    const week = overviewReportPayload(store, { range: "7d" });
    expect(week.filters.range).toBe("7d");
    expect(week.kpis.chats).toBeGreaterThan(0);
    expect(week.kpis.chats).toBeLessThan(all90.kpis.chats);
    expect(week.series.length).toBeLessThanOrEqual(7);

    const channelId = store.chats[0]!.model_channel_id;
    const one = overviewReportPayload(store, {
      range: "90d",
      channel: channelId,
    });
    expect(one.filters.channel).toBe(channelId);
    expect(one.channels.every((c) => c.channel_id === channelId)).toBe(true);
    expect(one.kpis.chats).toBeLessThanOrEqual(all90.kpis.chats);
    expect(one.kpis.chats).toBeGreaterThan(0);
    expect(week.series[0]).toEqual(
      expect.objectContaining({
        mentions: expect.any(Number),
        citations: expect.any(Number),
        cited_pages: expect.any(Number),
      }),
    );
    expect(week.series.some((d) => (d.citations ?? 0) > 0)).toBe(true);
    expect(week.score.sample_thin).toBe(false);
    expect(week.score.presence).toBeCloseTo(week.brand!.visibility);
    expect(["fixture", "mixed", "live"]).toContain(week.honesty.collection_mode);
    expect(week.honesty.note).toMatch(/not a multi-month industry index/i);
    expect(week.competitors[0]?.share_of_voice).toBeGreaterThanOrEqual(
      week.competitors[1]?.share_of_voice ?? 0,
    );
  }, 60_000);
});
