/**
 * Phase 3 — organization & discovery (deterministic / offline).
 * Spec §7.11, §7.12, §7.1.3, §15.5.
 */

export type IntentType = "informational" | "commercial" | "transactional";
export type Branding = "branded" | "non-branded";

export interface BrandProfile {
  domain: string;
  name: string;
  industry: string;
  tagline: string;
  /** Longer brand description for onboarding / discovery. */
  description: string;
  /** Identity tags shown in Peec-style profile (e.g. "B2B", "SaaS"). */
  identityTags: string[];
  /** Target market labels (e.g. "United States", "United Kingdom"). */
  targetMarkets: string[];
  products: string[];
  personas: string[];
  reviewed: boolean;
}

export interface TopicSuggestion {
  name: string;
  reason: string;
}

export interface DiscoveredPrompt {
  text: string;
  country_code: string;
  topic: string;
  branding: Branding;
  intent_type: IntentType;
  persona: string;
  volume_score: number;
}

export interface DiscoverySetup {
  profile: BrandProfile;
  countries: string[];
  language: string;
  topics: string[];
  brandedShare: number; // 0–1, default 0.2
  intentMix: {
    informational: number;
    commercial: number;
    transactional: number;
  };
}

/** Offline brand profile from domain — no network (simulator path). */
export function extractBrandProfile(domain: string): BrandProfile {
  const host = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]!
    .toLowerCase();
  const slug = host.split(".")[0] ?? "brand";
  const name = slug.charAt(0).toUpperCase() + slug.slice(1);

  const industry =
    /crm|sales|hub/.test(slug) || host.includes("acme")
      ? "B2B CRM / sales software"
      : /shop|store|commerce/.test(slug)
        ? "E-commerce"
        : /pay|fin|bank/.test(slug)
          ? "Fintech"
          : "B2B software";

  const products =
    industry.includes("CRM")
      ? ["Pipeline", "Contacts", "Reporting"]
      : ["Platform", "Analytics", "Integrations"];

  return {
    domain: host,
    name,
    industry,
    tagline: `${name} helps teams work faster in ${industry.toLowerCase()}.`,
    description: `${name} is a ${industry.toLowerCase()} company helping teams choose and use the right tools.`,
    identityTags: industry.includes("CRM")
      ? ["B2B", "SaaS", "Sales"]
      : industry.includes("commerce")
        ? ["E-commerce", "Retail"]
        : ["B2B", "Software"],
    targetMarkets: ["United States"],
    products,
    personas: ["Agency owner", "RevOps lead", "Founder"],
    reviewed: false,
  };
}

export function suggestTopics(profile: BrandProfile): TopicSuggestion[] {
  const base = [
    { name: "Category alternatives", reason: "Unbranded consideration set" },
    { name: "Pricing & plans", reason: "Commercial intent coverage" },
    { name: "Comparisons", reason: "Competitive head-to-heads" },
    { name: `${profile.name} reviews`, reason: "Branded demand" },
    { name: "Integrations", reason: "Transactional / evaluation" },
    { name: "Best for agencies", reason: "Persona: agency owner" },
  ];
  if (profile.industry.includes("CRM")) {
    base.push({ name: "Sales analytics", reason: "Product adjacency" });
  }
  return base;
}

/** Deterministic offline keyword volume (§7.12). */
export function promptVolumeScore(
  text: string,
  countryCode: string,
  industry: string,
): number {
  const themes = extractThemes(text);
  let raw = 0;
  for (const theme of themes) {
    const vol = offlineSearchVolume(theme, countryCode);
    const weight = relevanceWeight(theme, industry);
    raw += vol * weight;
  }
  // Pseudo industry cohort percentiles from hash of industry
  const cohort = industryCohort(industry, countryCode);
  const pct = percentileOf(raw, cohort);
  if (pct < 0.2) return 1;
  if (pct < 0.4) return 2;
  if (pct < 0.6) return 3;
  if (pct < 0.8) return 4;
  return 5;
}

export function extractThemes(text: string): string[] {
  const stop = new Set([
    "the",
    "a",
    "an",
    "for",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "with",
    "best",
    "what",
    "which",
    "how",
    "do",
    "does",
    "is",
    "are",
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  return [...new Set(words)].slice(0, 5);
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function offlineSearchVolume(theme: string, country: string): number {
  const h = hash32(`${theme}|${country}`);
  return 50 + (h % 950);
}

function relevanceWeight(theme: string, industry: string): number {
  const ind = industry.toLowerCase();
  if (ind.includes(theme) || theme.includes("crm") || theme.includes("sales")) {
    return 1.4;
  }
  if (["best", "top", "software", "tool", "app"].includes(theme)) return 0.6;
  return 1.0;
}

function industryCohort(industry: string, country: string): number[] {
  const seed = hash32(`${industry}|${country}|cohort`);
  const points: number[] = [];
  let x = seed;
  for (let i = 0; i < 100; i++) {
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
    points.push(100 + (x % 4000));
  }
  return points.sort((a, b) => a - b);
}

function percentileOf(raw: number, cohort: number[]): number {
  let below = 0;
  for (const v of cohort) if (v < raw) below++;
  return below / cohort.length;
}

export function classifyPromptIntent(text: string): IntentType {
  const t = text.toLowerCase();
  if (/buy|pricing|price|plan|cost|sign up|trial/.test(t)) return "transactional";
  if (/vs|versus|compare|alternative|best|top/.test(t)) return "commercial";
  return "informational";
}

export function classifyBranding(text: string, brandName: string): Branding {
  const re = new RegExp(`\\b${escapeRe(brandName)}\\b`, "i");
  return re.test(text) ? "branded" : "non-branded";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generate a balanced prompt set from discovery setup (§15.5 distribution).
 */
export function generateDiscoveryPrompts(
  setup: DiscoverySetup,
): DiscoveredPrompt[] {
  const { profile, countries, topics, brandedShare, intentMix } = setup;
  const out: DiscoveredPrompt[] = [];
  const templates: Record<IntentType, string[]> = {
    informational: [
      "what is {topic} software",
      "how does {topic} work for teams",
      "{topic} explained for beginners",
    ],
    commercial: [
      "best {topic} tools in 2026",
      "{topic} alternatives for agencies",
      "top {topic} platforms compared",
    ],
    transactional: [
      "{topic} pricing plans",
      "cheapest {topic} software",
      "start a {topic} free trial",
    ],
  };
  const brandedTemplates = [
    `${profile.name} review`,
    `${profile.name} pricing`,
    `${profile.name} vs competitors`,
    `is ${profile.name} good for agencies`,
  ];

  for (const country of countries) {
    for (const topic of topics) {
      const persona =
        profile.personas[hash32(topic + country) % profile.personas.length]!;
      // ~brandedShare branded
      const n = 5;
      for (let i = 0; i < n; i++) {
        const branded = i / n < brandedShare;
        let text: string;
        let intent: IntentType;
        let branding: Branding;
        if (branded) {
          text = brandedTemplates[i % brandedTemplates.length]!;
          intent = classifyPromptIntent(text);
          branding = "branded";
        } else {
          const roll = (i / n - brandedShare) / Math.max(0.01, 1 - brandedShare);
          intent =
            roll < intentMix.informational
              ? "informational"
              : roll < intentMix.informational + intentMix.commercial
                ? "commercial"
                : "transactional";
          const pool = templates[intent];
          text = pool[i % pool.length]!.replace(/\{topic\}/g, topic.toLowerCase());
          branding = "non-branded";
        }
        out.push({
          text,
          country_code: country,
          topic,
          branding,
          intent_type: intent,
          persona,
          volume_score: promptVolumeScore(text, country, profile.industry),
        });
      }
    }
  }
  return out;
}

export interface CoverageCell {
  key: string;
  dimension: "topic" | "country" | "persona" | "branding" | "intent";
  accepted: number;
  suggested: number;
  status: "On target" | "Not started" | "Partial";
}

export function coverageOverview(
  suggested: DiscoveredPrompt[],
  acceptedTexts: Set<string>,
): CoverageCell[] {
  const dims: Array<{
    dimension: CoverageCell["dimension"];
    pick: (p: DiscoveredPrompt) => string;
  }> = [
    { dimension: "topic", pick: (p) => p.topic },
    { dimension: "country", pick: (p) => p.country_code },
    { dimension: "persona", pick: (p) => p.persona },
    { dimension: "branding", pick: (p) => p.branding },
    { dimension: "intent", pick: (p) => p.intent_type },
  ];
  const cells: CoverageCell[] = [];
  for (const { dimension, pick } of dims) {
    const keys = [...new Set(suggested.map(pick))];
    for (const key of keys) {
      const group = suggested.filter((p) => pick(p) === key);
      const accepted = group.filter((p) => acceptedTexts.has(p.text)).length;
      const suggestedN = group.length;
      const status: CoverageCell["status"] =
        accepted === 0
          ? "Not started"
          : accepted >= Math.ceil(suggestedN * 0.5)
            ? "On target"
            : "Partial";
      cells.push({
        key,
        dimension,
        accepted,
        suggested: suggestedN,
        status,
      });
    }
  }
  return cells;
}

/** Suggest competitors from chat text tokens not in tracked set (§7.1.3 spirit). */
export function suggestCompetitors(input: {
  chatTexts: string[];
  trackedNames: string[];
  knownCatalog?: string[];
}): Array<{ name: string; mention_count: number; source: "chat" }> {
  const catalog =
    input.knownCatalog ??
    [
      "Salesforce",
      "HubSpot",
      "Pipedrive",
      "Zoho",
      "Monday.com",
      "Close",
      "Copper",
      "Freshsales",
      "Insightly",
      "Nutshell",
    ];
  const tracked = new Set(input.trackedNames.map((n) => n.toLowerCase()));
  const counts = new Map<string, number>();

  for (const text of input.chatTexts) {
    for (const name of catalog) {
      if (tracked.has(name.toLowerCase())) continue;
      const re = new RegExp(`\\b${escapeRe(name)}\\b`, "i");
      if (re.test(text)) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([name, mention_count]) => ({
      name,
      mention_count,
      source: "chat" as const,
    }))
    .sort((a, b) => b.mention_count - a.mention_count);
}

export function parsePromptsCsv(csv: string): Array<{
  text: string;
  country_code: string;
  topic?: string;
}> {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0]!.toLowerCase();
  const hasHeader = header.includes("text") || header.includes("prompt");
  const rows = hasHeader ? lines.slice(1) : lines;
  const out: Array<{ text: string; country_code: string; topic?: string }> = [];
  for (const line of rows) {
    const parts = splitCsvLine(line);
    const text = (parts[0] ?? "").trim();
    if (!text) continue;
    out.push({
      text: text.slice(0, 200),
      country_code: (parts[1] ?? "US").trim().toUpperCase().slice(0, 2) || "US",
      topic: parts[2]?.trim() || undefined,
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result;
}
