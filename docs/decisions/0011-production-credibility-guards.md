# Production credibility and durability guards

## Context

The adversarial audit found that simulated prompt metrics, in-process analysis
state, permissive project writes, and placeholder operational numbers could be
mistaken for measured or production-safe behavior.

## Decision

1. Prompt visibility is computed only from `ok`/`empty` collected answers and
   own-brand mention facts. Error and blocked attempts remain visible but never
   depress the denominator. No inferred recommendation rank is displayed.
2. With PostgreSQL and Redis configured, website analyses run as persistent
   `geo-analyze` BullMQ jobs. The worker reloads the project, collects inline
   under the durable parent job, and commits the resulting collection. Status
   is read from Redis, so an API restart does not erase it.
3. Public demo mutations are rejected in production. Viewers cannot mutate a
   project, and billing, API-key, channel, lifecycle, GDPR-delete, and SSO
   changes require an owner or administrator.
4. Production CORS requires an explicit allowlist. Cookie-authenticated writes
   require a matching Origin, authentication endpoints are rate-limited, and
   baseline security headers are returned.
5. Placeholder zero-valued operational alarms were removed. The diagnostics
   endpoint reports telemetry as unavailable until a real backend exists and is
   hidden in production unless `OPS_TOKEN` is configured.

## Consequences

Local demos retain the zero-credential inline path. A production deployment
must run PostgreSQL, Redis, the API, and `pnpm --filter @geo/worker worker`.
These safeguards improve integrity but do not substitute for an external
telemetry backend, validated SAML implementation, or empirical score study.
