import { describe, expect, it } from "vitest";
import {
  bootstrapProjectFeatures,
  buildDemoStore,
  createDb,
  loadProjectStore,
  marketPerceptionReport,
  referralsOverview,
  resetProjectStoreCache,
  runMigrations,
  shoppingSummary,
  signup,
} from "./index.js";
import type { DemoStore } from "./seed.js";

const pgUrl =
  process.env.DATABASE_URL ?? "postgres://geo:geo@localhost:5432/geo";

describe("gap closure: postgres bootstrap + extension", () => {
  it("signup project reports honest empty state, not demo fixtures", async () => {
    let db: ReturnType<typeof createDb> | undefined;
    try {
      await runMigrations(pgUrl);
      db = createDb(pgUrl);
    } catch {
      return; // skip if no postgres
    }

    const email = `gap_${Date.now()}@example.com`;
    const result = await signup(db, {
      email,
      password: "password123",
      name: "Gap User",
      orgName: "Gap Org",
      projectName: "Acme Analytics",
    });

    resetProjectStoreCache(result.project.id);
    const store = await loadProjectStore(db, result.project.id);
    expect(store).not.toBeNull();

    // The tracked brand is real; nothing else may be invented.
    expect(store!.brands.some((b) => b.is_own)).toBe(true);
    expect(store!.chats).toHaveLength(0);
    expect(store!.brands.some((b) => !b.is_own)).toBe(false);
    expect(store!.products).toHaveLength(0);
    expect(store!.facts).toHaveLength(0);
    expect(store!.agentLogs).toHaveLength(0);
    expect(store!.gaReferrals).toHaveLength(0);

    const market = marketPerceptionReport(store!);
    expect(market.data_state).toBe("empty");
    expect(market.empty_reason).toBeTruthy();
    expect(market.attributes).toHaveLength(0);

    const shop = shoppingSummary(store!);
    expect(shop.data_state).toBe("empty");
    expect(shop.empty_reason).toBeTruthy();
    expect(shop.price_drift).toHaveLength(0);

    const refs = referralsOverview(store!);
    expect(refs.data_state).toBe("empty");
    expect(refs.kpis.revenue).toBe(0);

    // Reload from DB (clear cache) — still empty, still no fabrication.
    resetProjectStoreCache(result.project.id);
    const again = await loadProjectStore(db, result.project.id);
    expect(again!.chats).toHaveLength(0);
    expect(again!.products).toHaveLength(0);
  }, 60_000);

  it("demo fixtures still populate when explicitly enabled", async () => {
    process.env.GEO_DEMO_FIXTURES = "on";
    try {
      const store = await buildDemoStore({ days: 7 });
      const market = marketPerceptionReport(store);
      expect(market.data_state).toBe("demo_fixture");
      expect(market.summary.biggest_gap?.statement).toMatch(/#1 → #9/);
      expect(shoppingSummary(store).price_drift.length).toBeGreaterThan(0);
    } finally {
      delete process.env.GEO_DEMO_FIXTURES;
    }
  }, 60_000);

  it("bootstrap is idempotent on an empty in-memory shell", () => {
    const store = {
      organization: {
        id: "org_x",
        name: "X",
        timezone: "UTC",
        plan_code: "trial",
        billing_period: "monthly" as const,
        is_agency: false,
        created_at: new Date().toISOString(),
      },
      user: {
        id: "usr_x",
        email: "x@x.com",
        created_at: new Date().toISOString(),
      },
      project: {
        id: "prj_x",
        organization_id: "org_x",
        name: "Acme Project",
        default_country: "US",
        language: "en",
        timezone: "UTC",
        status: "ONBOARDING",
        frequency: "daily" as const,
        created_at: new Date().toISOString(),
      },
      brands: [],
      prompts: [],
      chats: [],
      mentions: [],
      sources: [],
      fanouts: [],
      ads: [],
      topics: [],
      tags: [],
      brandProfile: {
        name: "Acme",
        industry: "CRM",
        tagline: "",
        products: [],
        personas: [],
        reviewed: false,
      },
      rejectedCompetitorNames: [],
      sharedViews: [],
      actions: [],
      actionEvents: [],
      agentLogs: [],
      gaReferrals: [],
      logIntegrations: [],
      facts: [],
      claims: [],
      claimVerdicts: [],
      perceptionAttributes: [],
      perceptionRuns: [],
      perceptionObjections: [],
      products: [],
      merchants: [],
      chatProducts: [],
      shoppingAttributes: [],
      productCategories: [],
      pendingCategoryDraft: [],
    } as DemoStore;

    const a = bootstrapProjectFeatures(store);
    expect(a.spineChanged).toBe(true);
    const factCount = store.facts.length;
    const b = bootstrapProjectFeatures(store);
    expect(b.spineChanged).toBe(false);
    expect(store.facts.length).toBe(factCount);
  });
});
