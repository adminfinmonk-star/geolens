# Visibility Overview — backend plan

## Goal
Replace illustrative Overview widgets with one canonical report API that FilterBar, Export, Share, and MCP can all call.

## Endpoint
`GET /v1/projects/:projectId/reports/overview`

### Query
| Param | Meaning |
|-------|---------|
| `range` | `7d` (default), `30d`, or `90d`. Window ends at the latest collected `chat.run_date`. |
| `channel` | `all` (default) or a `model_channel_id` |

ISO `from` / `to`, `country`, and `brand_id` are not wired yet.

## Response
See `overviewReportPayload` in `packages/db/src/reports.ts`. Includes `filters.range|channel|from|to` and matching `honesty` window fields.

## Aggregation rules
- **Visibility (presence)** = `visibility_count / visibility_total` (same §8 formula as brands report). This is *not* the Overview gauge.
- **AI Visibility Score** = `competitiveVisibilityScore`: 40% presence + 45% share of voice + 15% placement (position 1 → 1, position 5+ → 0), then shrunk toward 0.32 until there are 8+ eligible chats. Prevents 2/2 listicle hits from reading as 100/High.
- **Band** = high ≥60 · medium ≥35 · low otherwise. `score.sample_thin` when eligible chats < 8.
- **Who AI recommends / rank** = share of voice, then better (lower) position, then presence. Not raw visibility.
- **Channels** = distinct chats where own brand is mentioned / eligible chats in that channel
- **Countries** = chat counts by `country_code` (requested market — not localization)
- **Series** = per-day own mention rate when multiple run dates exist
- **Topics** = mentioned topic chats / eligible topic chats (distinct chats). UI shows `n/N` when N < 8.

## Honesty
Always return `honesty.*` flags so the UI never implies collected history or geo localization when it is not. Overview KPIs are **this project's collected chats**, not a Semrush-scale industry index. `collection_mode` is `fixture` | `mixed` | `live` | `empty`.

## Follow-ups
1. Materialize `metric_daily` (project, brand, channel, country, date)
2. Topic visibility = chats with prompt.topic_id where brand mentioned / eligible chats
3. Country / intent query params
4. Optional OpenAPI fragment under `/customer/v1/reports/overview`
