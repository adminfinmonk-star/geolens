import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleGeminiApiAdapter, PerplexityApiAdapter } from "./api/providers.js";
import { resetChannelHealth } from "./degraded.js";
import { resetRateLimiters } from "./rateLimit.js";

const request = { prompt: "test", countryCode: "US", channelId: "google-3", modelId: "test", runDate: "2026-09-19" };
beforeEach(() => { resetChannelHealth(); resetRateLimiters(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("provider response integrity", () => {
  it("reports authentication errors as failures, not empty answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"invalid key"}', { status: 401 })));
    const result = await new PerplexityApiAdapter("test-key", "live").run(request);
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("HTTP_401");
  });
  it("counts only referenced Gemini grounding chunks as citations and keeps the key out of URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "An answer" }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://cited.example" } }, { web: { uri: "https://retrieved.example" } }], groundingSupports: [{ groundingChunkIndices: [0] }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new GoogleGeminiApiAdapter("google-3", "test-secret", "live").run(request);
    expect(result.sources.map((s) => s.cited)).toEqual([true, false]);
    expect(fetchMock.mock.calls[0]![0]).not.toContain("test-secret");
    expect(fetchMock.mock.calls[0]![1].headers["x-goog-api-key"]).toBe("test-secret");
  });
  it("does not silently switch to ungrounded generation on forbidden search", async () => {
    vi.stubEnv("GEO_ALLOW_UNGROUNDED_FALLBACK", "false");
    const fetchMock = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new GoogleGeminiApiAdapter("google-3", "test-secret", "live").run(request);
    expect(result.status).toBe("error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
