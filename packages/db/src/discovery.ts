import {
  coverageOverview,
  extractBrandProfile,
  generateDiscoveryPrompts,
  parsePromptsCsv,
  suggestCompetitors,
  suggestTopics,
  classifyBranding,
  classifyPromptIntent,
  promptVolumeScore,
  type BrandProfile,
  type DiscoveredPrompt,
} from "@geo/core";
import { newId, type Prompt, type Topic } from "./schema.js";
import { getDemoStore, type DemoStore } from "./seed.js";

const profiles = new Map<string, BrandProfile>();

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
  return next;
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
    const host = patch.domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]!
      .toLowerCase();
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
  return store.topics;
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
    trackedNames: store.brands.map((b) => b.name),
  }).filter((s) => !rejected.has(s.name.toLowerCase()));
  return suggestions;
}

export function rejectCompetitor(store: DemoStore, name: string) {
  store.rejectedCompetitorNames.push(name);
}

export function acceptCompetitor(store: DemoStore, name: string) {
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
  return store.brands;
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
  if (
    store.brands.some((b) => b.name.toLowerCase() === name.toLowerCase())
  ) {
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
          p.text.toLowerCase() === item.text.toLowerCase() &&
          p.country_code === item.country_code,
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
  }
  return created;
}

export function importPromptsCsv(store: DemoStore, csv: string) {
  const profile = getOrCreateProfile(store);
  const rows = parsePromptsCsv(csv);
  const created: Prompt[] = [];
  for (const row of rows) {
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
  }
  return created;
}

export async function ensureDemoStore(projectId: string) {
  const store = await getDemoStore();
  if (store.project.id !== projectId) return null;
  return store;
}

export { extractBrandProfile, suggestTopics };
