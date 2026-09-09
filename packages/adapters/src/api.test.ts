import { describe, expect, it, beforeEach } from "vitest";
import {
  AnthropicApiAdapter,
  CHANNEL_PROVIDER_ROUTE,
  DEFAULT_API_CHANNELS,
  OpenAiApiAdapter,
  PerplexityApiAdapter,
  TokenBucket,
  clearAdapterCache,
  describeAdapterRuntime,
  getAdapter,
  listBuiltAdapters,
  markChannelDown,
  resetChannelHealth,
  resetRateLimiters,
  resolveProviderMode,
  withRetry,
  HttpStatusError,
} from "./index.js";

describe("API-first Peec channel adapters", () => {
  beforeEach(() => {
    process.env.GEO_ADAPTER_MODE = "fixture";
    clearAdapterCache();
    resetChannelHealth();
    resetRateLimiters();
  });

  it("routes Peec-like defaults to provider APIs", async () => {
    expect(DEFAULT_API_CHANNELS.length).toBeGreaterThanOrEqual(6);
    for (const id of DEFAULT_API_CHANNELS) {
      expect(CHANNEL_PROVIDER_ROUTE[id]).toBeTruthy();
      const a = getAdapter(id);
      expect(a.surfaceKind).toBe("api");
      const res = await a.run({
        prompt: "best CRM for agencies",
        countryCode: "US",
        channelId: id,
        modelId: "test",
        runDate: "2026-09-01",
        seed: "p6",
      });
      expect(res.meta.surfaceKind).toBe("api");
    }
  });

  it("Claude channel uses anthropic; GPT uses openai", () => {
    expect(CHANNEL_PROVIDER_ROUTE["anthropic-1"]?.provider).toBe("anthropic");
    expect(CHANNEL_PROVIDER_ROUTE["openai-0"]?.provider).toBe("openai");
    expect(CHANNEL_PROVIDER_ROUTE["google-ai-mode"]?.provider).toBe("google");
    expect(CHANNEL_PROVIDER_ROUTE["copilot-1"]?.provider).toBe("copilot");
  });

  it("token bucket refuses when empty", () => {
    const b = new TokenBucket(2, 0.001);
    expect(b.tryTake()).toBe(true);
    expect(b.tryTake()).toBe(true);
    expect(b.tryTake()).toBe(false);
  });

  it("withRetry retries 429 then succeeds", async () => {
    let n = 0;
    const out = await withRetry(
      async () => {
        n += 1;
        if (n < 3) throw new HttpStatusError(429, "slow down");
        return "ok";
      },
      { sleep: async () => undefined },
    );
    expect(out).toBe("ok");
    expect(n).toBe(3);
  });

  it("degraded/down channel returns error without silent empty ok", async () => {
    markChannelDown("openai-1", "test");
    const a = new OpenAiApiAdapter(undefined, "fixture");
    const res = await a.run({
      prompt: "x",
      countryCode: "US",
      channelId: "openai-1",
      modelId: "m",
      runDate: "2026-01-01",
    });
    expect(res.status).toBe("error");
    expect(res.errorCode).toBe("CHANNEL_DOWN");
  });

  it("listBuiltAdapters includes simulator + routed Peec channels", () => {
    expect(listBuiltAdapters().length).toBeGreaterThanOrEqual(7);
    expect(new PerplexityApiAdapter().capabilities.ads).toBe(false);
    expect(new AnthropicApiAdapter().capabilities.geo).toBe("none");
  });

  it("per-provider mode: missing key stays fixture even in live global", () => {
    const env = {
      GEO_ADAPTER_MODE: "live",
      OPENAI_API_KEY: "sk-test",
    };
    expect(resolveProviderMode("openai", env)).toBe("live");
    expect(resolveProviderMode("perplexity", env)).toBe("fixture");
    expect(resolveProviderMode("anthropic", env)).toBe("fixture");
    expect(resolveProviderMode("google", env)).toBe("fixture");
  });

  it("live OpenAI path calls fetch (mocked) and is not fixture", async () => {
    const orig = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response(
        JSON.stringify({
          output_text: "Acme CRM leads for agencies",
          model: "gpt-4.1-mini",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const a = new OpenAiApiAdapter("sk-test", "live");
      const res = await a.run({
        prompt: "best CRM",
        countryCode: "US",
        channelId: "openai-1",
        modelId: "m",
        runDate: "2026-09-01",
      });
      expect(called).toBe(true);
      expect(res.status).toBe("ok");
      expect(res.text).toContain("Acme");
      expect(res.meta.surfaceKind).toBe("api");
      expect((res.raw as { live?: boolean }).live).toBe(true);
      expect((res.raw as { fixture?: boolean }).fixture).toBeUndefined();
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("describeAdapterRuntime never claims live without a key", () => {
    const rt = describeAdapterRuntime({
      GEO_ADAPTER_MODE: "auto",
      OPENAI_API_KEY: "sk-x",
    });
    expect(rt.channels.find((c) => c.channel_id === "openai-1")?.mode).toBe(
      "live",
    );
    expect(
      rt.channels.find((c) => c.channel_id === "perplexity-1")?.mode,
    ).toBe("fixture");
    expect(rt.routing_policy).toMatch(/API-first/i);
  });
});
