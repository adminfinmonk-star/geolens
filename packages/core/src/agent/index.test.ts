import { describe, expect, it } from "vitest";
import {
  ingestAccessLogBatch,
  joinVisitedUrls,
  parseAccessLogFile,
} from "./crawlInsights.js";

const matchBot = (ua: string) => {
  if (ua.includes("GPTBot")) {
    return { userAgentToken: "GPTBot", vendor: "OpenAI", type: "training" };
  }
  if (ua.includes("PerplexityBot")) {
    return {
      userAgentToken: "PerplexityBot",
      vendor: "Perplexity",
      type: "search",
    };
  }
  return null;
};

describe("ingestAccessLogBatch", () => {
  it("keeps AI bots and discards browsers", () => {
    const res = ingestAccessLogBatch(
      [
        {
          timestamp: "2026-01-15T12:00:00Z",
          request_method: "GET",
          request_url: "https://acme.example/blog/post",
          response_status: 200,
          user_agent: "Mozilla/5.0",
        },
        {
          timestamp: "2026-01-15T12:01:00Z",
          request_method: "GET",
          request_url: "https://acme.example/docs/guide",
          response_status: 404,
          user_agent: "GPTBot/2.0",
        },
      ],
      matchBot,
    );
    expect(res.accepted).toHaveLength(1);
    expect(res.discarded_non_bot).toBe(1);
    expect(res.accepted[0]!.bot_token).toBe("GPTBot");
  });
});

describe("joinVisitedUrls", () => {
  it("flags crawled-but-never-cited URLs", () => {
    const logs = ingestAccessLogBatch(
      [
        {
          timestamp: "2026-01-15T12:01:00Z",
          request_method: "GET",
          request_url: "https://acme.example/legacy/pricing",
          response_status: 200,
          user_agent: "PerplexityBot/1.0",
        },
        {
          timestamp: "2026-01-15T12:02:00Z",
          request_method: "GET",
          request_url: "https://acme.example/blog/cited",
          response_status: 200,
          user_agent: "GPTBot/2.0",
        },
      ],
      matchBot,
    ).accepted;

    const joined = joinVisitedUrls(logs, [
      {
        url: "https://acme.example/blog/cited",
        retrievals: 10,
        citations: 4,
        topics: ["Pricing"],
      },
    ]);
    const legacy = joined.find((u) => u.url.includes("legacy"))!;
    const cited = joined.find((u) => u.url.includes("cited"))!;
    expect(legacy.crawled_never_cited).toBe(true);
    expect(cited.crawled_never_cited).toBe(false);
    expect(cited.citation_rate).toBeCloseTo(0.4);
  });
});

describe("parseAccessLogFile", () => {
  it("parses CSV rows", () => {
    const rows = parseAccessLogFile(
      "2026-01-15T12:00:00Z,GET,https://acme.example/x,200,GPTBot/2.0\n",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.user_agent).toContain("GPTBot");
  });
});
