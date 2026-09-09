import { describe, expect, it } from "vitest";
import {
  canActivatePrompt,
  canCallApi,
  canCollect,
  canCreateProject,
  canEnableChannel,
  canIngestBotVisit,
  computeProjectCredits,
  creditsForMonth,
  getPlan,
  quotaSummary,
  type QuotaContext,
} from "./index.js";

function base(over: Partial<QuotaContext> = {}): QuotaContext {
  return {
    plan_code: "trial",
    is_agency: false,
    credits_total: null,
    credits_allocated: 0,
    project_count: 1,
    project_status: "CUSTOMER",
    active_prompts: 5,
    enabled_channels: 2,
    countries: 1,
    bot_visits_used: 0,
    frequency: "daily",
    ...over,
  };
}

describe("quota module §16.3", () => {
  it("credits: 1 prompt × 1 channel × 30 days = 30", () => {
    expect(creditsForMonth(1, 1, "daily")).toBe(30);
    expect(
      computeProjectCredits({
        active_prompts: 1,
        active_channels: 1,
        run_days: 30,
        frequency: "weekly",
      }),
    ).toBe(10);
  });

  it("blocks activating prompts beyond plan cap", () => {
    const ok = canActivatePrompt(base({ active_prompts: 9 }));
    expect(ok.ok).toBe(true);
    const blocked = canActivatePrompt(base({ active_prompts: 10 }));
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("prompt_quota");
  });

  it("pitch projects use smaller prompt allowance", () => {
    const plan = getPlan("trial");
    const blocked = canActivatePrompt(
      base({
        project_status: "PITCH",
        active_prompts: plan.pitch_max_prompts,
      }),
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("prompt_quota");
  });

  it("paused projects cannot collect or activate", () => {
    const ctx = base({ project_status: "PAUSED" });
    expect(canCollect(ctx).code).toBe("project_paused");
    expect(canActivatePrompt(ctx).code).toBe("project_paused");
  });

  it("enforces channel, project, bot-visit and API feature gates", () => {
    expect(canEnableChannel(base({ enabled_channels: 2 })).ok).toBe(false);
    expect(canCreateProject(base({ project_count: 1 })).ok).toBe(false);
    expect(
      canIngestBotVisit(base({ bot_visits_used: 100_000 })).code,
    ).toBe("bot_visit_quota");
    expect(canCallApi(base()).ok).toBe(true);
  });

  it("agency credit pool blocks over-allocation", () => {
    const ctx = base({
      plan_code: "agency",
      is_agency: true,
      credits_total: 900,
      credits_allocated: 30,
      active_prompts: 1,
      enabled_channels: 1,
    });
    // 1×1×30 = 30; adding another → 60 within 900 — ok
    expect(canActivatePrompt(ctx).ok).toBe(true);
    const tight = base({
      plan_code: "agency",
      is_agency: true,
      credits_total: 30,
      credits_allocated: 30,
      active_prompts: 1,
      enabled_channels: 1,
    });
    expect(canActivatePrompt(tight).code).toBe("credit_quota");
  });

  it("quotaSummary exposes banners", () => {
    const s = quotaSummary(base({ bot_visits_used: 100_000 }));
    expect(s.banners.bot_quota_exhausted).toBe(true);
    expect(s.plan.code).toBe("trial");
  });
});
