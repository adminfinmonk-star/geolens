# Product polish — §15 shell + Stripe + SAML

## Context

After Phase 11b / ADR 0009, remaining work is product depth rather than a new
delivery phase: Overview default layout, filter bar + command palette, company
settings (API keys / SSO), and production-shaped Stripe / SAML paths.

## Decision

1. **App shell (§15.1–15.2):** grouped collapsible sidebar, URL+localStorage
   filter bar (range, channel), `⌘K` / `Ctrl+K` command palette.
2. **Overview (§15.3 default):** KPI row adds retrieved % + citation rate;
   brands table; top actions / domains / recent chats.
3. **Stripe:** when `STRIPE_SECRET_KEY` is set, Checkout Sessions are created
   via Stripe HTTPS API; webhooks verify `Stripe-Signature` HMAC. Without keys,
   mock checkout still completes in-app.
4. **SAML:** SP metadata at `/v1/saml/metadata`, ACS at `/v1/saml/acs` parses
   NameID email and establishes a session (`loginWithEmail`). Enterprise IdP
   config remains plan-gated. Full XML crypto validation is deferred to a
   certified SAML library when an enterprise customer is onboarded.

## Consequences

Demos stay zero-credential. Production billing/SSO activate by env only.
