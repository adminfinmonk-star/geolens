import { describe, expect, it } from "vitest";
import {
  competitorSuggestions,
  getDemoStore,
  prepareDomainAnalysis,
  resetDemoStore,
  runDiscovery,
  activateDiscoveredPrompts,
  importPromptsCsv,
} from "./index.js";

describe("discovery store helpers", () => {
  it("surfaces competitor suggestions from seeded chats", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const suggestions = competitorSuggestions(store);
    expect(suggestions.some((s) => s.name === "Salesforce")).toBe(true);
  });

  it("generates and activates discovery prompts", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const before = store.prompts.length;
    const result = runDiscovery(store, {
      countries: ["US"],
      topics: ["Pricing & plans"],
    });
    expect(result.prompts.length).toBeGreaterThan(0);
    const created = activateDiscoveredPrompts(
      store,
      result.prompts.slice(0, 3),
    );
    expect(created.length).toBe(3);
    expect(store.prompts.length).toBe(before + 3);
  });

  it("imports CSV prompts", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const created = importPromptsCsv(
      store,
      "text,country,topic\nCRM for freelancers,US,Category alternatives",
    );
    expect(created).toHaveLength(1);
    expect(created[0]?.volume_score).toBeGreaterThanOrEqual(1);
  });

  it("does not seed CRM rivals for an AI router domain", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    prepareDomainAnalysis(store, "openrouter.ai");
    const names = store.brands.map((b) => b.name.toLowerCase());
    expect(names.some((n) => n.includes("salesforce"))).toBe(false);
    expect(names.some((n) => n.includes("hubspot"))).toBe(false);
    expect(store.brands.find((b) => b.is_own)?.name.toLowerCase()).toContain(
      "openrouter",
    );
  });

  it("uses India + Indian fintech rivals for thefinmonk.com", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    prepareDomainAnalysis(store, "thefinmonk.com");
    expect(store.project.default_country).toBe("IN");
    expect(store.prompts.every((p) => p.country_code === "IN")).toBe(true);
    const names = store.brands.map((b) => b.name.toLowerCase());
    expect(names.some((n) => n.includes("groww") || n.includes("zerodha"))).toBe(
      true,
    );
    expect(names.some((n) => n.includes("stripe"))).toBe(false);
  });
});
