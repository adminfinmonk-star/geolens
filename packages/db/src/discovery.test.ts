import { describe, expect, it } from "vitest";
import {
  competitorSuggestions,
  getDemoStore,
  prepareDomainAnalysis,
  resetDemoStore,
  runDiscovery,
  activateDiscoveredPrompts,
  importPromptsCsv,
  listBrands,
  listTopics,
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

  it("adds relevant rivals for an AI router domain without deleting history", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    prepareDomainAnalysis(store, "openrouter.ai");
    const names = store.brands.map((b) => b.name.toLowerCase());
    expect(names.some((n) => n.includes("anthropic"))).toBe(true);
    expect(store.brands.find((b) => b.is_own)?.name.toLowerCase()).toContain(
      "openrouter",
    );
  });

  it("uses India + Indian fintech rivals for thefinmonk.com", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    prepareDomainAnalysis(store, "thefinmonk.com");
    expect(store.project.default_country).toBe("IN");
    const markets = new Set(
      store.prompts
        .filter((p) => p.status === "active")
        .map((p) => p.country_code),
    );
    expect(markets).toEqual(new Set(["IN", "US", "GB", "SG"]));
    const names = store.brands.map((b) => b.name.toLowerCase());
    expect(names.some((n) => n.includes("groww") || n.includes("zerodha"))).toBe(
      true,
    );
  });

  it("preserves historical evidence and archives prior prompt versions", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const chatIds = store.chats.map((c) => c.id);
    const mentionCount = store.mentions.length;
    const sourceCount = store.sources.length;

    prepareDomainAnalysis(store, "openrouter.ai");

    expect(store.chats.map((c) => c.id)).toEqual(chatIds);
    expect(store.mentions).toHaveLength(mentionCount);
    expect(store.sources).toHaveLength(sourceCount);
    expect(store.prompts.some((p) => p.status === "archived")).toBe(true);
    expect(store.prompts.some((p) => p.status === "active")).toBe(true);
  });

  it("isolates a Google analysis from historical fintech configuration", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const historicalBrandCount = store.brands.length;
    const historicalTopicCount = store.topics.length;

    const prepared = prepareDomainAnalysis(store, "google.com");
    const currentBrands = listBrands(store).map((brand) => brand.name);
    const currentTopics = listTopics(store);

    expect(prepared.profile.industry).toBe("Search & productivity platforms");
    expect(store.project.default_country).toBe("US");
    expect(store.project.timezone).toBe("America/New_York");
    expect(currentBrands).toEqual(
      expect.arrayContaining(["Google", "Microsoft", "Apple", "Amazon", "Meta"]),
    );
    expect(currentBrands).not.toEqual(expect.arrayContaining(["Groww", "Paytm"]));
    expect(currentTopics).toHaveLength(1);
    expect(
      store.prompts
        .filter((prompt) => prompt.status === "active")
        .every((prompt) => !prompt.text.includes("platforms platforms")),
    ).toBe(true);
    expect(store.brands.length).toBeGreaterThanOrEqual(historicalBrandCount);
    expect(store.topics.length).toBeGreaterThanOrEqual(historicalTopicCount);
  });
});
