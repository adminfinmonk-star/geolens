# ADR 0002 — Opportunity score weights

## Status
Accepted (Phase 5)

## Context
Actions from rules R1–R10 must share one comparable queue. Raw gap volumes are not comparable across Site Audit vs Earned editorial work.

## Decision
Publish weights in `packages/core/src/actions/scoring.ts` as `OPPORTUNITY_WEIGHTS`:

| Weight | Role | Value |
|---|---|---|
| w1 | normalized gap volume | 0.30 |
| w2 | competitor density | 0.20 |
| w3 | topic importance | 0.20 |
| w4 | addressability | 0.20 |
| w5 | estimated effort (penalty) | 0.10 |

Also expose:
- continuous `opportunity_score` for sorting
- `relative_opportunity_score` ∈ {1,2,3}
- `impact_band` from within-project percentiles (Very low … Very high)

Filters change which actions are *shown*, never their stored scores/bands.

## Consequences
Weight changes require this ADR update and a regeneration (or re-score) of open actions.
