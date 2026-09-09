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
