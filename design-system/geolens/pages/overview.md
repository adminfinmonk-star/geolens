# App — Visibility Overview

> App product surface only. Do **not** change marketing homepage (`apps/web/src/app/page.tsx`).

**Stitch screen (v2):** `13fc6212cc284e44957e2f1aac59be2e`  
**Assets:** `design/stitch/overview-v2-screen.html`, `overview-v2-screen.png`  
**Route:** `/[projectId]/overview`  
**API:** `GET /v1/projects/:projectId/reports/overview`

## Rules

- Teal `#0F766E`; Plus Jakarta Sans; light theme
- Score gauge + insight · Metrics trend · LLM distribution · Country mix
- Topics & sources strip · Who AI recommends · Actions / next steps
- Honesty badges: collected vs sparse series; requested-market country; topic proxy
- One Analyze control in the topbar FilterBar (no hero duplicate)
- FilterBar `range` (`7d` | `30d` | `90d`) and `channel` change the overview report

## Backend (shipped + planned)

### Shipped
- `overviewReportPayload` in `packages/db/src/reports.ts`
- Aggregate: score/band, KPIs, channels, countries, competitors, topics proxy, daily series, cited domains + honesty flags
- Filter query params: `range` (`7d` default, `30d`, `90d`) and `channel` (`all` or `model_channel_id`). Window is last N days ending at the latest collected `run_date`.
- Honest KPI / score deltas in the UI when the filtered series has at least two collected days

### Next (product fidelity)
1. **Topic × visibility rollup** — join prompts.topic_id → chats → mentions (replace proxy)
2. **True time-series store** — daily rollup table keyed by project/brand/channel/country (stop sparse bridging)
3. **Country / intent query params** on overview report
4. **Citation metrics** — citation_rate by channel for Mentions vs Cited Pages tabs
5. **Prior-window deltas** on Citations / Cited pages KPIs (mentions/visibility already use series start vs end)
