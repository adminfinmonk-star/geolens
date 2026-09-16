/**
 * Brand metric aggregation (§8.1, §8.3).
 * Ratios recombined from component sums — never averaged.
 */

export interface ChatBrandFact {
  chatId: string;
  brandId: string;
  /** Occurrences in this chat (≥1 if present). */
  mentionCount: number;
  /** First-appearance position (1-based). */
  position: number;
  /** Mean sentiment in [-1, 1] for mentions in this chat. */
  sentiment: number;
}

export interface ChatFact {
  chatId: string;
  /** ok | empty count toward visibility_total; error/blocked do not. */
  status: "ok" | "empty" | "error" | "blocked";
}

export interface BrandMetricComponents {
  brandId: string;
  visibilityCount: number;
  visibilityTotal: number;
  mentionCount: number;
  positionSum: number;
  positionCount: number;
  sentimentSum: number;
  sentimentCount: number;
}

export interface BrandMetrics {
  brandId: string;
  visibility: number;
  shareOfVoice: number;
  position: number | null;
  sentiment: number | null;
  mentionCount: number;
  visibilityCount: number;
  visibilityTotal: number;
}

export function computeVisibilityTotal(chats: ChatFact[]): number {
  return chats.filter((c) => c.status === "ok" || c.status === "empty").length;
}

export function accumulateBrandComponents(
  chats: ChatFact[],
  facts: ChatBrandFact[],
  brandIds: string[],
): BrandMetricComponents[] {
  const visibilityTotal = computeVisibilityTotal(chats);
  const byBrand = new Map<string, BrandMetricComponents>();

  for (const id of brandIds) {
    byBrand.set(id, {
      brandId: id,
      visibilityCount: 0,
      visibilityTotal,
      mentionCount: 0,
      positionSum: 0,
      positionCount: 0,
      sentimentSum: 0,
      sentimentCount: 0,
    });
  }

  const seen = new Set<string>(); // brandId|chatId for visibility

  for (const f of facts) {
    const row = byBrand.get(f.brandId);
    if (!row) continue;
    row.mentionCount += f.mentionCount;
    row.positionSum += f.position;
    row.positionCount += 1;
    row.sentimentSum += f.sentiment;
    row.sentimentCount += 1;
    const key = `${f.brandId}|${f.chatId}`;
    if (!seen.has(key)) {
      seen.add(key);
      row.visibilityCount += 1;
    }
  }

  return [...byBrand.values()];
}

export function finalizeBrandMetrics(
  components: BrandMetricComponents[],
): BrandMetrics[] {
  const totalMentions = components.reduce((s, c) => s + c.mentionCount, 0);

  return components.map((c) => {
    const visibility =
      c.visibilityTotal === 0 ? 0 : c.visibilityCount / c.visibilityTotal;
    const shareOfVoice =
      totalMentions === 0 ? 0 : c.mentionCount / totalMentions;
    const position =
      c.positionCount === 0 ? null : c.positionSum / c.positionCount;
    const sentiment =
      c.sentimentCount === 0
        ? null
        : ((c.sentimentSum / c.sentimentCount) / 2 + 0.5) * 100;

    return {
      brandId: c.brandId,
      visibility,
      shareOfVoice,
      position,
      sentiment,
      mentionCount: c.mentionCount,
      visibilityCount: c.visibilityCount,
      visibilityTotal: c.visibilityTotal,
    };
  });
}

export function computeBrandMetrics(
  chats: ChatFact[],
  facts: ChatBrandFact[],
  brandIds: string[],
): BrandMetrics[] {
  return finalizeBrandMetrics(
    accumulateBrandComponents(chats, facts, brandIds),
  );
}

/** Shrink a 0–1 rate toward a prior when the chat sample is tiny. */
export const SCORE_SAMPLE_K = 8;
export const SCORE_PRIOR = 0.32;

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export type CompetitiveScoreBand = "high" | "medium" | "low";

export interface CompetitiveVisibilityScore {
  value: number;
  band: CompetitiveScoreBand;
  sampleThin: boolean;
  /** Unsmoothed mix of presence, SoV, and placement (0–1). */
  raw: number;
}

/**
 * Overview gauge score. §8 `visibility` is presence (mentioned in a chat).
 * Listicle answers mention every tracked brand, so presence saturates at 1.0
 * even when share of voice is a third and the brand ranks 3rd. Blend presence
 * with SoV and placement, then shrink toward a modest prior until n ≥ 8.
 */
export function competitiveVisibilityScore(input: {
  visibility: number;
  shareOfVoice: number;
  position: number | null;
  eligibleChats: number;
}): CompetitiveVisibilityScore {
  const vis = clamp01(input.visibility);
  const sov = clamp01(input.shareOfVoice);
  const placement =
    input.position == null
      ? 0.45
      : clamp01(1 - (input.position - 1) / 4);
  const raw = 0.4 * vis + 0.45 * sov + 0.15 * placement;
  const n = Math.max(0, input.eligibleChats);
  const weight = n / (n + SCORE_SAMPLE_K);
  const blended = weight * raw + (1 - weight) * SCORE_PRIOR;
  const value = Math.round(100 * clamp01(blended));
  const band: CompetitiveScoreBand =
    value >= 60 ? "high" : value >= 35 ? "medium" : "low";
  return {
    value,
    band,
    sampleThin: n < SCORE_SAMPLE_K,
    raw,
  };
}

export function compareBrandRank(
  a: {
    share_of_voice: number;
    position: number | null;
    visibility: number;
  },
  b: {
    share_of_voice: number;
    position: number | null;
    visibility: number;
  },
): number {
  if (b.share_of_voice !== a.share_of_voice) {
    return b.share_of_voice - a.share_of_voice;
  }
  const pa = a.position ?? Number.POSITIVE_INFINITY;
  const pb = b.position ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  return b.visibility - a.visibility;
}

/** Domain source metrics (§8.2) — unit-test the trap cases. */
export interface DomainSourceAgg {
  domain: string;
  retrievalCount: number;
  retrievedChatCount: number;
  citationCount: number;
  totalChatCount: number;
}

export function domainMetrics(agg: DomainSourceAgg) {
  const retrievedPercentage =
    agg.totalChatCount === 0
      ? 0
      : agg.retrievedChatCount / agg.totalChatCount;
  const retrievalRate =
    agg.totalChatCount === 0 ? 0 : agg.retrievalCount / agg.totalChatCount;
  const citationRate =
    agg.retrievedChatCount === 0
      ? 0
      : agg.citationCount / agg.retrievedChatCount;

  return { retrievedPercentage, retrievalRate, citationRate };
}

export function gapScore(input: {
  retrievalCount: number;
  competitorBrandsMentioned: number;
  trackedCompetitorCount: number;
  ownBrandMentioned: boolean;
  citationRate: number;
}): number {
  if (input.ownBrandMentioned) return 0;
  return (
    Math.log1p(input.retrievalCount) *
    (input.competitorBrandsMentioned /
      Math.max(1, input.trackedCompetitorCount)) *
    (1 + input.citationRate)
  );
}
