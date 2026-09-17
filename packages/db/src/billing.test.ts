import { beforeEach, describe, expect, it } from "vitest";
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

  it("disables mock checkout and unsigned webhooks in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousStripeKey = process.env.STRIPE_SECRET_KEY;
    const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const store = await getDemoStore();
      await expect(createCheckoutSession(store, "starter")).rejects.toThrow(
        "stripe_not_configured",
      );
      expect(() =>
        handleBillingWebhook(store, { type: "mock.checkout.completed" }),
      ).toThrow("stripe_webhook_not_configured");
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previousStripeKey;
      if (previousWebhookSecret === undefined) {
        delete process.env.STRIPE_WEBHOOK_SECRET;
      } else process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
    }
  });

  it("requires a verified webhook to complete a production Stripe checkout", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousStripeKey = process.env.STRIPE_SECRET_KEY;
    const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const previousFetch = globalThis.fetch;
    process.env.NODE_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "sk_test_verified";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_verified";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: "cs_verified",
          url: "https://checkout.stripe.test/session",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    try {
      const store = await getDemoStore();
      const session = await createCheckoutSession(store, "starter");
      expect(session.mode).toBe("stripe");
      expect(() => completeCheckout(store, session.id)).toThrow(
        "stripe_checkout_requires_verified_webhook",
      );
      const result = handleBillingWebhook(
        store,
        {
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_verified",
              metadata: { checkout_session_id: session.id },
            },
          },
        },
        { stripe_signature_ok: true },
      );
      expect(result.handled).toBe(true);
      expect(store.organization.plan_code).toBe("starter");
    } finally {
      globalThis.fetch = previousFetch;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previousStripeKey;
      if (previousWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
    }
  });

  it("updates subscription state for payment failure and cancellation", async () => {
    const store = await getDemoStore();
    setOrgPlan(store, "growth");
    expect(
      handleBillingWebhook(store, { type: "invoice.payment_failed" }).handled,
    ).toBe(true);
    expect(store.commercial?.stripe_subscription_status).toBe("past_due");
    expect(
      handleBillingWebhook(store, { type: "customer.subscription.deleted" })
        .handled,
    ).toBe(true);
    expect(store.commercial?.stripe_subscription_status).toBe("canceled");
    expect(store.organization.plan_code).toBe("trial");
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
