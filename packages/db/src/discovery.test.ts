import { describe, expect, it } from "vitest";
import {
  activateDiscoveredPrompts,
  competitorSuggestions,
  getDemoStore,
  importPromptsCsv,
  listBrands,
  listTopics,
  prepareDomainAnalysis,
  resetDemoStore,
  runDiscovery,
  saveBrandProfile,
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

  it("uses the configured India market and relevant vehicle-finance rivals", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    prepareDomainAnalysis(store, "thefinmonk.com");
    expect(store.project.default_country).toBe("IN");
    const markets = new Set(
      store.prompts
        .filter((p) => p.status === "active")
        .map((p) => p.country_code),
    );
    expect(markets).toEqual(new Set(["IN"]));
    const active = store.prompts.filter((p) => p.status === "active");
    expect(active).toHaveLength(8);
    expect(active.every((prompt) => prompt.branding === "non-branded")).toBe(true);
    expect(active.some((prompt) => /loan against car/i.test(prompt.text))).toBe(true);
    const names = store.brands.map((b) => b.name.toLowerCase());
    expect(names).toEqual(
      expect.arrayContaining(["bajaj finance", "hdfc bank", "icici bank"]),
    );
  });

  it("uses and preserves a reviewed profile when rebuilding the prompt strategy", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    saveBrandProfile(store, {
      domain: "thefinmonk.com",
      name: "Thefinmonk",
      industry: "Vehicle finance",
      products: ["Used-car refinance"],
      personas: ["Taxi fleet owner"],
      reviewed: true,
    });

    prepareDomainAnalysis(store, "thefinmonk.com", { prompt_limit: 8 });

    const active = store.prompts.filter((prompt) => prompt.status === "active");
    expect(active).toHaveLength(8);
    expect(active.every((prompt) => /used-car refinance/i.test(prompt.text))).toBe(true);
    expect(active.every((prompt) => prompt.persona === "Taxi fleet owner")).toBe(true);
    expect(store.brandProfile.reviewed).toBe(true);
  });

  it("versions the prompt cohort after reviewed discovery inputs change", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    prepareDomainAnalysis(store, "thefinmonk.com", { prompt_limit: 8 });
    const originalIds = store.analysisScope!.promptIds;
    saveBrandProfile(store, {
      products: ["Fleet vehicle refinance"],
      personas: ["Commercial fleet owner"],
      reviewed: true,
    });

    prepareDomainAnalysis(store, "thefinmonk.com", { prompt_limit: 8 });

    expect(store.analysisScope!.promptIds).not.toEqual(originalIds);
    expect(
      store.prompts
        .filter((prompt) => prompt.status === "active")
        .every((prompt) => /fleet vehicle refinance/i.test(prompt.text)),
    ).toBe(true);
    expect(
      originalIds.every(
        (id) => store.prompts.find((prompt) => prompt.id === id)?.status === "archived",
      ),
    ).toBe(true);
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
    expect(currentTopics.length).toBeGreaterThanOrEqual(1);
    expect(
      store.prompts
        .filter((prompt) => prompt.status === "active")
        .every((prompt) => !prompt.text.includes("platforms platforms")),
    ).toBe(true);
    expect(store.brands.length).toBeGreaterThanOrEqual(historicalBrandCount);
    expect(store.topics.length).toBeGreaterThanOrEqual(historicalTopicCount);
    const activeBefore = store.prompts.filter((p) => p.status === "active");
    activeBefore[0]!.text = "User-selected product comparison question";
    const ids = activeBefore.map((p) => p.id);
    prepareDomainAnalysis(store, "google.com");
    expect(store.prompts.filter((p) => p.status === "active").map((p) => p.id)).toEqual(ids);
    expect(store.prompts.find((p) => p.id === ids[0])!.text).toBe("User-selected product comparison question");
    expect(store.analysisScope?.promptIds).toEqual(ids);
  });

  it("rebuilds a same-domain panel when an unscoped prompt contaminates it", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    prepareDomainAnalysis(store, "thefinmonk.com");
    const originalIds = new Set(store.analysisScope!.promptIds);
    store.prompts.push({
      id: "pr_unrelated_search",
      project_id: store.project.id,
      text: "best search and productivity platforms in Australia",
      country_code: "AU",
      status: "active",
      branding: "non-branded",
    });

    prepareDomainAnalysis(store, "thefinmonk.com");

    const active = store.prompts.filter((prompt) => prompt.status === "active");
    expect(active).toHaveLength(8);
    expect(active.every((prompt) => prompt.branding === "non-branded")).toBe(true);
    expect(active.some((prompt) => /loan against car/i.test(prompt.text))).toBe(true);
    expect(active.some((prompt) => originalIds.has(prompt.id))).toBe(false);
    expect(store.analysisScope?.promptIds).toEqual(active.map((prompt) => prompt.id));
    expect(store.prompts.find((prompt) => prompt.id === "pr_unrelated_search")?.status).toBe("archived");
  });
});
