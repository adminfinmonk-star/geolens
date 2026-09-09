import { Agent } from "@cursor/sdk";
import type {
  EngineAdapter,
  EngineRequest,
  EngineResponse,
} from "../types.js";
import { fixtureEngineResponse, resolveProviderMode } from "./fixtures.js";
import type { ProviderId } from "./fixtures.js";

/**
 * Map GeoLens / Peec channel ids → Cursor model ids.
 * Override via CURSOR_MODEL_OPENAI / CURSOR_MODEL_ANTHROPIC / etc.
 */
export function cursorModelForChannel(channelId: string): string {
  const env = process.env;
  if (channelId.startsWith("openai") || channelId === "copilot-1") {
    return env.CURSOR_MODEL_OPENAI ?? env.CURSOR_MODEL_GPT ?? "gpt-5.5";
  }
  if (channelId.startsWith("anthropic")) {
    return env.CURSOR_MODEL_ANTHROPIC ?? env.CURSOR_MODEL_CLAUDE ?? "claude-4.6-sonnet";
  }
  if (channelId.startsWith("google")) {
    return env.CURSOR_MODEL_GOOGLE ?? env.CURSOR_MODEL_GEMINI ?? "gemini-3-flash";
  }
  if (channelId.startsWith("perplexity")) {
    // No Perplexity surface in Cursor — closest general model
    return env.CURSOR_MODEL_PERPLEXITY ?? env.CURSOR_MODEL_OPENAI ?? "gpt-5.5";
  }
  return env.CURSOR_MODEL_DEFAULT ?? "composer-2.5";
}

export function cursorKeyPresent(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.CURSOR_API_KEY);
}

/**
 * Use Cursor when:
 * - GEO_COLLECTION_BACKEND=cursor, or
 * - GEO_COLLECTION_BACKEND=auto (default) and native provider key is missing
 */
export function shouldUseCursor(
  provider: ProviderId,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!cursorKeyPresent(env)) return false;
  if (env.GEO_ADAPTER_MODE === "fixture") return false;
  const backend = (env.GEO_COLLECTION_BACKEND ?? "auto").toLowerCase();
  if (backend === "native") return false;
  if (backend === "cursor") return true;
  // auto: Cursor fills in when the native vendor key is absent
  return resolveProviderMode(provider, env) === "fixture";
}

/**
 * One-shot Cursor Agent prompt — multi-model via a single CURSOR_API_KEY.
 * Not AI-search equivalent (no citations/fanouts); honesty notes required.
 */
export class CursorRoutedAdapter implements EngineAdapter {
  readonly surfaceKind = "api" as const;
  readonly capabilities = {
    fanouts: false,
    ads: false,
    shopping: false,
    maps: false,
    geo: "none" as const,
    citationsDistinctFromSources: false,
  };

  constructor(
    readonly channelId: string,
    private readonly provider: ProviderId,
    private readonly apiKey = process.env.CURSOR_API_KEY,
    private readonly modeOverride?: "live" | "fixture",
  ) {}

  private modelId() {
    return cursorModelForChannel(this.channelId);
  }

  private effectiveMode(): "live" | "fixture" {
    if (this.modeOverride) return this.modeOverride;
    if (process.env.GEO_ADAPTER_MODE === "fixture") return "fixture";
    return this.apiKey ? "live" : "fixture";
  }

  async health() {
    if (this.effectiveMode() === "fixture" || !this.apiKey) {
      return {
        ok: true,
        detail: this.apiKey ? "cursor_fixture_mode" : "cursor_no_key",
      };
    }
    return {
      ok: true,
      detail: `cursor_live:${this.modelId()}`,
    };
  }

  async run(req: EngineRequest): Promise<EngineResponse> {
    if (this.effectiveMode() === "fixture" || !this.apiKey) {
      return fixtureEngineResponse(req, {
        provider: this.provider,
        modelReported: `cursor-fixture:${this.modelId()}`,
        brandBias:
          this.provider === "anthropic"
            ? ["CloudNine", "BetaSoft", "DataPeak", "Acme"]
            : this.provider === "google"
              ? ["DataPeak", "Acme", "CloudNine", "BetaSoft"]
              : ["Acme", "CloudNine", "BetaSoft", "Northwind"],
      });
    }

    const t0 = Date.now();
    const model = this.modelId();
    const prompt = [
      "You are simulating an AI search / assistant answer for brand analytics.",
      "Answer the user question helpfully. Name relevant brands and products when natural.",
      "Do not mention that you are Cursor or an API.",
      "",
      `Question: ${req.prompt}`,
    ].join("\n");

    try {
      const result = await Agent.prompt(prompt, {
        apiKey: this.apiKey,
        model: { id: model },
        local: { cwd: process.cwd() },
      });
      const text =
        typeof result.result === "string"
          ? result.result
          : result.result != null
            ? String(result.result)
            : "";
      const status =
        result.status === "error" || !text
          ? text
            ? "ok"
            : "empty"
          : "ok";
      return {
        status: status === "ok" ? "ok" : "empty",
        text,
        sources: [],
        fanouts: [],
        ads: [],
        products: [],
        maps: [],
        features: [],
        raw: {
          live: true,
          via: "cursor_sdk",
          model,
          provider: this.provider,
          cursor_status: result.status,
          collection_note:
            "Routed via Cursor API — multi-model text only; not consumer AI-search UI.",
        },
        meta: {
          modelReported: model,
          latencyMs: Date.now() - t0,
          surfaceKind: "api",
        },
      };
    } catch (err) {
      return {
        status: "error",
        errorCode: "CURSOR_ERROR",
        text: "",
        sources: [],
        fanouts: [],
        ads: [],
        products: [],
        maps: [],
        features: [],
        raw: { error: String(err), via: "cursor_sdk", model },
        meta: {
          modelReported: model,
          latencyMs: Date.now() - t0,
          surfaceKind: "api",
        },
      };
    }
  }
}
