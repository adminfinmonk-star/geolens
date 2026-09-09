import { describe, expect, it } from "vitest";
import {
  computeBrandMetrics,
  domainMetrics,
  gapScore,
} from "./brands.js";

describe("computeBrandMetrics §8.1", () => {
  it("matches the worked Visibility / SoV example", () => {
    // 10 chats in scope; brand A in 4 chats with 4 mentions; competitor B 12 mentions
    const chats = Array.from({ length: 10 }, (_, i) => ({
      chatId: `cht_${i}`,
      status: "ok" as const,
    }));

    const facts = [
      ...[0, 1, 2, 3].map((i) => ({
        chatId: `cht_${i}`,
        brandId: "br_a",
        mentionCount: 1,
        position: 1,
        sentiment: 0.5,
      })),
      ...[0, 1, 2, 3].flatMap((i) => [
        {
          chatId: `cht_${i}`,
          brandId: "br_b",
          mentionCount: 3,
          position: 2,
          sentiment: 0,
        },
      ]),
    ];

    const metrics = computeBrandMetrics(chats, facts, ["br_a", "br_b"]);
    const a = metrics.find((m) => m.brandId === "br_a")!;
    const b = metrics.find((m) => m.brandId === "br_b")!;

    expect(a.visibility).toBeCloseTo(0.4, 5);
    expect(a.mentionCount).toBe(4);
    expect(b.mentionCount).toBe(12);
    expect(a.shareOfVoice).toBeCloseTo(4 / 16, 5);
    expect(b.shareOfVoice).toBeCloseTo(12 / 16, 5);
  });

  it("excludes error/blocked from visibility_total", () => {
    const chats = [
      { chatId: "1", status: "ok" as const },
      { chatId: "2", status: "error" as const },
      { chatId: "3", status: "empty" as const },
    ];
    const metrics = computeBrandMetrics(
      chats,
      [{ chatId: "1", brandId: "br_a", mentionCount: 1, position: 1, sentiment: 0 }],
      ["br_a"],
    );
    expect(metrics[0]?.visibilityTotal).toBe(2);
    expect(metrics[0]?.visibility).toBeCloseTo(0.5, 5);
  });

  it("recombines sentiment from sums (never averages percentages)", () => {
    const chats = [
      { chatId: "1", status: "ok" as const },
      { chatId: "2", status: "ok" as const },
    ];
    // sentiments -1 and +1 → mean 0 → display 50
    const metrics = computeBrandMetrics(
      chats,
      [
        {
          chatId: "1",
          brandId: "br_a",
          mentionCount: 1,
          position: 1,
          sentiment: -1,
        },
        {
          chatId: "2",
          brandId: "br_a",
          mentionCount: 1,
          position: 1,
          sentiment: 1,
        },
      ],
      ["br_a"],
    );
    expect(metrics[0]?.sentiment).toBeCloseTo(50, 5);
  });
});

describe("domainMetrics §8.2 trap", () => {
  it("one chat, 3 URLs from domain, 4 citations → rates as specified", () => {
    const m = domainMetrics({
      domain: "example.com",
      retrievalCount: 3,
      retrievedChatCount: 1,
      citationCount: 4,
      totalChatCount: 1,
    });
    expect(m.retrievalRate).toBeCloseTo(3.0, 5);
    expect(m.retrievedPercentage).toBeCloseTo(1.0, 5);
    expect(m.citationRate).toBeCloseTo(4.0, 5);
  });
});

describe("gapScore", () => {
  it("is zero when own brand is mentioned", () => {
    expect(
      gapScore({
        retrievalCount: 10,
        competitorBrandsMentioned: 3,
        trackedCompetitorCount: 3,
        ownBrandMentioned: true,
        citationRate: 2,
      }),
    ).toBe(0);
  });

  it("increases with retrieval and citations when absent", () => {
    const low = gapScore({
      retrievalCount: 2,
      competitorBrandsMentioned: 1,
      trackedCompetitorCount: 3,
      ownBrandMentioned: false,
      citationRate: 0,
    });
    const high = gapScore({
      retrievalCount: 20,
      competitorBrandsMentioned: 3,
      trackedCompetitorCount: 3,
      ownBrandMentioned: false,
      citationRate: 2,
    });
    expect(high).toBeGreaterThan(low);
  });
});
