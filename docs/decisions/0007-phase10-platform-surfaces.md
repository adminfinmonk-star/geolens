# Phase 10 — Platform surfaces (API keys, OpenAPI, MCP parity)

## Context

BUILD_SPEC Phase 10 DoD: dashboard, API and MCP must return identical numbers
for the same question, verified by a test.

## Decision

1. **`brandsReportPayload`** in `@geo/db` is the single brands report builder.
2. **API keys** (`geo_…`) hashed with SHA-256 (argon2id deferred); project- or
   org-scoped; `x-api-key` on `/customer/v1/*`.
3. **Rate limit** 200/min per project (in-memory sliding window; Redis later).
4. **OpenAPI** generated from `@geo/contracts` at `/openapi.json`.
5. **MCP** `callMcpTool('reports.brands')` uses the same payload builder.
6. **Parity test** in API suite: dashboard GET = customer POST = MCP tool.

## Consequences

Integrators and the assistant share one metric path. Key plaintext is shown once.
