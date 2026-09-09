import { createHash } from "node:crypto";
import type { DemoStore } from "./seed.js";
import { appendAuditLog, ensureCommercial } from "./commercial.js";

export type SamlIdpConfig = {
  entity_id: string;
  sso_url: string;
  certificate_fingerprint?: string;
};

export function spEntityId(baseUrl = process.env.API_URL ?? "http://127.0.0.1:3001") {
  return `${baseUrl.replace(/\/$/, "")}/v1/saml/metadata`;
}

export function spAcsUrl(baseUrl = process.env.API_URL ?? "http://127.0.0.1:3001") {
  return `${baseUrl.replace(/\/$/, "")}/v1/saml/acs`;
}

/** Minimal SP metadata XML for IdP configuration. */
export function buildSpMetadataXml(opts?: { baseUrl?: string }): string {
  const entity = spEntityId(opts?.baseUrl);
  const acs = spAcsUrl(opts?.baseUrl);
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entity}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

/**
 * Parse a simplified SAML Response (base64 XML or plain XML) for NameID email.
 * Production should use a certified SAML library; this validates shape for demos.
 */
export function parseSamlResponseEmail(samlResponse: string): string | null {
  let xml = samlResponse.trim();
  if (!xml.includes("<")) {
    try {
      xml = Buffer.from(xml, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  const nameId =
    xml.match(/<saml2?:NameID[^>]*>([^<]+)<\/saml2?:NameID>/i) ??
    xml.match(/<NameID[^>]*>([^<]+)<\/NameID>/i);
  const email = nameId?.[1]?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

export function fingerprintCert(pemOrDer: string): string {
  const b64 = pemOrDer
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  const der = Buffer.from(b64, "base64");
  return createHash("sha256").update(der).digest("hex");
}

export function assertSsoReady(store: DemoStore): {
  ok: boolean;
  code?: string;
  message?: string;
  idp?: SamlIdpConfig;
} {
  const c = ensureCommercial(store);
  if (store.organization.plan_code !== "enterprise") {
    return {
      ok: false,
      code: "feature_locked",
      message: "SSO requires the enterprise plan.",
    };
  }
  if (!c.sso?.configured || !c.sso.idp_entity_id || !c.sso.idp_sso_url) {
    return {
      ok: false,
      code: "sso_not_configured",
      message: "Configure IdP entity ID and SSO URL first.",
    };
  }
  return {
    ok: true,
    idp: {
      entity_id: c.sso.idp_entity_id,
      sso_url: c.sso.idp_sso_url,
      certificate_fingerprint: c.sso.idp_certificate_present
        ? "configured"
        : undefined,
    },
  };
}

export function buildIdpRedirectUrl(
  store: DemoStore,
  opts?: { relay_state?: string },
): { ok: true; redirect_url: string } | { ok: false; code: string; message: string } {
  const ready = assertSsoReady(store);
  if (!ready.ok || !ready.idp) {
    return {
      ok: false,
      code: ready.code ?? "sso_error",
      message: ready.message ?? "SSO unavailable",
    };
  }
  const url = new URL(ready.idp.sso_url);
  url.searchParams.set("SAMLRequest", "mock_authn_request");
  if (opts?.relay_state) url.searchParams.set("RelayState", opts.relay_state);
  appendAuditLog(store, {
    source: "web",
    action: "sso.login_redirect",
    after: { idp: ready.idp.entity_id },
  });
  return { ok: true, redirect_url: url.toString() };
}
