# GeoLens production runbook

## Required services and configuration

- PostgreSQL 16 with daily encrypted snapshots and point-in-time recovery.
- Redis 7 with persistence enabled for BullMQ.
- Separate API, worker, and web processes built from the supplied Dockerfiles.
- Required API variables: `NODE_ENV=production`, `DATABASE_URL`, `REDIS_URL`,
  `WEB_URL`, `CORS_ORIGINS`, and `OPS_TOKEN`.
- Configure at least one live provider key. Synthetic fixtures are blocked in
  production unless `GEO_ALLOW_PRODUCTION_FIXTURES=true` is deliberately set for
  an isolated demo deployment.
- Stripe checkout additionally requires `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET`.

## Deploy and verify

1. Back up PostgreSQL and record the current image digest.
2. Deploy the API first; startup applies idempotent SQL migrations.
3. Verify `GET /health`, then `GET /ready` returns HTTP 200.
4. Deploy one worker replica, verify Redis connectivity, then scale workers.
5. Deploy the web image and execute signup, login, analysis, report and checkout
   smoke tests against a non-production Stripe test account.
6. Scrape authenticated `GET /metrics` and alert on readiness failure, HTTP 5xx,
   queue failures and collection failure rate.

## Backup and restore drill

Run a restore drill at least monthly: restore the newest PostgreSQL snapshot into
an isolated database, start the API with provider collection disabled, and verify
organization, project, prompt, immutable chat, source, audit, shared-view and
billing-event row counts. Redis is not the system of record; queued analysis can
be rescheduled from PostgreSQL after a Redis loss.

## Incident actions

- Provider outage: disable the affected channel; never enable fixtures for a
  customer deployment.
- Stripe webhook outage: leave plans unchanged and replay signed events after
  recovery. Event ids are idempotent.
- Suspected tenant leak: revoke API keys and shared views, rotate `OPS_TOKEN`,
  retain audit logs, and take a database snapshot before remediation.
- Rollback: deploy the previous image. Do not reverse destructive migrations;
  current migrations are additive.
