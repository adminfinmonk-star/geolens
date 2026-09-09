# Phase 12 alternate — API-first Peec parity (no UI scrapers)

## Context

Peec tracks ChatGPT, Google AI Overviews, Google AI Mode, Perplexity, Gemini,
and Microsoft Copilot primarily via **consumer UI simulation**. ADR 0009 deferred
Playwright/`ui` adapters for legal and reliability reasons.

Product still needs a Peec-comparable **channel set** and honest collection.

## Decision

**API-first routing by channel family:**

| User checks… | We call… |
|---|---|
| ChatGPT / OpenAI Search | `OPENAI_API_KEY` → GPT + web search |
| Claude | `ANTHROPIC_API_KEY` → Claude + web search |
| Perplexity | `PERPLEXITY_API_KEY` → Sonar |
| Gemini / AI Mode / AI Overviews | `GOOGLE_API_KEY` or `GEMINI_API_KEY` → Gemini + Search grounding |
| Copilot | `AZURE_OPENAI_*` when set; otherwise fixtures |

- `surface_kind` remains **`api`** (never pretend UI scrape).
- Google AI Mode / Overviews are **Gemini-grounded proxies**, labeled as such in Channels.
- Missing keys → fixtures (demo never blocks on credentials).
- Default collect set mirrors Peec’s six surfaces via routed channel ids.

Supersedes the “no Google adapter” gap; does **not** reverse ADR 0009’s ban on
consumer-UI scrapers.

## Consequences

- `CHANNEL_PROVIDER_ROUTE` in `@geo/adapters` is the source of truth for routing.
- Channels UI + `GET /v1/adapters/runtime` expose `route_note` + `routing_policy`.
- MCP tool `channels.routing` explains the map to agents.
- True SERP AI Overviews / Copilot UI fidelity remains out of scope unless a
  licensed data partnership is approved in a future ADR.
