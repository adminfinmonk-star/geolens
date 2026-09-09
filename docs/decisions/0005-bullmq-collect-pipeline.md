# Gap closure — BullMQ collection pipeline

## Context

Phases 0–9 used seed-time collection only. `apps/worker` exposed
`runCollectEnrichJob` as a library/CLI with no queue, cron, or `job_key`
idempotency (§6.1).

## Decision

1. **Redis optional.** `REDIS_URL` enables BullMQ queue `geo-collect` with
   `jobId = job_key` (sha256 of project/prompt/channel/country/run_date).
2. **Inline fallback.** When Redis is unset (CI/demo), jobs run synchronously
   in-process with the same `job_key` idempotency set.
3. **API** `POST /v1/projects/:id/collect` schedules today's collection for
   active prompts × default API channels, applies results to the project store,
   and persists spine + extension.
4. **Worker CLI** `pnpm --filter @geo/worker worker` consumes the queue when
   Redis is available.

## Consequences

- Collection is resumable/idempotent per day without double-writing chats.
- Unsupported (channel, country) pairs still produce no chat row.
- Live provider keys remain optional; fixture mode is the default for CI.
