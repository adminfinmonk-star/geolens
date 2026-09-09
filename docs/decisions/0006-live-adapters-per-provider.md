# Gap closure — Live API adapters (per-provider)

## Context

ADR 0003 shipped OpenAI / Perplexity / Anthropic adapters with a global
`GEO_ADAPTER_MODE`. In practice, having any one key flipped all channels toward
live, and channels without keys could fail instead of degrading to fixtures.
Collect API also forced fixture by default, hiding live keys.

## Decision

1. **Per-provider effective mode** via `resolveProviderMode(provider)`:
   - `GEO_ADAPTER_MODE=fixture` → all fixtures
   - Otherwise a channel is **live only if its own key is set**; missing key → fixture
2. **`describeAdapterRuntime()`** + `GET /v1/adapters/runtime` expose honesty
   for Channels UI (live vs fixture, key present).
3. **Collect** respects env auto/live — does not force fixture.
4. **CI** still uses fixtures; live HTTP path is covered by mocked `fetch` tests.
5. Live responses mark `raw.live = true` and keep `surface_kind=api`.

## Consequences

Mixed live/fixture projects are valid (e.g. only OpenAI keyed). The product
remains fully runnable with zero credentials.
