import { describe, expect, it } from "vitest";
import { brandInsightsFromStore, createSharedView, getSharedView } from "./insights.js";
import { resetDemoStore, getDemoStore } from "./seed.js";

describe("brandInsightsFromStore", () => {
  it("builds a topic×channel matrix with channel contrast", async () => {
    delete process.env.DATABASE_URL;
    resetDemoStore();
    const store = await getDemoStore();
    const insights = brandInsightsFromStore(store);
    expect(insights.brand.is_own).toBe(true);
    expect(insights.matrix.colKeys.length).toBeGreaterThanOrEqual(2);
    expect(insights.matrix.rowKeys.length).toBeGreaterThan(0);
    expect(insights.matrix.cells.length).toBe(
      insights.matrix.rowKeys.length * insights.matrix.colKeys.length,
    );
    // At least one topic should differ across channels (seed weakens openai-1)
    const byRow = new Map<string, number[]>();
    for (const c of insights.matrix.cells) {
      const list = byRow.get(c.rowKey) ?? [];
      list.push(c.visibility);
      byRow.set(c.rowKey, list);
    }
    const hasGap = [...byRow.values()].some((vs) => {
      const min = Math.min(...vs);
      const max = Math.max(...vs);
      return max - min > 0.05;
    });
    expect(hasGap).toBe(true);
    expect(insights.kpis.strongest_channel).toBeTruthy();
    expect(insights.kpis.weakest_channel).toBeTruthy();
  }, 60_000);

  it("creates and resolves shared views", async () => {
    delete process.env.DATABASE_URL;
    resetDemoStore();
    const store = await getDemoStore();
    const view = createSharedView(store, { name: "Board pack" });
    expect(view.id).toMatch(/^vw_/);
    expect(view.id.length).toBeGreaterThan(30);
    expect(getSharedView(store, view.id)?.name).toBe("Board pack");
    view.expires_at = new Date(Date.now() - 1_000).toISOString();
    expect(getSharedView(store, view.id)).toBeNull();
  }, 60_000);
});
