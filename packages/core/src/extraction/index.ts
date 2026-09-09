import { findBrandMentions, type BrandMatcher } from "./brands.js";
import { assignPositions } from "./position.js";
import { scoreSentimentAround } from "./sentiment.js";
import { extractDomain, normalizeUrl } from "./url.js";

export interface RawSourceInput {
  url: string;
  cited: boolean;
  citationCount: number;
  citationPosition?: number;
  retrievalRank: number;
  title?: string;
}

export interface EnrichedSource {
  url: string;
  domain: string;
  cited: boolean;
  citationCount: number;
  citationPosition?: number;
  retrievalRank: number;
  title?: string;
}

export interface EnrichedMention {
  brandId: string;
  brandName: string;
  matchedText: string;
  position: number;
  sentiment: number;
  start: number;
  end: number;
}

export interface EnrichmentResult {
  mentions: EnrichedMention[];
  sources: EnrichedSource[];
}

export function enrichChat(input: {
  text: string;
  brands: BrandMatcher[];
  sources: RawSourceInput[];
}): EnrichmentResult {
  const rawMentions = findBrandMentions(input.text, input.brands);
  const positioned = assignPositions(rawMentions);
  const mentions: EnrichedMention[] = positioned.map((m) => ({
    brandId: m.brandId,
    brandName: m.brandName,
    matchedText: m.matchedText,
    position: m.position,
    sentiment: scoreSentimentAround(input.text, m.start, m.end),
    start: m.start,
    end: m.end,
  }));

  const sources: EnrichedSource[] = input.sources.map((s) => {
    const url = normalizeUrl(s.url);
    return {
      url,
      domain: extractDomain(url),
      cited: s.cited,
      citationCount: s.citationCount,
      citationPosition: s.citationPosition,
      retrievalRank: s.retrievalRank,
      title: s.title,
    };
  });

  return { mentions, sources };
}

export * from "./brands.js";
export * from "./position.js";
export * from "./sentiment.js";
export * from "./url.js";
