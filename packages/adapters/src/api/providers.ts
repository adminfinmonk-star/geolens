import { getChannel } from "@geo/registry";
import {
  FailureTracker,
  getChannelHealth,
  markChannelDegraded,
} from "../degraded.js";
import { providerBucket } from "../rateLimit.js";
import { HttpStatusError, withRetry } from "../retry.js";
import type {
  EngineAdapter,
  EngineRequest,
  EngineResponse,
  RawSource,
} from "../types.js";
import { fixtureEngineResponse, resolveProviderMode } from "./fixtures.js";

const trackers = new Map<string, FailureTracker>();

function tracker(channelId: string) {
  let t = trackers.get(channelId);
  if (!t) {
    t = new FailureTracker();
    trackers.set(channelId, t);
  }
  return t;
}

async function gatedFetch(
  provider: string,
  channelId: string,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const bucket = providerBucket(provider);
  if (!bucket.tryTake()) {
    throw new HttpStatusError(429, `rate_limited:${provider}`);
  }
  return withRetry(async () => {
    const res = await fetch(url, init);
    if (res.status === 429 || res.status >= 500) {
      throw new HttpStatusError(res.status, await res.text());
    }
    return res;
  });
}

function recordOutcome(channelId: string, ok: boolean) {
  const t = tracker(channelId);
  t.record(ok);
  if (!ok && t.shouldDegrade()) {
    markChannelDegraded(
      channelId,
      "invariant/failure rate exceeded 2% over 15m window",
      t.failureRate(),
    );
  }
}

export class OpenAiApiAdapter implements EngineAdapter {
  readonly channelId = "openai-1";
  readonly surfaceKind = "api" as const;
  readonly capabilities = {
    fanouts: true,
    ads: false,
    shopping: false,
    maps: false,
    geo: "none" as const,
    citationsDistinctFromSources: true,
  };

  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    /** When set, forces mode; otherwise resolved per-provider from env. */
    private readonly modeOverride?: "live" | "fixture",
  ) {}

  private effectiveMode(): "live" | "fixture" {
    if (this.modeOverride) return this.modeOverride;
    return resolveProviderMode("openai");
  }

  async health() {
    const h = getChannelHealth(this.channelId);
    if (h.status !== "ok") {
      return { ok: false, detail: h.reason ?? h.status };
    }
    const mode = this.effectiveMode();
    if (mode === "fixture" || !this.apiKey) {
      return {
        ok: true,
        detail: this.apiKey ? "fixture_mode" : "fixture_mode_no_key",
      };
    }
    return { ok: true, detail: "live_key_present" };
  }

  async run(req: EngineRequest): Promise<EngineResponse> {
    const health = getChannelHealth(this.channelId);
    if (health.status === "down") {
      return {
        status: "error",
        errorCode: "CHANNEL_DOWN",
        text: "",
        sources: [],
        fanouts: [],
        ads: [],
        products: [],
        maps: [],
        features: [],
        raw: { health },
        meta: {
          modelReported: getChannel(this.channelId)?.currentModel,
          latencyMs: 0,
          surfaceKind: "api",
        },
      };
    }

    if (this.effectiveMode() === "fixture" || !this.apiKey) {
      const out = fixtureEngineResponse(req, {
        provider: "openai",
        modelReported: "gpt-web-search",
        // Deliberately weak for Acme — channel contrast vs Perplexity
        brandBias: ["BetaSoft", "CloudNine", "DataPeak", "Northwind"],
      });
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    }

    const t0 = Date.now();
    try {
      const res = await gatedFetch(
        "openai",
        this.channelId,
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: getChannel(this.channelId)?.currentModel ?? "gpt-4.1-mini",
            tools: [{ type: "web_search_preview" }],
            input: req.prompt,
          }),
        },
      );
      const raw = (await res.json()) as Record<string, unknown>;
      const mapped = mapOpenAiResponse(raw, Date.now() - t0);
      recordOutcome(this.channelId, mapped.status === "ok");
      return mapped;
    } catch (err) {
      recordOutcome(this.channelId, false);
      return {
        status: "error",
        errorCode:
          err instanceof HttpStatusError
            ? `HTTP_${err.status}`
            : "OPENAI_ERROR",
        text: "",
        sources: [],
        fanouts: [],
        ads: [],
        products: [],
        maps: [],
        features: [],
        raw: { error: String(err) },
        meta: {
          modelReported: "gpt-web-search",
          latencyMs: Date.now() - t0,
          surfaceKind: "api",
        },
      };
    }
  }
}

export class PerplexityApiAdapter implements EngineAdapter {
  readonly channelId = "perplexity-1";
  readonly surfaceKind = "api" as const;
  readonly capabilities = {
    fanouts: true,
    ads: false,
    shopping: false,
    maps: false,
    geo: "none" as const,
    citationsDistinctFromSources: true,
  };

  constructor(
    private readonly apiKey = process.env.PERPLEXITY_API_KEY,
    private readonly modeOverride?: "live" | "fixture",
  ) {}

  private effectiveMode(): "live" | "fixture" {
    if (this.modeOverride) return this.modeOverride;
    return resolveProviderMode("perplexity");
  }

  async health() {
    const h = getChannelHealth(this.channelId);
    if (h.status !== "ok") return { ok: false, detail: h.reason ?? h.status };
    const mode = this.effectiveMode();
    if (mode === "fixture" || !this.apiKey) {
      return {
        ok: true,
        detail: this.apiKey ? "fixture_mode" : "fixture_mode_no_key",
      };
    }
    return { ok: true, detail: "live_key_present" };
  }

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (getChannelHealth(this.channelId).status === "down") {
      return errorRes("CHANNEL_DOWN", "sonar");
    }
    if (this.effectiveMode() === "fixture" || !this.apiKey) {
      const out = fixtureEngineResponse(req, {
        provider: "perplexity",
        modelReported: "sonar",
        // Strong Acme on Perplexity — opposite of OpenAI fixture bias
        brandBias: ["Acme", "CloudNine", "BetaSoft", "Northwind"],
      });
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    }

    const t0 = Date.now();
    try {
      const res = await gatedFetch(
        "perplexity",
        this.channelId,
        "https://api.perplexity.ai/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [{ role: "user", content: req.prompt }],
          }),
        },
      );
      const raw = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        search_results?: { url: string; title?: string }[];
        model?: string;
      };
      const text = raw.choices?.[0]?.message?.content ?? "";
      const sources: RawSource[] = (raw.search_results ?? []).map((s, i) => ({
        url: s.url,
        title: s.title,
        cited: true,
        citationCount: 1,
        citationPosition: i + 1,
        retrievalRank: i + 1,
      }));
      const out: EngineResponse = {
        status: text ? "ok" : "empty",
        text,
        sources,
        fanouts: [],
        ads: [],
        products: [],
        maps: [],
        features: sources.length ? [{ type: "web_search" }] : [],
        raw: { ...raw, live: true },
        meta: {
          modelReported: raw.model ?? "sonar",
          latencyMs: Date.now() - t0,
          surfaceKind: "api",
        },
      };
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    } catch (err) {
      recordOutcome(this.channelId, false);
      return errorRes(
        err instanceof HttpStatusError ? `HTTP_${err.status}` : "PPLX_ERROR",
        "sonar",
        Date.now() - t0,
        err,
      );
    }
  }
}

export class GoogleGeminiApiAdapter implements EngineAdapter {
  readonly channelId: string;
  readonly surfaceKind = "api" as const;
  readonly capabilities = {
    fanouts: true,
    ads: false,
    shopping: false,
    maps: false,
    geo: "none" as const,
    citationsDistinctFromSources: true,
  };

  constructor(
    channelId = "google-3",
    private readonly apiKey =
      process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
    private readonly modeOverride?: "live" | "fixture",
  ) {
    this.channelId = channelId;
  }

  private effectiveMode(): "live" | "fixture" {
    if (this.modeOverride) return this.modeOverride;
    return resolveProviderMode("google");
  }

  async health() {
    const h = getChannelHealth(this.channelId);
    if (h.status !== "ok") return { ok: false, detail: h.reason ?? h.status };
    const mode = this.effectiveMode();
    if (mode === "fixture" || !this.apiKey) {
      return {
        ok: true,
        detail: this.apiKey ? "fixture_mode" : "fixture_mode_no_key",
      };
    }
    return { ok: true, detail: "live_key_present" };
  }

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (getChannelHealth(this.channelId).status === "down") {
      return errorRes("CHANNEL_DOWN", "gemini-grounded");
    }
    if (this.effectiveMode() === "fixture" || !this.apiKey) {
      const out = fixtureEngineResponse(req, {
        provider: "google",
        modelReported: "gemini-grounded",
        brandBias: ["DataPeak", "Acme", "CloudNine", "BetaSoft"],
      });
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    }

    const t0 = Date.now();
    const model =
      getChannel(this.channelId)?.currentModel === "gemini-grounded"
        ? "gemini-2.0-flash"
        : (getChannel(this.channelId)?.currentModel ?? "gemini-2.0-flash");
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey!)}`;
      const res = await gatedFetch("google", this.channelId, url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: req.prompt }] }],
          tools: [{ google_search: {} }],
        }),
      });
      const raw = (await res.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          groundingMetadata?: {
            groundingChunks?: { web?: { uri?: string; title?: string } }[];
          };
        }[];
        modelVersion?: string;
        error?: { message?: string };
      };
      if (raw.error?.message) {
        throw new Error(raw.error.message);
      }
      const text =
        raw.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("\n") ?? "";
      const chunks =
        raw.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources: RawSource[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const uri = chunks[i]?.web?.uri;
        if (!uri) continue;
        sources.push({
          url: uri,
          title: chunks[i]?.web?.title,
          cited: true,
          citationCount: 1,
          citationPosition: sources.length + 1,
          retrievalRank: sources.length + 1,
        });
      }
      const out: EngineResponse = {
        status: text ? "ok" : "empty",
        text,
        sources,
        fanouts: [],
        ads: [],
        products: [],
        maps: [],
        features: [{ type: "web_search" }],
        raw: { ...raw, live: true, provider: "google" },
        meta: {
          modelReported: raw.modelVersion ?? model,
          latencyMs: Date.now() - t0,
          surfaceKind: "api",
        },
      };
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    } catch (err) {
      recordOutcome(this.channelId, false);
      return errorRes(
        err instanceof HttpStatusError ? `HTTP_${err.status}` : "GOOGLE_ERROR",
        "gemini-grounded",
        Date.now() - t0,
        err,
      );
    }
  }
}

/** Copilot-labeled channel: Azure OpenAI when keyed, else fixtures. */
export class CopilotApiAdapter implements EngineAdapter {
  readonly channelId = "copilot-1";
  readonly surfaceKind = "api" as const;
  readonly capabilities = {
    fanouts: true,
    ads: false,
    shopping: false,
    maps: false,
    geo: "none" as const,
    citationsDistinctFromSources: false,
  };

  constructor(
    private readonly apiKey = process.env.AZURE_OPENAI_API_KEY,
    private readonly endpoint = process.env.AZURE_OPENAI_ENDPOINT,
    private readonly deployment =
      process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini",
    private readonly modeOverride?: "live" | "fixture",
  ) {}

  private effectiveMode(): "live" | "fixture" {
    if (this.modeOverride) return this.modeOverride;
    return resolveProviderMode("copilot");
  }

  async health() {
    const h = getChannelHealth(this.channelId);
    if (h.status !== "ok") return { ok: false, detail: h.reason ?? h.status };
    const mode = this.effectiveMode();
    if (mode === "fixture" || !this.apiKey || !this.endpoint) {
      return {
        ok: true,
        detail:
          this.apiKey && this.endpoint
            ? "fixture_mode"
            : "fixture_mode_no_azure",
      };
    }
    return { ok: true, detail: "live_azure_key_present" };
  }

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (getChannelHealth(this.channelId).status === "down") {
      return errorRes("CHANNEL_DOWN", "copilot-azure");
    }
    if (this.effectiveMode() === "fixture" || !this.apiKey || !this.endpoint) {
      const out = fixtureEngineResponse(req, {
        provider: "copilot",
        modelReported: "copilot-azure",
        brandBias: ["Northwind", "Acme", "BetaSoft", "CloudNine"],
      });
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    }

    const t0 = Date.now();
    const base = this.endpoint.replace(/\/$/, "");
    try {
      const res = await gatedFetch(
        "copilot",
        this.channelId,
        `${base}/openai/deployments/${this.deployment}/chat/completions?api-version=2024-10-21`,
        {
          method: "POST",
          headers: {
            "api-key": this.apiKey!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: req.prompt }],
            temperature: 0.3,
          }),
        },
      );
      const raw = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        model?: string;
      };
      const text = raw.choices?.[0]?.message?.content ?? "";
      const out: EngineResponse = {
        status: text ? "ok" : "empty",
        text,
        sources: [],
        fanouts: [],
        ads: [],
        products: [],
        maps: [],
        features: [],
        raw: { ...raw, live: true, provider: "copilot" },
        meta: {
          modelReported: raw.model ?? this.deployment,
          latencyMs: Date.now() - t0,
          surfaceKind: "api",
        },
      };
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    } catch (err) {
      recordOutcome(this.channelId, false);
      return errorRes(
        err instanceof HttpStatusError ? `HTTP_${err.status}` : "COPILOT_ERROR",
        "copilot-azure",
        Date.now() - t0,
        err,
      );
    }
  }
}

export class AnthropicApiAdapter implements EngineAdapter {
  readonly channelId = "anthropic-1";
  readonly surfaceKind = "api" as const;
  readonly capabilities = {
    fanouts: true,
    ads: false,
    shopping: false,
    maps: false,
    geo: "none" as const,
    citationsDistinctFromSources: true,
  };

  constructor(
    private readonly apiKey = process.env.ANTHROPIC_API_KEY,
    private readonly modeOverride?: "live" | "fixture",
  ) {}

  private effectiveMode(): "live" | "fixture" {
    if (this.modeOverride) return this.modeOverride;
    return resolveProviderMode("anthropic");
  }

  async health() {
    const h = getChannelHealth(this.channelId);
    if (h.status !== "ok") return { ok: false, detail: h.reason ?? h.status };
    const mode = this.effectiveMode();
    if (mode === "fixture" || !this.apiKey) {
      return {
        ok: true,
        detail: this.apiKey ? "fixture_mode" : "fixture_mode_no_key",
      };
    }
    return { ok: true, detail: "live_key_present" };
  }

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (getChannelHealth(this.channelId).status === "down") {
      return errorRes("CHANNEL_DOWN", "claude-web-search");
    }
    if (this.effectiveMode() === "fixture" || !this.apiKey) {
      const out = fixtureEngineResponse(req, {
        provider: "anthropic",
        modelReported: "claude-web-search",
        // Mid: Acme present but not lead
        brandBias: ["CloudNine", "BetaSoft", "DataPeak", "Acme"],
      });
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    }

    const t0 = Date.now();
    try {
      const res = await gatedFetch(
        "anthropic",
        this.channelId,
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey!,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            messages: [{ role: "user", content: req.prompt }],
          }),
        },
      );
      const raw = (await res.json()) as {
        content?: { type: string; text?: string; citations?: unknown[] }[];
        model?: string;
      };
      const textParts = (raw.content ?? [])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text!);
      const text = textParts.join("\n");
      const out: EngineResponse = {
        status: text ? "ok" : "empty",
        text,
        sources: [],
        fanouts: [],
        ads: [],
        products: [],
        maps: [],
        features: [{ type: "web_search" }],
        raw: { ...raw, live: true },
        meta: {
          modelReported: raw.model ?? "claude-web-search",
          latencyMs: Date.now() - t0,
          surfaceKind: "api",
        },
      };
      recordOutcome(this.channelId, out.status === "ok");
      return out;
    } catch (err) {
      recordOutcome(this.channelId, false);
      return errorRes(
        err instanceof HttpStatusError ? `HTTP_${err.status}` : "ANTHROPIC_ERROR",
        "claude-web-search",
        Date.now() - t0,
        err,
      );
    }
  }
}

function mapOpenAiResponse(
  raw: Record<string, unknown>,
  latencyMs: number,
): EngineResponse {
  const output = raw.output as
    | {
        type?: string;
        content?: {
          type?: string;
          text?: string;
          annotations?: { type?: string; url?: string; title?: string }[];
        }[];
      }[]
    | undefined;
  let text = "";
  const sources: RawSource[] = [];
  if (Array.isArray(output)) {
    for (const item of output) {
      for (const c of item.content ?? []) {
        if ((c.type === "output_text" || c.type === "text") && c.text) {
          text += c.text;
        }
        for (const a of c.annotations ?? []) {
          if (a.url) {
            sources.push({
              url: a.url,
              title: a.title,
              cited: true,
              citationCount: 1,
              citationPosition: sources.length + 1,
              retrievalRank: sources.length + 1,
            });
          }
        }
      }
    }
  }
  if (!text && typeof raw.output_text === "string") {
    text = raw.output_text;
  }
  return {
    status: text ? "ok" : "empty",
    text,
    sources,
    fanouts: [],
    ads: [],
    products: [],
    maps: [],
    features: sources.length ? [{ type: "web_search" }] : [{ type: "web_search" }],
    raw: { ...raw, live: true },
    meta: {
      modelReported: String(raw.model ?? "gpt-web-search"),
      latencyMs,
      surfaceKind: "api",
    },
  };
}

function errorRes(
  code: string,
  model: string,
  latencyMs = 0,
  err?: unknown,
): EngineResponse {
  return {
    status: "error",
    errorCode: code,
    text: "",
    sources: [],
    fanouts: [],
    ads: [],
    products: [],
    maps: [],
    features: [],
    raw: { error: err ? String(err) : code },
    meta: { modelReported: model, latencyMs, surfaceKind: "api" },
  };
}
