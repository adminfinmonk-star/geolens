# Measurement validity and remaining product dependencies

## Implemented

- Channel health is derived from the latest saved collection, including stale
  results. An all-failed analysis returns an error; failed evidence is retained.
  Collection errors expose safe recovery summaries rather than provider payloads.
- Prompt editing handles failed writes visibly. Active prompts are the default
  view, and guidance explains discovery versus branded questions. Fanouts and Ads
  are marked Preview; email report settings are accessible in navigation.

## Local release, 2026-09-20

The verified frontend is built in `apps/web/.next-release-20260920`, separate
from the previous build cache. Start it with `pnpm start:web:release`.
For a new release set `GEO_NEXT_DIST_DIR` when building and starting. Keep the
old server running while building, check the new build on an alternate port,
then replace only the verified application process.

`node scripts/verify-product-ui.mjs` checks nine product routes, loaded assets,
browser errors, and the same-origin API proxy. `verify-recovery-ui.mjs` checks
three authentication routes and intercepts reset submission without modifying
accounts. Both accept `GEO_QA_WEB_URL` for an alternate test port.

Payment setup and provider credentials remain user-owned integration tasks.

## Earlier remediation

- Active prompt identity normalizes case, whitespace and market. Database
  uniqueness prevents concurrent duplicates; migration archives duplicate
  configuration while retaining every chat and original prompt association.
  Collection, overview and quota counting use unique active prompts.
- Overview shows latest-day collection health by channel with credential/quota
  recovery guidance, and explains current discovery versus historical cohorts.

- Owned-domain citation coverage requires a cited URL on the project domain or
  its subdomain. An unrelated citation in the same answer gives no credit.
- The composite score is explicitly experimental and uncalibrated. Its former
  partially propagated interval is removed; no validated composite confidence
  claim is made.
- Each independent analysis has a distinct observation identity. Retrying that
  identity is idempotent; additional observations on the same date are retained.
- Editing prompt text or country archives the old prompt and creates a new
  version. Historical answers retain their original prompt association.
- Daily visibility uses eligible answers, excluding failed attempts from its
  denominator. Dates with no eligible answers return null.
- Reports expose a cohort fingerprint and a coverage comparison across dates.
  The comparison checks eligible prompt versions, route, model, market and
  surface. It is not proof of statistical independence or significance.
- Discovery priorities are labelled heuristic estimates, not measured volume.
- Inline collection no longer mutates process-wide Redis configuration.
- Both background collection paths commit evidence transactionally without
  overwriting project settings. Retries cannot append new derived facts to an
  existing answer. Queued analyses snapshot prompt text and brand matchers.
- PostgreSQL reads refresh across processes; prompt classification metadata
  persists across reloads. Report reads no longer delete historical brands or
  rewrite mention rows.
- Container builds include the shared TypeScript config and exclude local build
  caches, dependencies and secrets. CI supplies the Compose example env file.
- Password recovery uses hashed 256-bit, 30-minute, single-use tokens. Completing
  a reset revokes all sessions. Recovery and report delivery use configured SMTP.
- Users can schedule daily/weekly email summaries to their account address.
  Worker leases prevent simultaneous sends; failures retry. SMTP delivery is
  at-least-once, so a crash after send but before commit can cause a duplicate.
- Normalized analytics JSON imports validate data, preserve provenance and
  replace matching dimensions. They are not a live GA4 OAuth connection.
- HTTP errors are failures, not empty answers. Gemini citations require grounding
  support; ungrounded fallback is opt-in and separately tagged. API keys are not
  placed in Gemini request URLs.
- Stripe Checkout copies project metadata to subscriptions; invoice routing reads
  subscription metadata and refuses to guess a production project. Configured
  webhook secrets require affirmative signature verification.

## Still required for competitive parity

- Actual consumer search collection: choose and configure a provider supporting
  the required products, response evidence, locale and collection metadata.
- Research corpus: obtain demand data and build versioned category panels;
  API collection alone does not provide industry-wide volume or benchmarks.
- Empirical evaluation: human-reviewed mention/citation labels, multilingual
  entity disambiguation, repeated sampling and held-out score validation.
- Configure SMTP and exercise delivery with the deployment's real mail provider.
- Live GA4 OAuth synchronization (normalized export import is available).
- Production deployment failure/recovery exercises and Stripe billing lifecycle
  acceptance, including out-of-order events and reconciliation.

## Live provider verification, 2026-09-19

- Perplexity API: a small live request returned an answer and citation. The
  returned model identity is retained; this is not the Perplexity consumer UI.
- Gemini API: the saved key returned HTTP 429 / RESOURCE_EXHAUSTED. Resolve the
  Google project's quota/billing before treating the channel as operational.
- OpenAI: intentionally deferred until the user adds the key.

## Local verification

Database integration coverage includes evidence idempotency, preserving prompt
edits during collection, persisted referral imports, concurrent single-use
password recovery, session revocation and competing report-delivery leases.
`scripts/verify-recovery-ui.mjs` checks the login/recovery routes, loaded CSS,
browser errors and an intercepted (non-mutating) reset submission.
Run against a separate built web instance with `GEO_QA_WEB_URL`; do not build
into the cache used by a running development server.
The web Docker build sets `API_INTERNAL_URL=http://api:3001` at build time,
because Next.js includes the backend rewrite destination in its build output.
Override this build argument when deploying with a different internal API host.

These are outstanding delivery items. Passing the current code tests does not
establish Semrush parity or a completed production acceptance test.
