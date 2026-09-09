import { describe, expect, it } from "vitest";
import {
  claimHash,
  computeBiggestGap,
  computePerceptionSummary,
  extractAtomicClaims,
  judgeClaimAgainstFacts,
  positionalProminence,
  type AttributeScore,
} from "./index.js";

describe("positionalProminence", () => {
  it("scores first=100 and decays", () => {
    expect(positionalProminence(1)).toBe(100);
    expect(positionalProminence(2)).toBe(90);
    expect(positionalProminence(10)).toBe(10);
    expect(positionalProminence(11)).toBe(0);
    expect(positionalProminence(null)).toBe(0);
  });
});

describe("biggest gap card", () => {
  it("produces a defensible #1 → #9 statement", () => {
    const attrs: AttributeScore[] = [
      {
        attributeId: "a1",
        label: "Reliability",
        association: 92,
        market_prominence: 20,
        market_rank: 9,
        brands_carrying: 12,
      },
      {
        attributeId: "a2",
        label: "Affordability",
        association: 40,
        market_prominence: 70,
        market_rank: 2,
        brands_carrying: 10,
      },
      {
        attributeId: "a3",
        label: "Security",
        association: 55,
        market_prominence: 50,
        market_rank: 4,
        brands_carrying: 8,
      },
      {
        attributeId: "a4",
        label: "Integrations",
        association: 60,
        market_prominence: 45,
        market_rank: 5,
        brands_carrying: 9,
      },
    ];
    const gap = computeBiggestGap(attrs, "Acme")!;
    expect(gap.statement).toMatch(/#1 → #9/);
    expect(gap.label).toBe("Reliability");

    const summary = computePerceptionSummary(attrs, "Acme", [
      { brand: "BetaSoft", mean: 70 },
      { brand: "CloudNine", mean: 55 },
    ]);
    expect(summary.biggest_gap?.statement).toMatch(/#1 → #9/);
    expect(summary.strongest_competitor?.brand).toBe("BetaSoft");
  });
});

describe("fact-checking", () => {
  it("extracts atomic claims and contradicts wrong price", () => {
    const claims = extractAtomicClaims(
      "Acme starts at $9/mo, integrates with Salesforce, and has 10k customers.",
    );
    expect(claims.length).toBe(3);
    expect(claims[0]!.category).toBe("pricing");

    const verdict = judgeClaimAgainstFacts(claims[0]!, [
      {
        id: "fct_1",
        statement: "Acme CRM starts at $49/mo",
        is_active: true,
      },
    ]);
    expect(verdict?.verdict).toBe("contradicted");
    expect(claimHash(claims[0]!.statement)).toBeTruthy();
  });
});
