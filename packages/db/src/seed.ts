import { DEFAULT_API_CHANNELS, DEFAULT_WORLD, clearAdapterCache, getAdapter } from "@geo/adapters";
import {
  enrichChat,
  computeBrandMetrics,
  classifyBranding,
  classifyPromptIntent,
  extractBrandProfile,
  promptVolumeScore,
  type BrandMatcher,
  type DomainClass,
} from "@geo/core";
import { getChannel } from "@geo/registry";
import { newId, type Brand, type BrandProfileRow, type ChatAd, type ChatBrandMention, type ChatFanout, type ChatRow, type ChatSource, type Organization, type Project, type Prompt, type AppUser, type SharedView, type Tag, type Topic, type ActionRecord, type ActionStatusEvent } from "./schema.js";

export interface LogIntegration {
  id: string;
  kind: "webhook" | "file_upload" | "cloudflare";
  status: string;
  label: string;
  warning?: string;
  connected_at?: string;
}

export interface GaReferralDaily {
  provenance?: "customer_analytics_import";
  imported_at?: string;
  date: string;
  assistant: string;
  platform: string;
  source: string;
  medium: string;
  country: string;
  device: string;
  landing_page: string;
  page_path: string;
  session_starts: number;
  conversions: number;
  revenue: number;
  currency: string;
}

export interface AgentLogRowStore {
  timestamp: string;
  request_method: string;
  request_url: string;
  request_path: string;
  request_folder: string;
  response_status: number;
  user_agent: string;
  bot_token: string;
  bot_vendor: string;
  bot_type: string;
  country_code?: string;
}

export interface PerceptionObjection {
  id: string;
  label: string;
  score: number;
  member_count: number;
  phrasings: string[];
}

export interface DemoStore {
  organization: Organization;
  user: AppUser;
  project: Project;
  brands: Brand[];
  prompts: Prompt[];
  chats: ChatRow[];
  mentions: ChatBrandMention[];
  sources: ChatSource[];
  fanouts: ChatFanout[];
  ads: ChatAd[];
  topics: Topic[];
  tags: Tag[];
  brandProfile: BrandProfileRow;
  rejectedCompetitorNames: string[];
  sharedViews: SharedView[];
  sourceClassifications: Record<string, DomainClass>;
  sourceBookmarks: string[];
  actions: ActionRecord[];
  actionEvents: ActionStatusEvent[];
  robotsTxt?: string;
  robotsFetchedAt?: string;
  robotsSource?: "fetched" | "fetched_404" | "manual";
  agentLogs: AgentLogRowStore[];
  gaReferrals: GaReferralDaily[];
  logIntegrations: LogIntegration[];
  facts: import("./perception.js").FactRecord[];
  claims: import("./perception.js").ClaimRecord[];
  claimVerdicts: import("./perception.js").ClaimVerdictRecord[];
  perceptionAttributes: import("./perception.js").PerceptionAttributeRow[];
  perceptionRuns: import("./perception.js").PerceptionRunMeta[];
  perceptionObjections: PerceptionObjection[];
  products: import("./shopping.js").ProductRecord[];
  merchants: import("./shopping.js").MerchantRecord[];
  chatProducts: import("./shopping.js").ChatProductAppearance[];
  shoppingAttributes: import("./shopping.js").ShoppingAttributeCell[];
  productCategories: import("./shopping.js").ProductCategoryNode[];
  pendingCategoryDraft: { name: string; path: string; parentPath: string | null }[];
  commercial?: import("./commercial.js").CommercialState;
  auditLog?: import("./commercial.js").AuditLogEntry[];
  /** Current domain-scoped configuration. Historical rows remain in the store. */
  analysisScope?: {
    domain: string;
    brandIds: string[];
    topicIds: string[];
    /** Prompt-version ids authorized for the current analysis cohort. */
    promptIds: string[];
    startedAt: string;
  };
  /**
   * Marks the synthetic Acme/BetaSoft demo dataset. Only `buildDemoStore` sets it —
   * Postgres-backed projects stay undefined so feature reports never fabricate rows.
   */
  demo_fixtures?: boolean;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * Deterministic 90-day demo dataset. No network, no Postgres required.
 */
export async function buildDemoStore(options?: {
  days?: number;
  endDate?: string;
  seed?: string;
}): Promise<DemoStore> {
  const days = options?.days ?? 90;
  const end = options?.endDate
    ? new Date(options.endDate + "T00:00:00Z")
    : new Date("2026-09-01T00:00:00Z");
  const seed = options?.seed ?? "demo";

  const organization: Organization = {
    id: "org_demo",
    name: "Acme Analytics Demo",
    domain: "acme.example",
    timezone: "UTC",
    plan_code: "growth",
    billing_period: "monthly",
    is_agency: false,
    created_at: new Date().toISOString(),
  };

  const user: AppUser = {
    id: "usr_demo",
    email: "demo@acme.example",
    name: "Demo Owner",
    created_at: new Date().toISOString(),
  };

  const project: Project = {
    id: "prj_demo",
    organization_id: organization.id,
    name: "Acme CRM Visibility",
    domain: "acme.example",
    location: "United States",
    default_country: "US",
    language: "en",
    timezone: "UTC",
    status: "CUSTOMER",
    frequency: "daily",
    created_at: new Date().toISOString(),
  };

  const brands: Brand[] = DEFAULT_WORLD.brands.map((b) => ({
    id: b.id,
    project_id: project.id,
    name: b.name,
    is_own: b.id === "br_acme",
    aliases: b.name === "DeltaForce CRM" ? ["DeltaForce"] : [],
    patterns: [],
  }));

  const brandProfile = extractBrandProfile(project.domain ?? "acme.example");
  brandProfile.reviewed = true;

  const topicNames = [
    "Category alternatives",
    "Comparisons",
    "Pricing & plans",
    "Sales analytics",
  ];
  const topics: Topic[] = topicNames.map((name, i) => ({
    id: `tpc_demo_${i}`,
    project_id: project.id,
    name,
  }));

  const tags: Tag[] = [
    {
      id: "tag_demo_branded",
      project_id: project.id,
      name: "branded",
      group: "branding",
      is_system: true,
    },
    {
      id: "tag_demo_non",
      project_id: project.id,
      name: "non-branded",
      group: "branding",
      is_system: true,
    },
    {
      id: "tag_demo_info",
      project_id: project.id,
      name: "informational",
      group: "intentType",
      is_system: true,
    },
    {
      id: "tag_demo_comm",
      project_id: project.id,
      name: "commercial",
      group: "intentType",
      is_system: true,
    },
  ];

  const promptTexts = [
    "best CRM for a 20-person agency",
    "Acme vs BetaSoft for sales teams",
    "CRM with strong analytics and reporting",
    "affordable CRM for startups",
    "which CRM do agencies recommend in 2026",
  ];

  const prompts: Prompt[] = promptTexts.map((text, i) => {
    const country = i % 2 === 0 ? "US" : "GB";
    return {
      id: `pr_demo_${i}`,
      project_id: project.id,
      text,
      country_code: country,
      topic_id: topics[i % topics.length]!.id,
      status: "active" as const,
      branding: classifyBranding(text, "Acme"),
      intent_type: classifyPromptIntent(text),
      volume_score: promptVolumeScore(text, country, brandProfile.industry),
      persona: brandProfile.personas[i % brandProfile.personas.length],
    };
  });

  const matchers: BrandMatcher[] = brands.map((b) => ({
    brandId: b.id,
    name: b.name,
    aliases: b.aliases,
    patterns: b.patterns,
  }));

  const chats: ChatRow[] = [];
  const mentions: ChatBrandMention[] = [];
  const sources: ChatSource[] = [];
  const fanouts: ChatFanout[] = [];
  const ads: ChatAd[] = [];
  // ≥3 real API providers (fixture mode without credentials)
  const channels = [...DEFAULT_API_CHANNELS];
  // Force fixtures for deterministic seed only — do not leak into the API process.
  const prevAdapterMode = process.env.GEO_ADAPTER_MODE;
  process.env.GEO_ADAPTER_MODE = "fixture";
  clearAdapterCache();

  try {
  for (let d = 0; d < days; d++) {
    const runDate = isoDate(addDays(addDays(end, -days + 1), d));
    for (const prompt of prompts) {
      for (const channelId of channels) {
        const channelMeta = getChannel(channelId);
        const adapter = getAdapter(channelId);
        const res = await adapter.run({
          prompt: prompt.text,
          countryCode: prompt.country_code,
          channelId,
          modelId: channelMeta?.currentModel ?? channelId,
          runDate,
          seed: `${seed}|${channelId}`,
        });

        const chatId = newId("cht");
        let text = res.text;
        if (res.status === "ok" && d % 3 === 0 && channelId === "openai-1") {
          text = `${text} Teams also evaluate Salesforce and HubSpot in this category.`;
        }

        chats.push({
          id: chatId,
          project_id: project.id,
          prompt_id: prompt.id,
          model_channel_id: channelId,
          country_code: prompt.country_code,
          run_date: runDate,
          status: res.status,
          text,
          raw_uri: `memory://raw/${chatId}`,
          surface_kind: res.meta.surfaceKind,
        });

        for (const f of res.fanouts) {
          fanouts.push({
            chat_id: chatId,
            text: f.text,
            type: f.type,
          });
        }
        for (const ad of res.ads) {
          ads.push({
            chat_id: chatId,
            advertiser_name: ad.advertiserName,
            ad_unit_type: ad.adUnitType,
            target_url: ad.targetUrl,
            title: ad.cards[0]?.title ?? ad.advertiserName,
          });
        }

        if (res.status === "ok" && text) {
          const enriched = enrichChat({
            text,
            brands: matchers,
            sources: res.sources,
          });

          const byBrand = new Map<
            string,
            { count: number; position: number; sentimentSum: number }
          >();
          for (const m of enriched.mentions) {
            const cur = byBrand.get(m.brandId) ?? {
              count: 0,
              position: m.position,
              sentimentSum: 0,
            };
            cur.count += 1;
            cur.sentimentSum += m.sentiment;
            byBrand.set(m.brandId, cur);
          }
          for (const [brandId, v] of byBrand) {
            mentions.push({
              chat_id: chatId,
              brand_id: brandId,
              mention_count: v.count,
              position: v.position,
              sentiment: v.sentimentSum / v.count,
            });
          }
          for (const s of enriched.sources) {
            sources.push({
              chat_id: chatId,
              url: s.url,
              domain: s.domain,
              cited: s.cited,
              citation_count: s.citationCount,
              retrieval_rank: s.retrievalRank,
            });
          }
        }
      }
    }
  }
  } finally {
    if (prevAdapterMode === undefined) {
      delete process.env.GEO_ADAPTER_MODE;
    } else {
      process.env.GEO_ADAPTER_MODE = prevAdapterMode;
    }
    clearAdapterCache();
  }

  return {
    organization,
    user,
    project,
    brands,
    prompts,
    chats,
    mentions,
    sources,
    fanouts,
    ads,
    topics,
    tags,
    brandProfile,
    rejectedCompetitorNames: [],
    sharedViews: [],
    sourceClassifications: {},
    sourceBookmarks: [],
    actions: [],
    actionEvents: [],
    robotsTxt: undefined,
    agentLogs: [],
    gaReferrals: [],
    logIntegrations: [],
    facts: [],
    claims: [],
    claimVerdicts: [],
    perceptionAttributes: [],
    perceptionRuns: [],
    perceptionObjections: [],
    products: [],
    merchants: [],
    chatProducts: [],
    shoppingAttributes: [],
    productCategories: [],
    pendingCategoryDraft: [],
    demo_fixtures: true,
  };
}

export function metricsFromStore(store: DemoStore) {
  const chats = store.chats.map((c) => ({
    chatId: c.id,
    status: c.status,
  }));
  const facts = store.mentions.map((m) => ({
    chatId: m.chat_id,
    brandId: m.brand_id,
    mentionCount: m.mention_count,
    position: m.position,
    sentiment: m.sentiment,
  }));
  const brandIds = store.brands.map((b) => b.id);
  const rows = computeBrandMetrics(chats, facts, brandIds);
  return rows.map((r) => {
    const brand = store.brands.find((b) => b.id === r.brandId)!;
    return {
      brand_id: r.brandId,
      brand_name: brand.name,
      is_own: brand.is_own,
      visibility: r.visibility,
      share_of_voice: r.shareOfVoice,
      position: r.position,
      sentiment: r.sentiment,
      mention_count: r.mentionCount,
      visibility_count: r.visibilityCount,
      visibility_total: r.visibilityTotal,
    };
  });
}

/** Singleton for API/demo processes. */
let cached: DemoStore | null = null;

export async function getDemoStore(): Promise<DemoStore> {
  if (!cached) cached = await buildDemoStore();
  return cached;
}

export function resetDemoStore(): void {
  cached = null;
}
