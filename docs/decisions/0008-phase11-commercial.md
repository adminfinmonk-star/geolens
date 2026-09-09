# Phase 11 — Commercial and hardening

## Context

BUILD_SPEC Phase 11 DoD: quota limits enforced everywhere; load target
(report p95 &lt; 800ms on rollups) met.

## Decision

1. **Single `packages/core/src/quota` module** answers `canActivatePrompt`,
   `canEnableChannel`, `canCreateProject`, `canAddCountry`, `canIngestBotVisit`,
   `canCallApi` (+ MCP/BI/SSO/collect gates). Plans live in `plans.ts`; credits
   are allocation slots (`1 prompt × 1 model × 1 day`).
2. **`@geo/db` `commercial.ts`** builds quota context from the project store,
   owns pause / pitch convert / audit log / GDPR export+delete.
3. **API write paths** consult quota before mutating; paused projects refuse
   collect with an explicit irrecoverable-gap message.
4. **`x-trace-id`** on every response; `/v1/ops/metrics` stub for observability.
5. **SSO** is a plan-gated stub (`/v1/projects/:id/sso`) until SAML lands.
6. **Load check** in API vitest: brands report p95 &lt; 800ms on demo store.

## Consequences

Billing UI reads the same summary the enforcer uses. Feature gates cannot
diverge between customer API, MCP, and BI without changing one module.
