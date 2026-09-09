/** Plan catalog — BUILD_SPEC §16.3. */

export type PlanFeatures = {
  api: boolean;
  mcp: boolean;
  bi: boolean;
  sso: boolean;
};

export type PlanDefinition = {
  code: string;
  name: string;
  track: "brand" | "agency";
  max_projects: number;
  max_active_prompts: number;
  max_channels: number;
  max_countries: number;
  /** Pitch projects get a smaller prompt allowance. */
  pitch_max_prompts: number;
  bot_visit_limit: number;
  /** Agency credit pool; null for brand plans. */
  credits_total: number | null;
  /** Minimum credits that must remain allocated to a live project. */
  min_project_credits: number;
  features: PlanFeatures;
};

export const PLANS: Record<string, PlanDefinition> = {
  trial: {
    code: "trial",
    name: "Trial",
    track: "brand",
    max_projects: 1,
    max_active_prompts: 10,
    max_channels: 2,
    max_countries: 1,
    pitch_max_prompts: 3,
    bot_visit_limit: 100_000,
    credits_total: null,
    min_project_credits: 0,
    features: { api: true, mcp: true, bi: false, sso: false },
  },
  starter: {
    code: "starter",
    name: "Starter",
    track: "brand",
    max_projects: 2,
    max_active_prompts: 40,
    max_channels: 4,
    max_countries: 3,
    pitch_max_prompts: 5,
    bot_visit_limit: 1_000_000,
    credits_total: null,
    min_project_credits: 0,
    features: { api: true, mcp: true, bi: false, sso: false },
  },
  growth: {
    code: "growth",
    name: "Growth",
    track: "brand",
    max_projects: 5,
    max_active_prompts: 200,
    max_channels: 12,
    max_countries: 10,
    pitch_max_prompts: 10,
    bot_visit_limit: 4_000_000,
    credits_total: null,
    min_project_credits: 0,
    features: { api: true, mcp: true, bi: true, sso: false },
  },
  agency: {
    code: "agency",
    name: "Agency",
    track: "agency",
    max_projects: 50,
    max_active_prompts: 500,
    max_channels: 12,
    max_countries: 20,
    pitch_max_prompts: 8,
    bot_visit_limit: 15_000_000,
    credits_total: 30_000,
    min_project_credits: 900,
    features: { api: true, mcp: true, bi: true, sso: false },
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    track: "brand",
    max_projects: 100,
    max_active_prompts: 5_000,
    max_channels: 50,
    max_countries: 50,
    pitch_max_prompts: 20,
    bot_visit_limit: 45_000_000,
    credits_total: null,
    min_project_credits: 0,
    features: { api: true, mcp: true, bi: true, sso: true },
  },
};

export function getPlan(planCode: string): PlanDefinition {
  return PLANS[planCode] ?? PLANS.trial!;
}

/** Peec-like display labels mapped onto GeoLens plan codes. */
export const PLAN_DISPLAY_ALIASES: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Pro",
  agency: "Advanced",
  enterprise: "Enterprise",
};

export function planDisplayName(planCode: string): string {
  return PLAN_DISPLAY_ALIASES[planCode] ?? getPlan(planCode).name;
}

/** Plans shown on the onboarding picker (excludes trial / enterprise). */
export const ONBOARDING_PLAN_CODES = ["starter", "growth", "agency"] as const;
