import { getChannel } from "@geo/registry";
import type {
  EngineAdapter,
  EngineRequest,
  EngineResponse,
  RawSource,
} from "../types.js";
import {
  DEFAULT_WORLD,
  effectiveStrength,
  type SimBrand,
  type SimWorld,
} from "./world.js";

/** FNV-1a 32-bit hash for deterministic seeding. */
function hash32(...parts: string[]): number {
  let h = 0x811c9dc5;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dayIndex(runDate: string): number {
  const t0 = Date.UTC(2025, 0, 1);
  const t = Date.parse(runDate + "T00:00:00Z");
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((t - t0) / 86_400_000));
}

function topicOf(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("analytics") || p.includes("reporting")) return "analytics";
  return "crm";
}

function sampleByStrength(
  brands: SimBrand[],
  topic: string,
  day: number,
  rng: () => number,
  k: number,
): SimBrand[] {
  const pool = brands.map((b) => ({
    b,
    w: effectiveStrength(b, topic, day),
  }));
  const picked: SimBrand[] = [];
  const remaining = [...pool];
  const n = Math.min(k, remaining.length);
  for (let i = 0; i < n; i++) {
    const total = remaining.reduce((s, x) => s + x.w, 0);
    let r = rng() * total;
    let idx = 0;
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j]!.w;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picked.push(remaining[idx]!.b);
    remaining.splice(idx, 1);
  }
  return picked;
}

function shuffleWeighted(
  brands: SimBrand[],
  topic: string,
  day: number,
  rng: () => number,
  temperature: number,
): SimBrand[] {
  return [...brands]
    .map((b) => ({
      b,
      key:
        Math.pow(effectiveStrength(b, topic, day), 1 / temperature) *
        (0.5 + rng()),
    }))
    .sort((a, c) => c.key - a.key)
    .map((x) => x.b);
}

const ADJECTIVES_POS = ["leading", "reliable", "recommended", "strong"];
const ADJECTIVES_NEG = ["limited", "expensive", "outdated"];

function renderAnswer(
  ordered: SimBrand[],
  world: SimWorld,
  rng: () => number,
): string {
  const parts = ordered.map((b, i) => {
    const mean = b.sentimentMean;
    const pool = mean >= 0 ? ADJECTIVES_POS : ADJECTIVES_NEG;
    const adj = pool[Math.floor(rng() * pool.length)]!;
    if (i === 0) return `${b.name} is often described as a ${adj} option`;
    return `while ${b.name} is a ${adj} alternative`;
  });
  return parts.join(", ") + " for teams evaluating this category.";
}

function drawSources(world: SimWorld, rng: () => number): RawSource[] {
  const count = 3 + Math.floor(rng() * 5);
  const sources: RawSource[] = [];
  const forceSameDomain = rng() < 0.2;
  let forcedDomain: string | null = null;

  for (let i = 0; i < count; i++) {
    let domain: string;
    if (forceSameDomain && i > 0 && forcedDomain) {
      domain = forcedDomain;
    } else {
      const total = world.domains.reduce((s, d) => s + d.weight, 0);
      let r = rng() * total;
      domain = world.domains[0]!.domain;
      for (const d of world.domains) {
        r -= d.weight;
        if (r <= 0) {
          domain = d.domain;
          break;
        }
      }
      if (i === 0) forcedDomain = domain;
    }
    const cited = rng() < 0.55;
    const citationCount = cited ? 1 + Math.floor(rng() * 2) : 0;
    sources.push({
      url: `https://${domain}/article/${Math.floor(rng() * 9000) + 1000}`,
      title: `Guide on ${domain}`,
      cited,
      citationCount,
      citationPosition: cited ? i + 1 : undefined,
      retrievalRank: i + 1,
    });
  }
  return sources;
}

export class SimulatorAdapter implements EngineAdapter {
  readonly channelId = "sim-0";
  readonly surfaceKind = "simulator" as const;
  readonly capabilities = {
    fanouts: true,
    ads: true,
    shopping: true,
    maps: false,
    geo: "full" as const,
    citationsDistinctFromSources: true,
  };

  constructor(private readonly world: SimWorld = DEFAULT_WORLD) {}

  async health() {
    return { ok: true, detail: "simulator" };
  }

  async run(req: EngineRequest): Promise<EngineResponse> {
    const seed = hash32(
      req.seed ?? "demo",
      req.prompt,
      req.channelId,
      req.countryCode,
      req.runDate,
    );
    const rng = mulberry32(seed);
    const day = dayIndex(req.runDate);
    const topic = topicOf(req.prompt);
    const channel = getChannel(req.channelId);
    const searchRate = this.world.searchRate;

    // Failure modes ~1.5% error, ~0.5% blocked, ~3% empty
    const roll = rng();
    if (roll < 0.015) {
      return this.fail("error", "SIM_ERROR", rng);
    }
    if (roll < 0.02) {
      return this.fail("blocked", "SIM_BLOCKED", rng);
    }
    if (roll < 0.05) {
      return this.fail("empty", undefined, rng);
    }

    const didSearch = rng() < searchRate;
    const k = 3 + Math.floor(rng() * 5);
    const appearing = sampleByStrength(this.world.brands, topic, day, rng, k);
    const ordered = shuffleWeighted(appearing, topic, day, rng, 0.35);
    const text = renderAnswer(ordered, this.world, rng);
    const sources = didSearch ? drawSources(this.world, rng) : [];

    const fanouts =
      didSearch && (channel?.supportsFanouts ?? true)
        ? Array.from({ length: 3 + Math.floor(rng() * 10) }, (_, i) => ({
            text: `${req.prompt} variant ${i + 1}`,
            type: "search" as const,
          }))
        : [];

    const ads =
      (channel?.supportsAds ?? true) && rng() < 0.12
        ? [
            {
              advertiserName: ordered[0]?.name ?? "Acme",
              adUnitType: "sponsored_brand",
              targetUrl: "https://ads.example/landing",
              cards: [
                {
                  title: "Try it free",
                  targetUrl: "https://ads.example/landing",
                },
              ],
            },
          ]
        : [];

    return {
      status: "ok",
      text,
      sources,
      fanouts,
      ads,
      products: [],
      maps: [],
      features: didSearch ? [{ type: "web_search" }] : [],
      raw: { seed, day, topic, brandIds: ordered.map((b) => b.id) },
      meta: {
        modelReported: "simulator-v1",
        latencyMs: Math.floor(20 + rng() * 80),
        surfaceKind: "simulator",
      },
    };
  }

  private fail(
    status: "error" | "blocked" | "empty",
    errorCode: string | undefined,
    rng: () => number,
  ): EngineResponse {
    return {
      status,
      errorCode,
      text: "",
      sources: [],
      fanouts: [],
      ads: [],
      products: [],
      maps: [],
      features: [],
      raw: { status },
      meta: {
        modelReported: "simulator-v1",
        latencyMs: Math.floor(10 + rng() * 40),
        surfaceKind: "simulator",
      },
    };
  }
}
