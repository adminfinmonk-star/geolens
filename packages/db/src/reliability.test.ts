import { afterEach, describe, expect, it, vi } from "vitest";
import { applyExtension, extractExtension } from "./bootstrap.js";
import { billingEventMetadata, handleBillingWebhook } from "./billing.js";
import { getDemoStore, resetDemoStore } from "./seed.js";
import { createStripeCheckoutSession } from "./stripe.js";
import { importReferralRows } from "./agentAnalytics.js";
import { purgeLegacyFixtures } from "./fixtures.js";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("persistence and billing integrity", () => {
  it("imports measured traffic idempotently without losing it to fixture cleanup", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    store.demo_fixtures = false;
    store.gaReferrals = [];
    const row = { date: "2026-09-19", source: "perplexity.ai", medium: "referral", country: "IN", device: "desktop", landing_page: "/", page_path: "/", currency: "USD", session_starts: 12, conversions: 2, revenue: 10 };
    importReferralRows(store, [row]);
    importReferralRows(store, [row]);
    purgeLegacyFixtures(store);
    expect(store.gaReferrals).toHaveLength(1);
    expect(store.gaReferrals[0]!.session_starts).toBe(12);
    expect(() => importReferralRows(store, [{ ...row, source: "gmail.com" }])).toThrow("not a recognized");
    expect(() => importReferralRows(store, [{ ...row, currency: "EUR" }])).toThrow("Mixed currencies");
    expect(() => importReferralRows(store, [{ ...row, revenue: -1 }])).toThrow("Invalid referral row");
    expect(() => importReferralRows(store, [{ ...row, date: "2026-02-30" }])).toThrow("Invalid referral row");
    expect(store.gaReferrals).toHaveLength(1);
  });
  it("persists prompt classification without restoring old text or status", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const prompt = store.prompts[0]!;
    prompt.topic_id = "tpc_persisted";
    prompt.branding = "branded";
    const extension = extractExtension(store);
    prompt.topic_id = undefined;
    prompt.branding = undefined;
    prompt.text = "Edited text";
    prompt.status = "archived";
    applyExtension(store, extension);
    expect(prompt.topic_id).toBe("tpc_persisted");
    expect(prompt.branding).toBe("branded");
    expect(prompt.text).toBe("Edited text");
    expect(prompt.status).toBe("archived");
  });

  it("requires affirmative signature verification whenever a secret is configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test-secret");
    resetDemoStore();
    const store = await getDemoStore();
    expect(() => handleBillingWebhook(store, { type: "invoice.paid" })).toThrow("invalid_signature");
    expect(billingEventMetadata({ data: { object: { parent: { subscription_details: { metadata: { project_id: "prj_test" } } }, metadata: {} } } }).project_id).toBe("prj_test");
    expect(() => handleBillingWebhook(store, { type: "invoice.paid", data: { object: { metadata: { project_id: "another_project" } } } }, { stripe_signature_ok: true })).toThrow("billing_project_mismatch");
  });

  it("copies Checkout metadata to its subscription", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "cs_test", url: "https://checkout.stripe.com/test" }) });
    vi.stubGlobal("fetch", fetchMock);
    await createStripeCheckoutSession({ plan_code: "starter", amount_cents: 9900, currency: "usd", success_url: "https://example.com/success", cancel_url: "https://example.com/cancel", client_reference_id: "chk_test", metadata: { project_id: "prj_test", plan_code: "starter" } });
    const params = new URLSearchParams(fetchMock.mock.calls[0]![1].body);
    expect(params.get("subscription_data[metadata][project_id]")).toBe("prj_test");
  });
});
