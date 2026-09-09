/**
 * Brand Perception scoring (§10.1) — pure functions, no I/O.
 */

/** First mention = 100, −10 per rank, 0 below tenth. Absent → 0. */
export function positionalProminence(rank: number | null): number {
  if (rank == null || rank < 1) return 0;
  if (rank > 10) return 0;
  return Math.max(0, 100 - (rank - 1) * 10);
}

export interface AttributeScore {
  attributeId: string;
  label: string;
  /** Type A: "What is {brand} known for?" */
  association: number;
  /** Type B: own brand's market prominence for this attr */
  market_prominence: number;
  /** Rank among brands on type-B (1 = leader). null = Unplaced */
  market_rank: number | null;
  brands_carrying: number;
}

export interface PerceptionSummaryCards {
  most_associated: { label: string; score: number } | null;
  best_vs_competitors: {
    label: string;
    own_rank: number;
    brands_carrying: number;
    normalized: number;
  } | null;
  biggest_gap: {
    label: string;
    association: number;
    market_rank: number | null;
    statement: string;
  } | null;
  strongest_competitor: { brand: string; mean_prominence: number } | null;
  headline: string;
}

/**
 * Biggest gap: high association, low market prominence.
 * Render `#1 → #9` or `#1 → Unplaced`.
 * Requires ≥4 attributes with both scores.
 */
export function computeBiggestGap(
  attrs: AttributeScore[],
  ownBrandName: string,
): PerceptionSummaryCards["biggest_gap"] {
  const eligible = attrs.filter(
    (a) => a.association > 0 && a.brands_carrying >= 1,
  );
  if (eligible.length < 4) return null;

  // Gap magnitude: association high + market rank poor (or unplaced)
  let best: AttributeScore | null = null;
  let bestGap = -Infinity;
  for (const a of eligible) {
    const marketPenalty =
      a.market_rank == null
        ? 100
        : Math.max(0, (a.market_rank - 1) * 12);
    const gap = a.association * 0.6 + marketPenalty * 0.4 - a.market_prominence * 0.2;
    if (gap > bestGap) {
      bestGap = gap;
      best = a;
    }
  }
  if (!best) return null;
  const from = "#1"; // association leadership framing for the card
  const to =
    best.market_rank == null ? "Unplaced" : `#${best.market_rank}`;
  return {
    label: best.label,
    association: best.association,
    market_rank: best.market_rank,
    statement: `${ownBrandName} is strongly associated with "${best.label}" (${from} in brand asks) but ranks ${to} when the market is asked who owns that attribute (${from} → ${to}).`,
  };
}

export function computePerceptionSummary(
  attrs: AttributeScore[],
  ownBrandName: string,
  competitorProminence: { brand: string; mean: number }[],
): PerceptionSummaryCards {
  const most = [...attrs].sort((a, b) => b.association - a.association)[0];
  const bestVs = [...attrs]
    .filter((a) => a.market_rank != null && a.brands_carrying >= 2)
    .map((a) => ({
      label: a.label,
      own_rank: a.market_rank!,
      brands_carrying: a.brands_carrying,
      // Normalize: closer to 1 is better; adjust by field size
      normalized:
        1 -
        (a.market_rank! - 1) / Math.max(1, a.brands_carrying - 1),
    }))
    .sort((a, b) => b.normalized - a.normalized)[0];

  const strongest = [...competitorProminence].sort(
    (a, b) => b.mean - a.mean,
  )[0];

  const biggest_gap = computeBiggestGap(attrs, ownBrandName);

  return {
    most_associated: most
      ? { label: most.label, score: most.association }
      : null,
    best_vs_competitors: bestVs ?? null,
    biggest_gap,
    strongest_competitor: strongest
      ? { brand: strongest.brand, mean_prominence: strongest.mean }
      : null,
    headline: most
      ? `AI describes ${ownBrandName} as ${most.label}, but it competes best on ${bestVs?.label ?? most.label}.`
      : `No perception attributes yet for ${ownBrandName}.`,
  };
}

/** Deterministic attribute extraction from answer text (fixture / offline). */
export function extractAttributeTerms(text: string): string[] {
  const known = [
    "reliable",
    "affordable",
    "enterprise",
    "security",
    "integrations",
    "easy to use",
    "analytics",
    "customer support",
    "scalability",
    "design",
  ];
  const lower = text.toLowerCase();
  return known.filter((k) => lower.includes(k));
}

export function generateMarketProbes(input: {
  brand: string;
  industry: string;
  attributes: string[];
}): { type: "A" | "B"; text: string }[] {
  const probes: { type: "A" | "B"; text: string }[] = [];
  for (let i = 0; i < 8; i++) {
    probes.push({
      type: "A",
      text: `What is ${input.brand} known for in ${input.industry}? (probe ${i + 1})`,
    });
  }
  for (const attr of input.attributes.slice(0, 8)) {
    probes.push({
      type: "B",
      text: `Which brands are known for ${attr} in ${input.industry}?`,
    });
  }
  return probes;
}
