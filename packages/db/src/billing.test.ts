import { describe, expect, it, beforeEach } from "vitest";
import {
  completeCheckout,
  createCheckoutSession,
  handleBillingWebhook,
  resetCheckoutSessions,
} from "./billing.js";
import { configureSso, setOrgPlan } from "./commercial.js";
import { getDemoStore, resetDemoStore } from "./seed.js";

describe("Phase 11b billing + SSO", () => {
  beforeEach(() => {
    resetDemoStore();
    resetCheckoutSessions();
  });

  it("mock checkout upgrades plan on complete", async () => {
    const store = await getDemoStore();
    expect(store.organization.plan_code).toBe("growth");
    const session = await createCheckoutSession(store, "agency");
    expect(session.mode).toBe("mock");
    expect(session.status).toBe("open");
    const done = completeCheckout(store, session.id);
    expect(done.session.status).toBe("complete");
    expect(store.organization.plan_code).toBe("agency");
    expect(store.organization.is_agency).toBe(true);
    expect(store.commercial?.stripe_subscription_status).toBe("active");
  });

  it("webhook completes open session", async () => {
    const store = await getDemoStore();
    const session = await createCheckoutSession(store, "starter");
    const result = handleBillingWebhook(store, {
      type: "mock.checkout.completed",
      data: { object: { id: session.id } },
    });
    expect(result.handled).toBe(true);
    expect(store.organization.plan_code).toBe("starter");
  });

  it("SSO configure requires enterprise plan", async () => {
    const store = await getDemoStore();
    setOrgPlan(store, "growth");
    const denied = configureSso(store, {
      idp_entity_id: "https://idp.example/entity",
      idp_sso_url: "https://idp.example/sso",
    });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("feature_locked");

    setOrgPlan(store, "enterprise");
    const ok = configureSso(store, {
      idp_entity_id: "https://idp.example/entity",
      idp_sso_url: "https://idp.example/sso",
      idp_certificate_present: true,
    });
    expect(ok.ok).toBe(true);
    expect(store.commercial?.sso?.configured).toBe(true);
  });
});
