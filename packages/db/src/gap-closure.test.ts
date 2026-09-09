import { describe, expect, it } from "vitest";
import {
  bootstrapProjectFeatures,
  createDb,
  loadProjectStore,
  marketPerceptionReport,
  resetProjectStoreCache,
  runMigrations,
  shoppingSummary,
  signup,
} from "./index.js";
import type { DemoStore } from "./seed.js";

const pgUrl =
  process.env.DATABASE_URL ?? "postgres://geo:geo@localhost:5432/geo";

describe("gap closure: postgres bootstrap + extension", () => {
  it("signup project gets perception + shopping after load", async () => {
    let db;
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
    expect(store!.brands.some((b) => b.is_own)).toBe(true);
    expect(store!.chats.length).toBeGreaterThan(0);

    const market = marketPerceptionReport(store!);
    expect(market.summary.biggest_gap?.statement).toMatch(/#1 → #9/);

    const shop = shoppingSummary(store!);
    expect(shop.price_drift.length).toBeGreaterThan(0);
    expect(store!.actions.length).toBeGreaterThan(0);

    // Reload from DB (clear cache) — extension must survive
    resetProjectStoreCache(result.project.id);
    const again = await loadProjectStore(db, result.project.id);
    expect(again!.facts.length).toBeGreaterThan(0);
    expect(again!.products.length).toBeGreaterThan(0);
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
