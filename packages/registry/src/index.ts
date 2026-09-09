export type SurfaceKind = "ui" | "api" | "simulator";

export interface ModelChannelVersion {
  modelId: string;
  /** ISO date when this model became current for the channel. */
  effectiveFrom: string;
  note?: string;
}

export interface ModelChannel {
  id: string;
  description: string;
  surface: SurfaceKind;
  /** Stable provider key for rate limiting / credentials. */
  provider: string;
  currentModel: string;
  /** Model upgrades that must not fragment reporting history. */
  versionHistory: ModelChannelVersion[];
  supportsFanouts: boolean;
  supportsAds: boolean;
  supportsShopping: boolean;
  /** Prompt countries that produce no chat (§6.1). */
  unsupportedCountryCodes: string[];
  /** UI honesty: most APIs ignore geography. */
  geoCapability: "full" | "partial" | "none";
}

/**
 * Peec-comparable model channels — collection is API-first.
 * Checking GPT uses OpenAI; Claude uses Anthropic; Gemini/AI Mode/Overviews
 * use Google Gemini grounding; Copilot uses Azure OpenAI when configured.
 */
export const MODEL_CHANNELS: ModelChannel[] = [
  {
    id: "sim-0",
    description: "Simulator (dev/demo)",
    surface: "simulator",
    provider: "simulator",
    currentModel: "simulator-v1",
    versionHistory: [
      { modelId: "simulator-v1", effectiveFrom: "2025-01-01" },
    ],
    supportsFanouts: true,
    supportsAds: true,
    supportsShopping: true,
    unsupportedCountryCodes: [],
    geoCapability: "full",
  },
  {
    id: "openai-0",
    description: "ChatGPT (via OpenAI GPT API)",
    surface: "api",
    provider: "openai",
    currentModel: "gpt-web-search",
    versionHistory: [
      { modelId: "chatgpt-ui", effectiveFrom: "2025-01-01", note: "label only" },
      { modelId: "gpt-web-search", effectiveFrom: "2026-09-01" },
    ],
    supportsFanouts: true,
    supportsAds: false,
    supportsShopping: false,
    unsupportedCountryCodes: [],
    geoCapability: "none",
  },
  {
    id: "openai-1",
    description: "OpenAI Search API (GPT + web search)",
    surface: "api",
    provider: "openai",
    currentModel: "gpt-web-search",
    versionHistory: [
      {
        modelId: "gpt-4o-search-preview",
        effectiveFrom: "2025-01-01",
        note: "retired",
      },
      { modelId: "gpt-web-search", effectiveFrom: "2025-06-01" },
    ],
    supportsFanouts: true,
    supportsAds: false,
    supportsShopping: false,
    unsupportedCountryCodes: [],
    geoCapability: "none",
  },
  {
    id: "perplexity-1",
    description: "Perplexity Sonar API",
    surface: "api",
    provider: "perplexity",
    currentModel: "sonar",
    versionHistory: [
      { modelId: "sonar", effectiveFrom: "2025-01-01" },
      { modelId: "sonar-pro", effectiveFrom: "2025-09-01", note: "optional upgrade" },
    ],
    supportsFanouts: true,
    supportsAds: false,
    supportsShopping: false,
    unsupportedCountryCodes: [],
    geoCapability: "none",
  },
  {
    id: "anthropic-1",
    description: "Claude (via Anthropic API + web search)",
    surface: "api",
    provider: "anthropic",
    currentModel: "claude-web-search",
    versionHistory: [
      { modelId: "claude-web-search", effectiveFrom: "2025-03-01" },
    ],
    supportsFanouts: true,
    supportsAds: false,
    supportsShopping: false,
    unsupportedCountryCodes: [],
    geoCapability: "none",
  },
  {
    id: "google-3",
    description: "Gemini (API + Google Search grounding)",
    surface: "api",
    provider: "google",
    currentModel: "gemini-grounded",
    versionHistory: [
      { modelId: "gemini-grounded", effectiveFrom: "2025-01-01" },
    ],
    supportsFanouts: true,
    supportsAds: false,
    supportsShopping: false,
    unsupportedCountryCodes: [],
    geoCapability: "none",
  },
  {
    id: "google-ai-mode",
    description: "Google AI Mode (via Gemini grounding API)",
    surface: "api",
    provider: "google",
    currentModel: "gemini-grounded",
    versionHistory: [
      { modelId: "gemini-grounded", effectiveFrom: "2026-09-01" },
    ],
    supportsFanouts: true,
    supportsAds: false,
    supportsShopping: false,
    unsupportedCountryCodes: [],
    geoCapability: "none",
  },
  {
    id: "google-ai-overviews",
    description: "Google AI Overviews (via Gemini grounding API)",
    surface: "api",
    provider: "google",
    currentModel: "gemini-grounded",
    versionHistory: [
      { modelId: "gemini-grounded", effectiveFrom: "2026-09-01" },
    ],
    supportsFanouts: true,
    supportsAds: false,
    supportsShopping: false,
    unsupportedCountryCodes: [],
    geoCapability: "none",
  },
  {
    id: "copilot-1",
    description: "Microsoft Copilot (via Azure OpenAI when keyed)",
    surface: "api",
    provider: "copilot",
    currentModel: "copilot-azure",
    versionHistory: [
      { modelId: "copilot-azure", effectiveFrom: "2026-09-01" },
    ],
    supportsFanouts: true,
    supportsAds: false,
    supportsShopping: false,
    unsupportedCountryCodes: [],
    geoCapability: "none",
  },
];

export function getChannel(id: string): ModelChannel | undefined {
  return MODEL_CHANNELS.find((c) => c.id === id);
}

export function listApiChannels(): ModelChannel[] {
  return MODEL_CHANNELS.filter((c) => c.surface === "api");
}

export function channelSupportsCountry(
  channelId: string,
  countryCode: string,
): boolean {
  const ch = getChannel(channelId);
  if (!ch) return false;
  return !ch.unsupportedCountryCodes.includes(countryCode.toUpperCase());
}

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "IN", name: "India" },
  { code: "AU", name: "Australia" },
] as const;

export * from "./bots.js";
export * from "./assistants.js";
