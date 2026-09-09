import { describe, expect, it } from "vitest";
import { findBrandMentions } from "./brands.js";
import { assignPositions } from "./position.js";
import { enrichChat } from "./index.js";

const brands = [
  {
    brandId: "br_acme",
    name: "Acme",
    aliases: ["Acme Corp"],
    patterns: [],
  },
  {
    brandId: "br_beta",
    name: "BetaSoft",
    aliases: ["Beta"],
    patterns: [],
  },
];

describe("findBrandMentions + position", () => {
  it("orders brands by first appearance", () => {
    const text =
      "BetaSoft is solid, but Acme Corp remains the recommended choice for teams.";
    const mentions = findBrandMentions(text, brands);
    const positioned = assignPositions(mentions);
    const firstBeta = positioned.find((m) => m.brandId === "br_beta");
    const firstAcme = positioned.find((m) => m.brandId === "br_acme");
    expect(firstBeta?.position).toBe(1);
    expect(firstAcme?.position).toBe(2);
  });
});

describe("enrichChat", () => {
  it("normalizes sources and scores mentions", () => {
    const gap = " ".repeat(120);
    const result = enrichChat({
      text: `Acme is excellent.${gap}BetaSoft is limited and outdated.`,
      brands: [
        {
          brandId: "br_acme",
          name: "Acme",
          aliases: [],
          patterns: [],
        },
        {
          brandId: "br_beta",
          name: "BetaSoft",
          aliases: [],
          patterns: [],
        },
      ],
      sources: [
        {
          url: "https://www.example.com/post?utm_campaign=x",
          cited: true,
          citationCount: 2,
          retrievalRank: 1,
        },
      ],
    });
    expect(result.sources[0]?.domain).toBe("example.com");
    expect(result.mentions.length).toBeGreaterThanOrEqual(2);
    const acme = result.mentions.find((m) => m.brandId === "br_acme");
    expect(acme?.sentiment).toBeGreaterThan(0);
    const beta = result.mentions.find((m) => m.brandId === "br_beta");
    expect(beta?.sentiment).toBeLessThan(0);
  });
});
