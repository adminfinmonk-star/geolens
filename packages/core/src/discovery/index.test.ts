import { describe, expect, it } from "vitest";
import {
  classifyBranding,
  coverageOverview,
  extractBrandProfile,
  generateDiscoveryPrompts,
  inferMarketFromDomain,
  parsePromptsCsv,
  promptVolumeScore,
  suggestCompetitors,
  suggestTopics,
} from "./index.js";

describe("extractBrandProfile", () => {
  it("builds a CRM-shaped profile for acme domains", () => {
    const p = extractBrandProfile("https://www.acme.example");
    expect(p.name).toBe("Acme");
    expect(p.industry).toMatch(/CRM/i);
    expect(p.personas.length).toBeGreaterThan(0);
  });

  it("classifies LLM routers as AI infrastructure, not CRM", () => {
    const p = extractBrandProfile("https://openrouter.ai");
    expect(p.industry).toMatch(/AI/i);
    expect(p.industry).not.toMatch(/CRM/i);
  });
});

describe("inferMarketFromDomain", () => {
  it("maps Indian fintech .com brands to India, not US", () => {
    const m = inferMarketFromDomain("thefinmonk.com");
    expect(m.country).toBe("IN");
    expect(m.location).toBe("India");
  });

  it("maps .in ccTLD to India", () => {
    expect(inferMarketFromDomain("example.in").country).toBe("IN");
  });

  it("keeps generic .com in the US", () => {
    expect(inferMarketFromDomain("acme.example").country).toBe("US");
  });
});

describe("promptVolumeScore", () => {
  it("returns 1–5 deterministically", () => {
    const a = promptVolumeScore("best CRM for agencies", "US", "B2B CRM");
    const b = promptVolumeScore("best CRM for agencies", "US", "B2B CRM");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(5);
  });
});

describe("generateDiscoveryPrompts + coverage", () => {
  it("respects markets and produces coverage cells", () => {
    const profile = extractBrandProfile("acme.example");
    const topics = suggestTopics(profile).map((t) => t.name).slice(0, 3);
    const prompts = generateDiscoveryPrompts({
      profile,
      countries: ["US", "GB"],
      language: "en",
      topics,
      brandedShare: 0.2,
      intentMix: {
        informational: 0.25,
        commercial: 0.5,
        transactional: 0.25,
      },
    });
    expect(prompts.length).toBeGreaterThan(10);
    expect(prompts.every((p) => p.volume_score >= 1 && p.volume_score <= 5)).toBe(
      true,
    );
    const accepted = new Set(prompts.slice(0, 5).map((p) => p.text));
    const cov = coverageOverview(prompts, accepted);
    expect(cov.some((c) => c.status === "On target" || c.status === "Partial")).toBe(
      true,
    );
  });
});

describe("suggestCompetitors", () => {
  it("requires ≥2 mentions and skips tracked", () => {
    const texts = [
      "Salesforce and HubSpot are common picks.",
      "Many teams still prefer Salesforce for enterprise.",
      "HubSpot is fine for smaller teams.",
    ];
    const suggestions = suggestCompetitors({
      chatTexts: texts,
      trackedNames: ["HubSpot"],
    });
    expect(suggestions.find((s) => s.name === "HubSpot")).toBeUndefined();
    expect(suggestions.find((s) => s.name === "Salesforce")?.mention_count).toBe(
      2,
    );
  });
});

describe("parsePromptsCsv", () => {
  it("parses headered CSV", () => {
    const rows = parsePromptsCsv(
      "text,country,topic\nbest CRM,US,Category\n\"Acme pricing\",GB,Pricing",
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]?.country_code).toBe("GB");
  });
});

describe("classifyBranding", () => {
  it("detects branded prompts", () => {
    expect(classifyBranding("Acme pricing", "Acme")).toBe("branded");
    expect(classifyBranding("best CRM tools", "Acme")).toBe("non-branded");
  });
});
