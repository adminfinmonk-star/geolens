import { describe, expect, it } from "vitest";
import { generateActionsForStore } from "./actions.js";
import { getDemoStore, resetDemoStore } from "./seed.js";
import {
  ingestCatalogCsv,
  shoppingSummary,
} from "./shopping.js";

describe("shopping", () => {
  it("seeds price drift and R9 gaps; CSV upload backfills", async () => {
    delete process.env.DATABASE_URL;
    resetDemoStore();
    const store = await getDemoStore();

    const summary = shoppingSummary(store);
    expect(summary.price_drift.length).toBeGreaterThan(0);
    expect(
      summary.price_drift.some(
        (d) => d.price_drift != null && d.price_drift < 0,
      ),
    ).toBe(true);
    expect(summary.top_products.length).toBeGreaterThan(0);

    const csv =
      "title,brand,price,currency,category\nAcme CRM Starter,Acme,19,USD,CRM > Starter\n";
    const result = ingestCatalogCsv(store, csv);
    expect(result.added).toBe(1);
    expect(result.price_drift_visible).toBe(true);
    expect(result.matched_appearances).toBeGreaterThanOrEqual(0);

    const { actions } = generateActionsForStore(store, { force: true });
    expect(actions.some((a) => a.rule_id === "R9")).toBe(true);
  }, 60_000);
});
