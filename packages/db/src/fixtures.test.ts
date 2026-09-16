import { describe, expect, it } from "vitest";
import { purgeLegacyFixtures } from "./fixtures.js";

function brand(id: string, name: string, is_own = false) {
  return { id, name, is_own };
}

describe("purgeLegacyFixtures: seeded competitor brands", () => {
  it("drops unmentioned fixture competitors but keeps the own brand", () => {
    const store = {
      project: {},
      brands: [
        brand("br_acme", "Thefinmonk", true),
        brand("br_beta", "BetaSoft"),
        brand("br_gamma", "GammaHQ"),
        brand("br_delta", "DeltaForce CRM"),
        brand("br_real", "PayPal"),
      ],
      mentions: [{ brand_id: "br_acme" }, { brand_id: "br_real" }],
    };

    expect(purgeLegacyFixtures(store)).toBe(true);
    expect(store.brands.map((b) => b.name)).toEqual(["Thefinmonk", "PayPal"]);
  });

  it("keeps a fixture-named brand that real collection actually mentioned", () => {
    const store = {
      project: {},
      brands: [brand("br_x", "CloudNine")],
      mentions: [{ brand_id: "br_x" }],
    };

    expect(purgeLegacyFixtures(store)).toBe(false);
    expect(store.brands.map((b) => b.name)).toEqual(["CloudNine"]);
  });

  it("leaves demo stores untouched", () => {
    const store = {
      demo_fixtures: true,
      project: {},
      brands: [brand("br_acme", "Acme", true), brand("br_beta", "BetaSoft")],
      mentions: [],
    };

    expect(purgeLegacyFixtures(store)).toBe(false);
    expect(store.brands).toHaveLength(2);
  });
});
