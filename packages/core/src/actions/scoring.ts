/**
 * Opportunity scoring weights (§9.3).
 * Published here + ADR 0002 — do not scatter magic numbers.
 */
export const OPPORTUNITY_WEIGHTS = {
  /** How much retrieval / citation traffic the gap represents (0–1). */
  w1_gap_volume: 0.3,
  /** How many rivals already benefit (0–1). */
  w2_competitor_density: 0.2,
  /** Prompt volume × prompt count in the topic (0–1). */
  w3_topic_importance: 0.2,
  /** OWNED > REFERENCE > EARNED addressability (0–1). */
  w4_addressability: 0.2,
  /** Effort penalty: technical < page edit < new page < earned (0–1). */
  w5_estimated_effort: 0.1,
} as const;

export interface ScoreInputs {
  gap_volume: number;
  competitor_density: number;
  topic_importance: number;
  addressability: number;
  /** Higher = harder; subtracted. */
  estimated_effort: number;
}

/** Continuous score in roughly [0, 1] for sorting. */
export function computeOpportunityScore(input: ScoreInputs): number {
  const w = OPPORTUNITY_WEIGHTS;
  const raw =
    w.w1_gap_volume * clamp01(input.gap_volume) +
    w.w2_competitor_density * clamp01(input.competitor_density) +
    w.w3_topic_importance * clamp01(input.topic_importance) +
    w.w4_addressability * clamp01(input.addressability) -
    w.w5_estimated_effort * clamp01(input.estimated_effort);
  return Math.round(clamp01(raw) * 1000) / 1000;
}

/** Coarse 1=Low, 2=Medium, 3=High for prose. */
export function relativeOpportunityScore(score: number): 1 | 2 | 3 {
  if (score < 0.34) return 1;
  if (score < 0.67) return 2;
  return 3;
}

export type ImpactBand =
  | "Very low"
  | "Low"
  | "Medium"
  | "High"
  | "Very high";

/** Within-project percentile → 5-band label. */
export function bandFromPercentile(p: number): ImpactBand {
  if (p < 0.2) return "Very low";
  if (p < 0.4) return "Low";
  if (p < 0.6) return "Medium";
  if (p < 0.8) return "High";
  return "Very high";
}

/**
 * Assign bands from within-project score ranking.
 * Filters must not re-run this — bands are sticky on the action.
 */
export function assignProjectBands<T extends { opportunity_score: number }>(
  actions: T[],
): (T & { impact_band: ImpactBand })[] {
  if (actions.length === 0) return [];
  const sorted = [...actions].sort(
    (a, b) => a.opportunity_score - b.opportunity_score,
  );
  const rank = new Map<T, number>();
  sorted.forEach((a, i) => {
    const p = actions.length === 1 ? 0.5 : i / (actions.length - 1);
    rank.set(a, p);
  });
  return actions.map((a) => ({
    ...a,
    impact_band: bandFromPercentile(rank.get(a) ?? 0.5),
  }));
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Addressability presets by playbook. */
export const ADDRESSABILITY = {
  OWNED: 1.0,
  SITE_AUDIT: 0.95,
  REFERENCE: 0.7,
  UGC: 0.55,
  EDITORIAL: 0.4,
  SHOPPING: 0.85,
} as const;

/** Effort presets (higher = harder). */
export const EFFORT = {
  technical_fix: 0.15,
  page_edit: 0.35,
  new_page: 0.55,
  community: 0.5,
  directory_claim: 0.45,
  earned_placement: 0.85,
  product_pdp: 0.4,
} as const;
