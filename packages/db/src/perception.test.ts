import { describe, expect, it } from "vitest";
import {
  factcheckReport,
  marketPerceptionReport,
} from "./perception.js";
import { generateActionsForStore } from "./actions.js";
import { getDemoStore, resetDemoStore } from "./seed.js";

describe("perception + factcheck", () => {
  it("biggest gap card is #1 → #9 and wrong price is contradicted", async () => {
    delete process.env.DATABASE_URL;
    resetDemoStore();
    const store = await getDemoStore();
    const market = marketPerceptionReport(store);
    expect(market.summary.biggest_gap?.statement).toMatch(/#1 → #9/);
    expect(market.summary.biggest_gap?.label).toBe("Reliability");

    const fc = factcheckReport(store);
    expect(
      fc.contradicted.some((c) =>
        /\$9/.test(c.claim.statement) || /9\/mo/.test(c.claim.statement),
      ),
    ).toBe(true);

    const { actions } = generateActionsForStore(store, { force: true });
    expect(actions.some((a) => a.rule_id === "R8")).toBe(true);
  }, 60_000);
});
