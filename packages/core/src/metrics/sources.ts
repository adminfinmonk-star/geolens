import { domainMetrics, gapScore } from "./brands.js";

export type DomainClass =
  | "OWN"
  | "COMPETITOR"
  | "EDITORIAL"
  | "UGC"
  | "REFERENCE"
  | "CORPORATE"
  | "OTHER";

export interface SourceFact {
  chatId: string;
  url: string;
  domain: string;
  cited: boolean;
  citationCount: number;
}

export interface ChatMentionFact {
  chatId: string;
  brandId: string;
  isOwn: boolean;
}

export interface DomainReportRow {
  domain: string;
  classification: DomainClass;
  retrieved_percentage: number;
  retrieval_rate: number;
  citation_rate: number;
  total_citations: number;
  citation_share: number;
  retrieval_count: number;
  retrieved_chat_count: number;
  gap_score: number;
  gap_score_normalized: number;
  competitor_brands_mentioned: number;
  own_brand_mentioned: boolean;
  bookmarked?: boolean;
  classification_overridden?: boolean;
}

export interface UrlReportRow {
  url: string;
  domain: string;
  classification: DomainClass;
  retrieval_count: number;
  citation_count: number;
  citation_rate: number;
  gap_score: number;
  gap_score_normalized: number;
  competitor_brands_mentioned: number;
  own_brand_mentioned: boolean;
  bookmarked?: boolean;
}

const DEFAULT_CLASS_BY_DOMAIN: Record<string, DomainClass> = {
  "acme.example": "OWN",
  "betasoft.example": "COMPETITOR",
  "techcrunch.com": "EDITORIAL",
  "forbes.com": "EDITORIAL",
  "g2.com": "EDITORIAL",
  "reddit.com": "UGC",
  "medium.com": "UGC",
  "wikipedia.org": "REFERENCE",
};

export function classifyDomain(
  domain: string,
  opts?: {
    ownedDomains?: string[];
    competitorDomains?: string[];
    override?: DomainClass;
  },
): DomainClass {
  if (opts?.override) return opts.override;
  const d = domain.toLowerCase();
  if (opts?.ownedDomains?.some((x) => x.toLowerCase() === d)) return "OWN";
  if (opts?.competitorDomains?.some((x) => x.toLowerCase() === d)) {
    return "COMPETITOR";
  }
  return DEFAULT_CLASS_BY_DOMAIN[d] ?? "OTHER";
}

/**
 * Aggregate domain metrics from source facts (§8.2) + gap inputs.
 */
export function computeDomainReport(input: {
  sources: SourceFact[];
  mentions: ChatMentionFact[];
  /** Chats in scope (ok+empty for denominators). */
  totalChatCount: number;
  ownedDomains?: string[];
  competitorDomains?: string[];
  trackedCompetitorCount: number;
  classificationOverrides?: Record<string, DomainClass>;
  bookmarks?: Set<string>;
}): DomainReportRow[] {
  const byDomain = new Map<
    string,
    {
      retrievalCount: number;
      citationCount: number;
      chats: Set<string>;
    }
  >();

  for (const s of input.sources) {
    const cur = byDomain.get(s.domain) ?? {
      retrievalCount: 0,
      citationCount: 0,
      chats: new Set<string>(),
    };
    cur.retrievalCount += 1;
    cur.citationCount += s.citationCount;
    cur.chats.add(s.chatId);
    byDomain.set(s.domain, cur);
  }

  const mentionsByChat = new Map<string, ChatMentionFact[]>();
  for (const m of input.mentions) {
    const list = mentionsByChat.get(m.chatId) ?? [];
    list.push(m);
    mentionsByChat.set(m.chatId, list);
  }

  const totalCitationsAll = [...byDomain.values()].reduce(
    (s, d) => s + d.citationCount,
    0,
  );

  const rows: DomainReportRow[] = [];

  for (const [domain, agg] of byDomain) {
    const metrics = domainMetrics({
      domain,
      retrievalCount: agg.retrievalCount,
      retrievedChatCount: agg.chats.size,
      citationCount: agg.citationCount,
      totalChatCount: input.totalChatCount,
    });

    let own = false;
    const competitors = new Set<string>();
    for (const chatId of agg.chats) {
      for (const m of mentionsByChat.get(chatId) ?? []) {
        if (m.isOwn) own = true;
        else competitors.add(m.brandId);
      }
    }

    const rawGap = gapScore({
      retrievalCount: agg.retrievalCount,
      competitorBrandsMentioned: competitors.size,
      trackedCompetitorCount: Math.max(1, input.trackedCompetitorCount),
      ownBrandMentioned: own,
      citationRate: metrics.citationRate,
    });

    const override = input.classificationOverrides?.[domain];
    rows.push({
      domain,
      classification: classifyDomain(domain, {
        ownedDomains: input.ownedDomains,
        competitorDomains: input.competitorDomains,
        override,
      }),
      retrieved_percentage: metrics.retrievedPercentage,
      retrieval_rate: metrics.retrievalRate,
      citation_rate: metrics.citationRate,
      total_citations: agg.citationCount,
      citation_share:
        totalCitationsAll === 0 ? 0 : agg.citationCount / totalCitationsAll,
      retrieval_count: agg.retrievalCount,
      retrieved_chat_count: agg.chats.size,
      gap_score: rawGap,
      gap_score_normalized: 0,
      competitor_brands_mentioned: competitors.size,
      own_brand_mentioned: own,
      bookmarked: input.bookmarks?.has(domain) ?? false,
      classification_overridden: Boolean(override),
    });
  }

  normalizeGaps(rows);
  return rows.sort((a, b) => b.retrieval_count - a.retrieval_count);
}

export function computeUrlReport(input: {
  sources: SourceFact[];
  mentions: ChatMentionFact[];
  trackedCompetitorCount: number;
  ownedDomains?: string[];
  competitorDomains?: string[];
  classificationOverrides?: Record<string, DomainClass>;
  bookmarks?: Set<string>;
}): UrlReportRow[] {
  const byUrl = new Map<
    string,
    {
      domain: string;
      chats: Set<string>;
      citationCount: number;
    }
  >();

  for (const s of input.sources) {
    const cur = byUrl.get(s.url) ?? {
      domain: s.domain,
      chats: new Set<string>(),
      citationCount: 0,
    };
    cur.chats.add(s.chatId);
    cur.citationCount += s.citationCount;
    byUrl.set(s.url, cur);
  }

  const mentionsByChat = new Map<string, ChatMentionFact[]>();
  for (const m of input.mentions) {
    const list = mentionsByChat.get(m.chatId) ?? [];
    list.push(m);
    mentionsByChat.set(m.chatId, list);
  }

  const rows: UrlReportRow[] = [];
  for (const [url, agg] of byUrl) {
    const retrievalCount = agg.chats.size;
    const citationRate =
      retrievalCount === 0 ? 0 : agg.citationCount / retrievalCount;

    let own = false;
    const competitors = new Set<string>();
    for (const chatId of agg.chats) {
      for (const m of mentionsByChat.get(chatId) ?? []) {
        if (m.isOwn) own = true;
        else competitors.add(m.brandId);
      }
    }

    const rawGap = gapScore({
      retrievalCount,
      competitorBrandsMentioned: competitors.size,
      trackedCompetitorCount: Math.max(1, input.trackedCompetitorCount),
      ownBrandMentioned: own,
      citationRate,
    });

    const override = input.classificationOverrides?.[agg.domain];
    rows.push({
      url,
      domain: agg.domain,
      classification: classifyDomain(agg.domain, {
        ownedDomains: input.ownedDomains,
        competitorDomains: input.competitorDomains,
        override,
      }),
      retrieval_count: retrievalCount,
      citation_count: agg.citationCount,
      citation_rate: citationRate,
      gap_score: rawGap,
      gap_score_normalized: 0,
      competitor_brands_mentioned: competitors.size,
      own_brand_mentioned: own,
      bookmarked: input.bookmarks?.has(url) ?? false,
    });
  }

  normalizeGaps(rows);
  return rows.sort((a, b) => b.retrieval_count - a.retrieval_count);
}

function normalizeGaps(
  rows: Array<{ gap_score: number; gap_score_normalized: number }>,
) {
  const max = Math.max(0, ...rows.map((r) => r.gap_score));
  for (const r of rows) {
    r.gap_score_normalized = max === 0 ? 0 : (r.gap_score / max) * 100;
  }
}

/** Gap Analysis: domains/URLs where you are absent and competitors appear. */
export function filterGaps<
  T extends {
    own_brand_mentioned: boolean;
    competitor_brands_mentioned: number;
    gap_score: number;
  },
>(rows: T[]): T[] {
  return rows
    .filter((r) => !r.own_brand_mentioned && r.competitor_brands_mentioned > 0)
    .sort((a, b) => b.gap_score - a.gap_score);
}

export function gapGuidance(classification: DomainClass): string {
  switch (classification) {
    case "EDITORIAL":
      return "Pitch / PR placement on this publication";
    case "CORPORATE":
      return "Partnerships or listings on this corporate site";
    case "UGC":
      return "Community engagement where this discussion happens";
    case "REFERENCE":
      return "Correct the record on this reference source";
    case "OWN":
      return "Improve structure and AI-readability of your pages";
    case "COMPETITOR":
      return "Win mentions on competitor-owned properties via comparison content";
    default:
      return "Evaluate placement opportunity for this source type";
  }
}
