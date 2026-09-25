import {
  buildAnalysisPromptPanel,
  coverageOverview,
  extractBrandProfile,
  generateDiscoveryPrompts,
  inferMarketFromDomain,
  parsePromptsCsv,
  suggestCompetitors,
  suggestTopics,
  classifyBranding,
  classifyPromptIntent,
  countryDisplayName,
  promptVolumeScore,
  type BrandProfile,
  type DiscoveredPrompt,
} from "@geo/core";
import {
  bindPromptToAnalysisScope,
  promptIdentity,
  uniqueActivePrompts,
} from "./promptIdentity.js";
import { newId, type Prompt, type Topic } from "./schema.js";
import { type DemoStore, getDemoStore } from "./seed.js";

const profiles = new Map<string, BrandProfile>();
const PROMPT_STRATEGY_VERSION = "profile-buying-situations-v2";

function normalizeProfile(raw: BrandProfile): BrandProfile {
  return {
    ...raw,
    description: raw.description ?? raw.tagline ?? "",
    identityTags: raw.identityTags ?? [],
    targetMarkets: raw.targetMarkets ?? [],
    products: raw.products ?? [],
    personas: raw.personas ?? [],
  };
}

export function getOrCreateProfile(store: DemoStore): BrandProfile {
  const existing = profiles.get(store.project.id) ?? store.brandProfile;
  const next = normalizeProfile(existing as BrandProfile);
  profiles.set(store.project.id, next);
  store.brandProfile = next;
  return next;
}

export function saveBrandProfile(
  store: DemoStore,
  patch: Partial<BrandProfile>,
): BrandProfile {
  const cur = getOrCreateProfile(store);
  const next = normalizeProfile({ ...cur, ...patch });
  store.brandProfile = next;
  profiles.set(store.project.id, next);
  if (
    store.analysisScope &&
    ["industry", "targetMarkets", "products", "personas"].some(
      (key) => key in patch,
    )
  ) {
    // The next Analyze call must build a fresh immutable prompt version from
    // the reviewed discovery inputs. Historical prompt evidence stays intact.
    store.analysisScope.promptStrategyVersion = undefined;
  }
  return next;
}

/** Normalize a typed URL/host into a bare domain (lowercase, no scheme/www/path). */
export function normalizeDomain(input: string): string | null {
  const host = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]!
    .split("?")[0]!
    .split("#")[0]!
    .replace(/:\d+$/, "")
    .toLowerCase();
  if (!host || host.length < 2) return null;
  // Allow localhost and dotted hosts; reject spaces / protocol leftovers
  if (/\s/.test(host) || host.includes("://")) return null;
  return host;
}

export function brandNameFromDomain(domain: string): string {
  const base = (domain.split(".")[0] ?? domain).replace(/[-_]+/g, " ");
  if (!base) return domain;
  return base
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Bind a project to a website: set domain, sync brand profile + own brand name.
 * Used by the Semrush-style “Enter domain → Analyze” flow.
 */
export function analyzeProjectDomain(store: DemoStore, rawDomain: string) {
  const domain = normalizeDomain(rawDomain);
  if (!domain) {
    const err = new Error("Enter a valid website domain (e.g. warbyparker.com).");
    (err as Error & { code?: string }).code = "invalid_domain";
    throw err;
  }
  const brandName = brandNameFromDomain(domain);
  const project = updateProjectSettings(store, {
    domain,
    name: `${brandName} Visibility`,
  });
  saveBrandProfile(store, {
    domain,
    name: brandName,
  });
  const ownExisting = store.brands.find((b) => b.is_own);
  if (ownExisting) {
    try {
      updateBrand(store, ownExisting.id, { name: brandName });
    } catch {
      /* keep existing own brand name on collision */
    }
  } else {
    const id = newId("br");
    for (const b of store.brands) b.is_own = false;
    store.brands.unshift({
      id,
      project_id: store.project.id,
      name: brandName,
      is_own: true,
      aliases: [],
      patterns: [],
    });
  }
  const own = store.brands.find((b) => b.is_own);
  if (own) {
    own.aliases = Array.from(
      new Set([...(own.aliases ?? []), brandName.toLowerCase(), domain]),
    );
  }
  return {
    project,
    domain,
    brand_name: brandName,
    own_brand_id: own?.id ?? null,
  };
}

const INDUSTRY_COMPETITORS: Record<string, string[]> = {
  "B2B CRM / sales software": [
    "Salesforce",
    "HubSpot",
    "Pipedrive",
    "Zoho CRM",
  ],
  "AI models / infrastructure": [
    "OpenAI",
    "Anthropic",
    "Together AI",
    "Groq",
    "Fireworks",
  ],
  "E-commerce": ["Nike", "Adidas", "Allbirds", "Everlane", "Shopify"],
  Fintech: ["Stripe", "PayPal", "Square", "Wise"],
  "Secured consumer lending": [
    "Bajaj Finance",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
  ],
  Eyewear: ["Warby Parker", "LensCrafters", "Zenni", "GlassesUSA"],
  Apparel: ["Nike", "Adidas", "Everlane", "Uniqlo", "Zara"],
  "Fintech IN": ["Groww", "Zerodha", "Paytm", "PhonePe"],
  "Search & productivity platforms": ["Microsoft", "Apple", "Amazon", "Meta"],
  default: ["Google", "Microsoft", "Amazon", "Apple"],
};

function competitorPoolForProfile(industry: string, domain: string): string[] {
  const host = domain.toLowerCase();
  const market = inferMarketFromDomain(domain);
  if (industry === "Secured consumer lending") {
    return INDUSTRY_COMPETITORS["Secured consumer lending"]!;
  }
  if (market.country === "IN" && (industry === "Fintech" || /fin|pay|bank/.test(host))) {
    return INDUSTRY_COMPETITORS["Fintech IN"]!;
  }
  if (/warby|zenni|glasses|optics|eyewear|lens/.test(host + industry)) {
    return INDUSTRY_COMPETITORS.Eyewear!;
  }
  if (industry === "Search & productivity platforms") {
    return INDUSTRY_COMPETITORS["Search & productivity platforms"]!;
  }
  if (/shop|store|commerce|allbirds|nike/.test(host + industry)) {
    return INDUSTRY_COMPETITORS["E-commerce"]!;
  }
  if (
    industry.startsWith("AI") ||
    /router|openai|anthropic|groq|mistral|together|fireworks/.test(host)
  ) {
    return INDUSTRY_COMPETITORS["AI models / infrastructure"]!;
  }
  if (industry.includes("CRM") || industry.includes("sales software")) {
    return INDUSTRY_COMPETITORS["B2B CRM / sales software"]!;
  }
  if (INDUSTRY_COMPETITORS[industry]) {
    return INDUSTRY_COMPETITORS[industry]!;
  }
  return INDUSTRY_COMPETITORS.default!;
}

/**
 * Bind a domain and add a new prompt version for collection. Historical
 * prompts, answers, failures, mentions, and sources remain immutable.
 */
export function prepareDomainAnalysis(
  store: DemoStore,
  rawDomain: string,
  opts?: { prompt_limit?: number },
) {
  const requestedDomain = normalizeDomain(rawDomain);
  const existingPanel = uniqueActivePrompts(store);
  const scopedPromptIds = new Set(store.analysisScope?.promptIds ?? []);
  const coherentExistingPanel =
    existingPanel.length > 0 &&
    scopedPromptIds.size > 0 &&
    existingPanel.every((prompt) => scopedPromptIds.has(prompt.id));
  if (
    requestedDomain &&
    store.analysisScope?.domain === requestedDomain &&
    store.analysisScope.promptStrategyVersion === PROMPT_STRATEGY_VERSION &&
    coherentExistingPanel
  ) {
    const own = store.brands.find((brand) => brand.is_own);
    return {
      project: store.project, domain: requestedDomain,
      brand_name: own?.name ?? getOrCreateProfile(store).name,
      own_brand_id: own?.id ?? null,
      prompts_activated: existingPanel.length,
      competitor_count: currentAnalysisBrands(store).filter((brand) => !brand.is_own).length,
      profile: getOrCreateProfile(store),
    };
  }
  const previousProfile = getOrCreateProfile(store);
  const preserveReviewedProfile =
    previousProfile.reviewed &&
    normalizeDomain(previousProfile.domain) === requestedDomain;
  const bound = analyzeProjectDomain(store, rawDomain);
  const profile = preserveReviewedProfile
    ? { ...previousProfile, domain: bound.domain }
    : extractBrandProfile(bound.domain);
  const market = inferMarketFromDomain(bound.domain);
  const slug = bound.domain.split(".")[0]!.toLowerCase();
  const pool = competitorPoolForProfile(profile.industry, bound.domain);
  const canonicalOwn =
    pool.find(
      (n) => n.toLowerCase().replace(/[^a-z0-9]/g, "") === slug,
    ) ?? bound.brand_name;

  profile.name = canonicalOwn;
  profile.domain = bound.domain;
  const marketCodeByName: Record<string, string> = {
    india: "IN",
    "united states": "US",
    usa: "US",
    "united kingdom": "GB",
    uk: "GB",
    canada: "CA",
    australia: "AU",
    singapore: "SG",
    germany: "DE",
    france: "FR",
  };
  const configuredMarkets = profile.targetMarkets
    .map((value) => {
      const normalized = value.trim().toLowerCase();
      if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase();
      return marketCodeByName[normalized];
    })
    .filter((value): value is string => Boolean(value));
  const marketCodes = Array.from(
    new Set([market.country, ...configuredMarkets]),
  ).slice(0, 4);
  profile.targetMarkets = marketCodes.map(countryDisplayName);
  saveBrandProfile(store, profile);

  // Keep the stable own-brand identity so historical mentions retain lineage.
  const own = store.brands.find((b) => b.is_own);
  if (own) {
    try {
      updateBrand(store, own.id, {
        name: canonicalOwn,
        aliases: Array.from(
          new Set([
            canonicalOwn.toLowerCase(),
            slug,
            bound.domain,
            canonicalOwn.replace(/\s+/g, "").toLowerCase(),
          ]),
        ),
        patterns: [
          // Match "WarbyParker" / "Warby Parker" style variants
          canonicalOwn.replace(/\s+/g, "\\s*"),
        ],
      });
    } catch {
      own.name = canonicalOwn;
    }
  } else {
    createBrand(store, {
      name: canonicalOwn,
      is_own: true,
      aliases: [slug, bound.domain],
      patterns: [canonicalOwn.replace(/\s+/g, "\\s*")],
    });
  }

  const competitors = pool.filter(
    (n) =>
      n.toLowerCase().replace(/[^a-z0-9]/g, "") !==
      canonicalOwn.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const activeBrandIds = new Set<string>();
  const currentOwn = store.brands.find((brand) => brand.is_own);
  if (currentOwn) activeBrandIds.add(currentOwn.id);
  for (const name of competitors.slice(0, 4)) {
    const existing = store.brands.find(
      (b) => b.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      activeBrandIds.add(existing.id);
      continue;
    }
    const created = createBrand(store, {
      name,
      is_own: false,
      aliases: [name.toLowerCase()],
    });
    activeBrandIds.add(created.id);
  }

  // Archive the prior prompt version. Never delete a prompt referenced by
  // historical evidence.
  for (const prompt of store.prompts) {
    if (prompt.status === "active") prompt.status = "archived";
  }
  updateProjectSettings(store, {
    default_country: market.country,
    location: market.location,
    timezone: timezoneForCountry(market.country),
  });
  const limit = Math.max(1, Math.min(opts?.prompt_limit ?? 8, 12));
  const seedRows = buildAnalysisPromptPanel({
    profile,
    countries: marketCodes,
    limit,
  });
  const topicIds = new Map<string, string>();
  for (const seed of seedRows) {
    const topic =
      store.topics.find(
        (candidate) => candidate.name.toLowerCase() === seed.topic.toLowerCase(),
      ) ?? createTopic(store, seed.topic);
    topicIds.set(seed.topic.toLowerCase(), topic.id);
  }
  store.analysisScope = {
    domain: bound.domain,
    promptStrategyVersion: PROMPT_STRATEGY_VERSION,
    brandIds: [...activeBrandIds],
    topicIds: [...new Set(topicIds.values())],
    promptIds: [],
    startedAt: new Date().toISOString(),
  };
  const activated = [];
  for (const seed of seedRows) {
    const row = {
      id: newId("pr"),
      project_id: store.project.id,
      text: seed.text.slice(0, 200),
      country_code: seed.country_code,
      topic_id: topicIds.get(seed.topic.toLowerCase()),
      status: "active" as const,
      branding: seed.branding,
      intent_type: seed.intent_type,
      volume_score: seed.volume_score,
      persona: seed.persona,
    };
    store.prompts.push(row);
    activated.push(row);
  }
  store.analysisScope.promptIds = activated.map((prompt) => prompt.id);

  // Keep project name in sync
  updateProjectSettings(store, {
    name: `${canonicalOwn} Visibility`,
    domain: bound.domain,
  });

  return {
    project: store.project,
    domain: bound.domain,
    brand_name: canonicalOwn,
    own_brand_id: store.brands.find((b) => b.is_own)?.id ?? null,
    prompts_activated: activated.length,
    competitor_count: [...activeBrandIds].filter(
      (id) => !store.brands.find((brand) => brand.id === id)?.is_own,
    ).length,
    profile,
  };
}

function timezoneForCountry(country: string): string {
  const zones: Record<string, string> = {
    IN: "Asia/Kolkata",
    US: "America/New_York",
    GB: "Europe/London",
    CA: "America/Toronto",
    AU: "Australia/Sydney",
    SG: "Asia/Singapore",
    DE: "Europe/Berlin",
    FR: "Europe/Paris",
  };
  return zones[country.toUpperCase()] ?? "UTC";
}

export function updateProjectSettings(
  store: DemoStore,
  patch: {
    name?: string;
    domain?: string;
    location?: string;
    language?: string;
    timezone?: string;
    default_country?: string;
  },
) {
  if (patch.name != null) store.project.name = patch.name.trim() || store.project.name;
  if (patch.domain != null) {
    const host = normalizeDomain(patch.domain) ?? undefined;
    store.project.domain = host || undefined;
  }
  if (patch.location != null) store.project.location = patch.location.trim() || undefined;
  if (patch.language != null) store.project.language = patch.language.trim() || "en";
  if (patch.timezone != null) store.project.timezone = patch.timezone.trim() || "UTC";
  if (patch.default_country != null) {
    store.project.default_country = patch.default_country
      .trim()
      .toUpperCase()
      .slice(0, 2) || "US";
  }
  return store.project;
}

export function listTopics(store: DemoStore) {
  const ids = store.analysisScope?.topicIds;
  return ids ? store.topics.filter((topic) => ids.includes(topic.id)) : store.topics;
}

export function createTopic(store: DemoStore, name: string): Topic {
  const topic: Topic = {
    id: newId("tpc"),
    project_id: store.project.id,
    name: name.trim(),
  };
  store.topics.push(topic);
  return topic;
}

export function listTags(store: DemoStore) {
  return store.tags;
}

export function competitorSuggestions(store: DemoStore) {
  const rejected = new Set(
    store.rejectedCompetitorNames.map((n) => n.toLowerCase()),
  );
  const suggestions = suggestCompetitors({
    chatTexts: store.chats.map((c) => c.text),
    trackedNames: currentAnalysisBrands(store).map((b) => b.name),
  }).filter((s) => !rejected.has(s.name.toLowerCase()));
  return suggestions;
}

export function rejectCompetitor(store: DemoStore, name: string) {
  store.rejectedCompetitorNames.push(name);
}

export function acceptCompetitor(store: DemoStore, name: string) {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const existing = store.brands.find((b) => slug(b.name) === slug(name));
  if (existing) return existing;
  const id = newId("br");
  store.brands.push({
    id,
    project_id: store.project.id,
    name,
    is_own: false,
    aliases: [],
    patterns: [],
  });
  return store.brands[store.brands.length - 1]!;
}

export function listBrands(store: DemoStore) {
  return currentAnalysisBrands(store);
}

export function currentAnalysisBrands(store: DemoStore) {
  const ids = store.analysisScope?.brandIds;
  return ids ? store.brands.filter((brand) => ids.includes(brand.id)) : store.brands;
}

export function createBrand(
  store: DemoStore,
  input: {
    name: string;
    is_own?: boolean;
    aliases?: string[];
    patterns?: string[];
  },
) {
  const name = input.name.trim();
  if (!name) throw new Error("brand_name_required");
  // Compare on a normalized slug so "Warby Parker" and "warbyparker" collide.
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (store.brands.some((b) => slug(b.name) === slug(name))) {
    throw new Error("brand_name_exists");
  }
  if (input.is_own) {
    for (const b of store.brands) b.is_own = false;
  }
  const brand = {
    id: newId("br"),
    project_id: store.project.id,
    name,
    is_own: Boolean(input.is_own),
    aliases: (input.aliases ?? []).map((a) => a.trim()).filter(Boolean),
    patterns: (input.patterns ?? []).map((p) => p.trim()).filter(Boolean),
  };
  store.brands.push(brand);
  return brand;
}

export function updateBrand(
  store: DemoStore,
  brandId: string,
  patch: {
    name?: string;
    is_own?: boolean;
    aliases?: string[];
    patterns?: string[];
  },
) {
  const brand = store.brands.find((b) => b.id === brandId);
  if (!brand) return null;
  if (patch.name != null) {
    const name = patch.name.trim();
    if (!name) throw new Error("brand_name_required");
    if (
      store.brands.some(
        (b) => b.id !== brandId && b.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new Error("brand_name_exists");
    }
    brand.name = name;
  }
  if (patch.is_own === true) {
    for (const b of store.brands) b.is_own = b.id === brandId;
  } else if (patch.is_own === false) {
    brand.is_own = false;
  }
  if (patch.aliases) {
    brand.aliases = patch.aliases.map((a) => a.trim()).filter(Boolean);
  }
  if (patch.patterns) {
    brand.patterns = patch.patterns.map((p) => p.trim()).filter(Boolean);
  }
  return brand;
}

export function deleteBrand(store: DemoStore, brandId: string) {
  const idx = store.brands.findIndex((b) => b.id === brandId);
  if (idx < 0) return false;
  const [removed] = store.brands.splice(idx, 1);
  if (removed?.is_own && store.brands[0]) {
    store.brands[0].is_own = true;
  }
  return true;
}

export function runDiscovery(store: DemoStore, input: {
  countries?: string[];
  topics?: string[];
  brandedShare?: number;
}) {
  const profile = getOrCreateProfile(store);
  const topicNames =
    input.topics ??
    suggestTopics(profile).map((t) => t.name);
  const prompts = generateDiscoveryPrompts({
    profile,
    countries: input.countries ?? [store.project.default_country, "GB"],
    language: store.project.language,
    topics: topicNames,
    brandedShare: input.brandedShare ?? 0.2,
    intentMix: {
      informational: 0.25,
      commercial: 0.5,
      transactional: 0.25,
    },
  });
  const accepted = new Set(
    store.prompts.filter((p) => p.status === "active").map((p) => p.text),
  );
  return {
    topics: suggestTopics(profile),
    prompts,
    coverage: coverageOverview(prompts, accepted),
  };
}

export function activateDiscoveredPrompts(
  store: DemoStore,
  items: DiscoveredPrompt[],
) {
  const created: Prompt[] = [];
  for (const item of items) {
    let topic = store.topics.find(
      (t) => t.name.toLowerCase() === item.topic.toLowerCase(),
    );
    if (!topic) {
      topic = createTopic(store, item.topic);
    }
    if (
      store.prompts.some(
        (p) =>
          p.status === "active" && promptIdentity(p.text, p.country_code) ===
          promptIdentity(item.text.slice(0, 200), item.country_code),
      )
    ) {
      continue;
    }
    const row: Prompt = {
      id: newId("pr"),
      project_id: store.project.id,
      text: item.text.slice(0, 200),
      country_code: item.country_code,
      topic_id: topic.id,
      status: "active",
      branding: item.branding,
      intent_type: item.intent_type,
      volume_score: item.volume_score,
      persona: item.persona,
    };
    store.prompts.push(row);
    created.push(row);
    bindPromptToAnalysisScope(store, row.id);
  }
  return created;
}

export function importPromptsCsv(store: DemoStore, csv: string) {
  const profile = getOrCreateProfile(store);
  const rows = parsePromptsCsv(csv);
  const created: Prompt[] = [];
  for (const row of rows) {
    if (store.prompts.some((p) => p.status === "active" &&
      promptIdentity(p.text, p.country_code) === promptIdentity(row.text, row.country_code))) continue;
    let topicId: string | undefined;
    if (row.topic) {
      let topic = store.topics.find(
        (t) => t.name.toLowerCase() === row.topic!.toLowerCase(),
      );
      if (!topic) topic = createTopic(store, row.topic);
      topicId = topic.id;
    }
    const prompt: Prompt = {
      id: newId("pr"),
      project_id: store.project.id,
      text: row.text,
      country_code: row.country_code,
      topic_id: topicId,
      status: "active",
      branding: classifyBranding(row.text, profile.name),
      intent_type: classifyPromptIntent(row.text),
      volume_score: promptVolumeScore(
        row.text,
        row.country_code,
        profile.industry,
      ),
    };
    store.prompts.push(prompt);
    created.push(prompt);
    bindPromptToAnalysisScope(store, prompt.id);
  }
  return created;
}

export async function ensureDemoStore(projectId: string) {
  const store = await getDemoStore();
  if (store.project.id !== projectId) return null;
  return store;
}

export { extractBrandProfile, suggestTopics };
