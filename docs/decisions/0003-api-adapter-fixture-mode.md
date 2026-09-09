# ADR 0003 — API adapters default to fixture mode

## Status
Accepted (Phase 6)

## Context
Phase 6 requires ≥3 real provider adapters. Live keys are optional in CI and local demos (BUILD_SPEC: product must run with zero credentials).

## Decision
- Implement OpenAI, Perplexity, and Anthropic `api` adapters behind `EngineAdapter`.
- `GEO_ADAPTER_MODE=fixture` (default when no provider keys) returns deterministic, provider-biased responses with `surface_kind=api`.
- `GEO_ADAPTER_MODE=live` + provider env keys call real APIs with token-bucket rate limits and 429/5xx retries.
- Never present API data as UI; surface `surface_kind` in reports and shell chrome.
- Never inject location into prompts to fake geo (`capabilities.geo = none` for these APIs).

## Consequences
Demo seed and CI exercise channel-level differences without network. Live collection is opt-in via env keys.
