import { computeProjectCredits } from "./credits.js";
import { getPlan, type PlanDefinition } from "./plans.js";

export type QuotaDecision = {
  ok: boolean;
  code?: string;
  message?: string;
};

export type QuotaContext = {
  plan_code: string;
  is_agency: boolean;
  credits_total: number | null;
  /** Sum of credits allocated across non-paused projects. */
  credits_allocated: number;
  project_count: number;
  project_status: string;
  active_prompts: number;
  enabled_channels: number;
  countries: number;
  bot_visits_used: number;
  frequency: "daily" | "weekly";
};

function planOf(ctx: QuotaContext): PlanDefinition {
  return getPlan(ctx.plan_code);
}

function promptCap(ctx: QuotaContext, plan: PlanDefinition): number {
  if (ctx.project_status === "PITCH") return plan.pitch_max_prompts;
  return plan.max_active_prompts;
}

export function canActivatePrompt(
  ctx: QuotaContext,
  adding = 1,
): QuotaDecision {
  if (ctx.project_status === "PAUSED") {
    return {
      ok: false,
      code: "project_paused",
      message:
        "Project is paused — activate a prompt after unpausing. Data for the paused period is not recoverable.",
    };
  }
  const plan = planOf(ctx);
  const cap = promptCap(ctx, plan);
  if (ctx.active_prompts + adding > cap) {
    return {
      ok: false,
      code: "prompt_quota",
      message: `Active prompt limit reached (${cap} on ${plan.name}${
        ctx.project_status === "PITCH" ? " pitch" : ""
      }).`,
    };
  }
  if (plan.track === "agency") {
    const pool = ctx.credits_total ?? plan.credits_total;
    if (pool != null) {
      const nextCredits = computeProjectCredits({
        active_prompts: ctx.active_prompts + adding,
        active_channels: Math.max(1, ctx.enabled_channels),
        frequency: ctx.frequency,
      });
      const other = Math.max(
        0,
        ctx.credits_allocated -
          computeProjectCredits({
            active_prompts: ctx.active_prompts,
            active_channels: Math.max(1, ctx.enabled_channels),
            frequency: ctx.frequency,
          }),
      );
      if (other + nextCredits > pool) {
        return {
          ok: false,
          code: "credit_quota",
          message: `Agency credit pool exhausted (${pool} credits).`,
        };
      }
    }
  }
  return { ok: true };
}

export function canEnableChannel(
  ctx: QuotaContext,
  adding = 1,
): QuotaDecision {
  if (ctx.project_status === "PAUSED") {
    return {
      ok: false,
      code: "project_paused",
      message: "Project is paused — channel changes are blocked.",
    };
  }
  const plan = planOf(ctx);
  if (ctx.enabled_channels + adding > plan.max_channels) {
    return {
      ok: false,
      code: "channel_quota",
      message: `Channel limit reached (${plan.max_channels} on ${plan.name}).`,
    };
  }
  return { ok: true };
}

export function canCreateProject(ctx: QuotaContext): QuotaDecision {
  const plan = planOf(ctx);
  if (ctx.project_count >= plan.max_projects) {
    return {
      ok: false,
      code: "project_quota",
      message: `Project limit reached (${plan.max_projects} on ${plan.name}).`,
    };
  }
  return { ok: true };
}

export function canAddCountry(ctx: QuotaContext, adding = 1): QuotaDecision {
  const plan = planOf(ctx);
  if (ctx.countries + adding > plan.max_countries) {
    return {
      ok: false,
      code: "country_quota",
      message: `Country limit reached (${plan.max_countries} on ${plan.name}).`,
    };
  }
  return { ok: true };
}

export function canIngestBotVisit(ctx: QuotaContext): QuotaDecision {
  const plan = planOf(ctx);
  if (ctx.bot_visits_used >= plan.bot_visit_limit) {
    return {
      ok: false,
      code: "bot_visit_quota",
      message:
        "Bot-visit limit reached for this month — gap means limit reached, not zero activity.",
    };
  }
  return { ok: true };
}

export function canCallApi(ctx: QuotaContext): QuotaDecision {
  const plan = planOf(ctx);
  if (!plan.features.api) {
    return {
      ok: false,
      code: "feature_locked",
      message: `Public API is not included on ${plan.name}.`,
    };
  }
  return { ok: true };
}

export function canUseMcp(ctx: QuotaContext): QuotaDecision {
  const plan = planOf(ctx);
  if (!plan.features.mcp) {
    return {
      ok: false,
      code: "feature_locked",
      message: `MCP is not included on ${plan.name}.`,
    };
  }
  return { ok: true };
}

export function canUseBi(ctx: QuotaContext): QuotaDecision {
  const plan = planOf(ctx);
  if (!plan.features.bi) {
    return {
      ok: false,
      code: "feature_locked",
      message: `BI connector is not included on ${plan.name}.`,
    };
  }
  return { ok: true };
}

export function canUseSso(ctx: QuotaContext): QuotaDecision {
  const plan = planOf(ctx);
  if (!plan.features.sso) {
    return {
      ok: false,
      code: "feature_locked",
      message: `SSO/SAML is not included on ${plan.name}.`,
    };
  }
  return { ok: true };
}

export function canCollect(ctx: QuotaContext): QuotaDecision {
  if (ctx.project_status === "PAUSED") {
    return {
      ok: false,
      code: "project_paused",
      message:
        "Collection is stopped while paused. History for the paused window is permanently missing.",
    };
  }
  return { ok: true };
}

export function quotaSummary(ctx: QuotaContext) {
  const plan = planOf(ctx);
  const allocated = computeProjectCredits({
    active_prompts: ctx.active_prompts,
    active_channels: Math.max(1, ctx.enabled_channels),
    frequency: ctx.frequency,
  });
  return {
    plan: {
      code: plan.code,
      name: plan.name,
      track: plan.track,
      features: plan.features,
    },
    limits: {
      max_projects: plan.max_projects,
      max_active_prompts: promptCap(ctx, plan),
      max_channels: plan.max_channels,
      max_countries: plan.max_countries,
      bot_visit_limit: plan.bot_visit_limit,
      credits_total: plan.credits_total ?? ctx.credits_total,
    },
    usage: {
      project_count: ctx.project_count,
      active_prompts: ctx.active_prompts,
      enabled_channels: ctx.enabled_channels,
      countries: ctx.countries,
      bot_visits_used: ctx.bot_visits_used,
      credits_allocated: allocated,
      project_status: ctx.project_status,
    },
    banners: {
      bot_quota_exhausted: ctx.bot_visits_used >= plan.bot_visit_limit,
      project_paused: ctx.project_status === "PAUSED",
    },
  };
}

export * from "./plans.js";
export * from "./credits.js";
