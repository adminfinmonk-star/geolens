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
    expect(week.evidence.eligible_answers).toBeGreaterThan(0);
    expect(week.evidence.observed_presence).toBeCloseTo(week.brand!.visibility);
    expect(week.score.value).toEqual(expect.any(Number));
    expect(week.score.value).toBeGreaterThanOrEqual(0);
    expect(week.score.value).toBeLessThanOrEqual(100);
    expect(week.score.weights).toEqual({
      presence: 55,
      share_of_voice: 25,
      position: 10,
      citation_support: 10,
    });
    expect(week.score.range).toBeNull();
    expect(week.score.confidence).toBe("unvalidated");
    expect(["fixture", "mixed", "live"]).toContain(week.honesty.collection_mode);
    expect(week.honesty.note).toMatch(/not a multi-month industry index/i);
    expect(week.competitors[0]?.share_of_voice).toBeGreaterThanOrEqual(
      week.competitors[1]?.share_of_voice ?? 0,
    );
  }, 60_000);

  it("uses only active non-branded prompts for the headline score", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const own = store.brands.find((brand) => brand.is_own)!;
    const promptWithChats = store.prompts.find((prompt) =>
      store.chats.some((chat) => chat.prompt_id === prompt.id),
    )!;

    for (const prompt of store.prompts) prompt.status = "archived";
    promptWithChats.status = "active";
    promptWithChats.text = `${own.name} reviews`;
    promptWithChats.branding = "branded";

    const brandedOnly = overviewReportPayload(store, { range: "90d" });
    expect(brandedOnly.kpis.chats).toBeGreaterThan(0);
    expect(brandedOnly.score.value).toBeNull();
    expect(brandedOnly.prompt_cohort).toEqual(
      expect.objectContaining({
        active_prompts: 1,
        score_prompts: 0,
        branded_prompts_excluded: 1,
        score_answers: 0,
      }),
    );

    promptWithChats.text = "best software for small businesses";
    promptWithChats.branding = "non-branded";
    const discovery = overviewReportPayload(store, { range: "90d" });
    expect(discovery.score.value).toEqual(expect.any(Number));

    promptWithChats.status = "archived";
    const noActivePrompts = overviewReportPayload(store, { range: "90d" });
    expect(noActivePrompts.kpis.chats).toBe(0);
    expect(noActivePrompts.score.value).toBeNull();
  }, 60_000);

  it("reports zero when eligible discovery answers contain no own-brand evidence", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const own = store.brands.find((brand) => brand.is_own)!;
    const ownMentionChatIds = new Set(
      store.mentions
        .filter((mention) => mention.brand_id === own.id)
        .map((mention) => mention.chat_id),
    );
    const cleanChat = store.chats.find(
      (chat) =>
        (chat.status === "ok" || chat.status === "empty") &&
        !ownMentionChatIds.has(chat.id),
    )!;
    for (const prompt of store.prompts) prompt.status = "archived";
    const prompt = store.prompts.find((candidate) => candidate.id === cleanChat.prompt_id)!;
    prompt.status = "active";
    prompt.text = "best software for small businesses";
    prompt.branding = "non-branded";
    const cohortChatIds = new Set(
      store.chats
        .filter((chat) => chat.prompt_id === prompt.id)
        .map((chat) => chat.id),
    );
    store.mentions = store.mentions.filter(
      (mention) =>
        mention.brand_id !== own.id || !cohortChatIds.has(mention.chat_id),
    );

    const report = overviewReportPayload(store, { range: "90d" });
    expect(report.evidence.eligible_answers).toBeGreaterThan(0);
    expect(report.evidence.mentioned_answers).toBe(0);
    expect(report.score.value).toBe(0);
    expect(report.score.components.presence).toBe(0);
  }, 60_000);

  it("excludes active prompts outside the immutable analysis scope", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const scoped = store.prompts.find((prompt) =>
      store.chats.some((chat) => chat.prompt_id === prompt.id),
    )!;
    for (const prompt of store.prompts) prompt.status = "archived";
    scoped.status = "active";
    scoped.branding = "non-branded";
    store.prompts.push({
      ...scoped,
      id: "pr_unscoped",
      text: "unrelated search productivity platforms",
      country_code: "AU",
      status: "active",
    });
    store.analysisScope = {
      domain: store.project.domain!,
      brandIds: store.brands.map((brand) => brand.id),
      topicIds: [],
      promptIds: [scoped.id],
      startedAt: new Date().toISOString(),
    };

    const report = overviewReportPayload(store, { range: "90d" });
    expect(report.prompt_cohort.active_prompts).toBe(1);
    expect(report.prompt_cohort.score_prompts).toBe(1);
  }, 60_000);

  it("requires matching eligible sample counts across all observed days", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const original = store.chats.find((chat) => store.prompts.some((prompt) => prompt.id === chat.prompt_id && prompt.status === "active"))!;
    store.chats = [
      { ...original, id: "trend-a", status: "ok", run_date: "2026-09-15" },
      { ...original, id: "trend-b", status: "ok", run_date: "2026-09-16" },
    ];
    store.mentions = [];
    store.sources = [];
    expect(overviewReportPayload(store, { range: "90d" }).honesty.trend_comparable).toBe(true);
    store.chats.push({ ...store.chats[1]!, id: "trend-repeat" });
    expect(overviewReportPayload(store, { range: "90d" }).honesty.trend_comparable).toBe(false);
    store.chats.pop();
    store.chats[1]!.status = "error";
    store.chats[1]!.error_code = "HTTP_429";
    store.chats[1]!.raw_payload = { error: "quota exhausted private diagnostic" };
    const failed = overviewReportPayload(store, { range: "90d" });
    expect(failed.honesty.trend_comparable).toBe(false);
    expect(failed.series[1]!.visibility).toBeNull();
    expect(failed.collection_health[0]).toMatchObject({ status: "unavailable", failures: 1, eligible_answers: 0 });
    expect(failed.collection_health[0]!.action).toContain("quota");
    expect(JSON.stringify(failed.collection_health)).not.toContain("private diagnostic");
  });

  it("does not treat unrelated citations as owned-domain coverage", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    store.project.domain = "acme.example";
    store.sources = store.sources.map((source) => ({ ...source, url: "https://unrelated.example/review", cited: true }));
    const unrelated = overviewReportPayload(store, { range: "90d" });
    expect(unrelated.score.components.citation_support).toBe(0);
    expect(unrelated.score.range).toBeNull();
    expect(unrelated.score.confidence).toBe("unvalidated");
    const originalCohort = unrelated.prompt_cohort.id;
    const active = store.prompts.find((prompt) => prompt.status === "active")!;
    active.text += " revised";
    expect(overviewReportPayload(store, { range: "90d" }).prompt_cohort.id).not.toBe(originalCohort);
    store.sources = store.sources.map((source) => ({ ...source, url: "https://docs.acme.example/guide" }));
    expect(overviewReportPayload(store, { range: "90d" }).score.components.citation_support).toBeGreaterThan(0);
    store.sources = store.sources.map((source) => ({ ...source, url: "https://acme.example.attacker.test/" }));
    expect(overviewReportPayload(store, { range: "90d" }).score.components.citation_support).toBe(0);
  });

  it("shows recovered channel health while retaining earlier same-day failures", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const prompt = store.prompts.find((candidate) => candidate.status === "active")!;
    const original = store.chats.find((chat) => chat.prompt_id === prompt.id)!;
    for (const candidate of store.prompts) candidate.status = candidate.id === prompt.id ? "active" : "archived";
    store.chats = [
      { ...original, id: "health-failed", status: "error", error_code: "HTTP_402", collected_at: "2026-09-25T00:01:00.000Z", run_date: "2026-09-25" },
      { ...original, id: "health-recovered", status: "ok", error_code: undefined, collected_at: "2026-09-25T00:07:00.000Z", run_date: "2026-09-25" },
    ];
    store.mentions = [];
    store.sources = [];

    const report = overviewReportPayload(store, { range: "90d" });
    expect(report.evidence.failed_attempts).toBe(1);
    expect(report.collection_health[0]).toMatchObject({
      status: "healthy",
      attempts: 1,
      failures: 0,
      eligible_answers: 1,
    });
  });
});
