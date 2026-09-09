# Phase 12 — Defer `ui` adapters (§21.1)

## Context

BUILD_SPEC Phase 12 is optional and **gated**: Playwright pools, geo egress,
and consumer-UI parsers for ChatGPT / Gemini / Perplexity / Copilot must not be
built until §21.1 is read and a decision is recorded.

## Decision

**We are not building `ui` adapters.** Ship and operate exclusively on:

1. **Simulator** (`surface_kind=simulator`) for demos and CI
2. **Official provider APIs** (`surface_kind=api`) when `OPENAI_API_KEY` /
   `ANTHROPIC_API_KEY` / `PERPLEXITY_API_KEY` are set
3. **Fixtures** when keys are absent

Rationale (from §21.1):

- Automating consumer UIs is generally prohibited by provider terms and creates
  contractual / legal exposure.
- Reliability is adversarial (bot detection, silent breakage, no SLA).
- Geo-egress proxy provenance is an ethical and operational risk.
- The product is designed to be valuable without UI collection; `surface_kind`
  must never misrepresent API data as consumer-UI fidelity.

If UI-fidelity data is later required, prefer **licensed data partnerships** and
a new ADR with legal review — do not add Playwright scrapers in-repo without that.

## Consequences

- No Playwright pool, geo egress, or UI parser versioning in this codebase.
- Channels UI and `GET /v1/adapters/runtime` continue to label `api` /
  `simulator` / `fixture` honestly.
- Engineering effort after Phase 11 goes to commercial hardening, observability,
  and API-surface quality — not Phase 12.
