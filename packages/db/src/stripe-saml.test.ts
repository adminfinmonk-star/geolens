import { describe, expect, it } from "vitest";
import {
  buildSpMetadataXml,
  parseSamlResponseEmail,
  verifyStripeWebhookSignature,
} from "./index.js";

describe("stripe + saml helpers", () => {
  it("parses NameID email from SAML XML and base64", () => {
    const xml = `<Response><Assertion><NameID>owner@acme.example</NameID></Assertion></Response>`;
    expect(parseSamlResponseEmail(xml)).toBe("owner@acme.example");
    const b64 = Buffer.from(xml, "utf8").toString("base64");
    expect(parseSamlResponseEmail(b64)).toBe("owner@acme.example");
  });

  it("emits SP metadata with ACS", () => {
    const xml = buildSpMetadataXml({ baseUrl: "https://api.example" });
    expect(xml).toContain('entityID="https://api.example/v1/saml/metadata"');
    expect(xml).toContain("https://api.example/v1/saml/acs");
  });

  it("verifies stripe webhook signatures", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const body = '{"type":"checkout.session.completed"}';
    const t = Math.floor(Date.now() / 1000);
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", "whsec_test_secret")
      .update(`${t}.${body}`)
      .digest("hex");
    expect(
      verifyStripeWebhookSignature(body, `t=${t},v1=${sig}`),
    ).toBe(true);
    expect(
      verifyStripeWebhookSignature(body, `t=${t},v1=deadbeef`),
    ).toBe(false);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });
});
