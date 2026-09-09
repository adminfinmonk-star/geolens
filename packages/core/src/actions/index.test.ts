import { describe, expect, it } from "vitest";
import {
  assignProjectBands,
  computeOpportunityScore,
  generateActions,
  type ActionsEvidenceBundle,
} from "./index.js";

function baseBundle(
  over: Partial<ActionsEvidenceBundle> = {},
): ActionsEvidenceBundle {
  return {
    ownBrandName: "Acme",
    ownDomains: ["acme.example"],
    windowDays: 90,
    domains: [],
    urls: [],
    topicPageTypeGaps: [],
    fanouts: [],
    robotsBlocks: [],
    crawlErrors: [],
    contradictedClaims: [],
    productAttributeGaps: [],
    topicImportance: {},
    ...over,
  };
}

describe("opportunity scoring", () => {
  it("ranks owned technical fixes above hard earned placements when volume equal", () => {
    const owned = computeOpportunityScore({
      gap_volume: 0.8,
      competitor_density: 0.3,
      topic_importance: 0.5,
      addressability: 1,
      estimated_effort: 0.15,
    });
    const earned = computeOpportunityScore({
      gap_volume: 0.8,
      competitor_density: 0.3,
      topic_importance: 0.5,
      addressability: 0.4,
      estimated_effort: 0.85,
    });
    expect(owned).toBeGreaterThan(earned);
  });

  it("assigns within-project bands without changing scores", () => {
    const rows = [
      { id: "a", opportunity_score: 0.2 },
      { id: "b", opportunity_score: 0.9 },
      { id: "c", opportunity_score: 0.5 },
    ];
    const banded = assignProjectBands(rows);
    expect(banded.find((x) => x.id === "b")!.impact_band).toBe("Very high");
    expect(banded.find((x) => x.id === "a")!.impact_band).toBe("Very low");
  });
});

describe("generateActions", () => {
  it("emits R1 with evidence rows when competitors own a page type", () => {
    const actions = generateActions(
      baseBundle({
        topicPageTypeGaps: [
          {
            topicId: "t1",
            topicName: "Pricing",
            pageType: "comparison",
            competitorCitedCount: 14,
            ownCitedCount: 0,
            competitorUrls: [
              { url: "https://betasoft.example/compare", citations: 8 },
              { url: "https://g2.com/compare/crm", citations: 6 },
            ],
          },
        ],
        topicImportance: { t1: 0.8 },
      }),
    );
    const r1 = actions.find((a) => a.rule_id === "R1")!;
    expect(r1.overview).toMatch(/comparison/);
    expect(r1.evidence.length).toBeGreaterThan(0);
    expect(r1.evidence.some((e) => e.url?.includes("betasoft"))).toBe(true);
  });

  it("emits R5 for blocked search bots and R10 for uncovered fanouts", () => {
    const actions = generateActions(
      baseBundle({
        robotsBlocks: [
          { bot: "GPTBot", kind: "search", directive: "Disallow: /" },
        ],
        fanouts: [
          {
            text: "best crm for agencies 2026",
            type: "search",
            occurrences: 12,
            ownDomainInSources: false,
          },
        ],
      }),
    );
    expect(actions.some((a) => a.rule_id === "R5")).toBe(true);
    expect(actions.some((a) => a.rule_id === "R10")).toBe(true);
  });

  it("every action carries evidence that generated it", () => {
    const actions = generateActions(
      baseBundle({
        domains: [
          {
            domain: "techcrunch.com",
            classification: "EDITORIAL",
            retrieval_count: 20,
            gap_score: 0.9,
            gap_score_normalized: 0.95,
            competitor_brands_mentioned: 3,
            own_brand_mentioned: false,
            total_citations: 40,
          },
        ],
        urls: [
          {
            url: "https://acme.example/docs/old",
            domain: "acme.example",
            classification: "OWN",
            retrieval_count: 15,
            citation_count: 0,
            citation_rate: 0,
            gap_score: 0.2,
            own_brand_mentioned: true,
            competitor_brands_mentioned: 0,
          },
        ],
        crawlErrors: [
          { url: "https://acme.example/broken", status: 404, botVisits: 3 },
        ],
        contradictedClaims: [
          {
            claim: "Acme starts at $9/mo",
            sources: ["https://g2.com/acme"],
          },
        ],
        productAttributeGaps: [
          {
            product: "Acme CRM",
            attribute: "SSO",
            competitorValues: ["SAML", "OIDC"],
          },
        ],
        robotsBlocks: [
          { bot: "GPTBot", kind: "search", directive: "Disallow: /" },
        ],
      }),
    );
    expect(actions.length).toBeGreaterThan(3);
    for (const a of actions) {
      expect(a.evidence.length).toBeGreaterThan(0);
    }
  });
});
