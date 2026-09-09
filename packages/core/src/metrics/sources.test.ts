import { describe, expect, it } from "vitest";
import {
  computeDomainReport,
  computeUrlReport,
  filterGaps,
  gapGuidance,
} from "./sources.js";

describe("computeDomainReport §8.2", () => {
  it("matches the one-chat three-URL fixture", () => {
    const sources = [
      {
        chatId: "c1",
        url: "https://example.com/a",
        domain: "example.com",
        cited: true,
        citationCount: 2,
      },
      {
        chatId: "c1",
        url: "https://example.com/b",
        domain: "example.com",
        cited: true,
        citationCount: 1,
      },
      {
        chatId: "c1",
        url: "https://example.com/c",
        domain: "example.com",
        cited: true,
        citationCount: 1,
      },
    ];
    const rows = computeDomainReport({
      sources,
      mentions: [
        { chatId: "c1", brandId: "br_b", isOwn: false },
        { chatId: "c1", brandId: "br_c", isOwn: false },
      ],
      totalChatCount: 1,
      trackedCompetitorCount: 3,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.retrieval_rate).toBeCloseTo(3.0, 5);
    expect(rows[0]!.retrieved_percentage).toBeCloseTo(1.0, 5);
    expect(rows[0]!.citation_rate).toBeCloseTo(4.0, 5);
    expect(rows[0]!.own_brand_mentioned).toBe(false);
    expect(rows[0]!.gap_score).toBeGreaterThan(0);
  });

  it("zeroes gap when own brand is mentioned", () => {
    const rows = computeDomainReport({
      sources: [
        {
          chatId: "c1",
          url: "https://reddit.com/r/x",
          domain: "reddit.com",
          cited: true,
          citationCount: 2,
        },
      ],
      mentions: [{ chatId: "c1", brandId: "br_acme", isOwn: true }],
      totalChatCount: 1,
      trackedCompetitorCount: 3,
    });
    expect(rows[0]!.gap_score).toBe(0);
    expect(filterGaps(rows)).toHaveLength(0);
  });
});

describe("computeUrlReport", () => {
  it("uses chat-distinct retrieval_count", () => {
    const rows = computeUrlReport({
      sources: [
        {
          chatId: "c1",
          url: "https://g2.com/p",
          domain: "g2.com",
          cited: true,
          citationCount: 2,
        },
        {
          chatId: "c2",
          url: "https://g2.com/p",
          domain: "g2.com",
          cited: false,
          citationCount: 0,
        },
      ],
      mentions: [
        { chatId: "c1", brandId: "br_b", isOwn: false },
        { chatId: "c2", brandId: "br_b", isOwn: false },
      ],
      trackedCompetitorCount: 2,
    });
    expect(rows[0]!.retrieval_count).toBe(2);
    expect(rows[0]!.citation_rate).toBeCloseTo(1.0, 5);
    expect(rows[0]!.classification).toBe("EDITORIAL");
  });
});

describe("gapGuidance", () => {
  it("maps editorial to PR guidance", () => {
    expect(gapGuidance("EDITORIAL")).toMatch(/PR/i);
  });
});
