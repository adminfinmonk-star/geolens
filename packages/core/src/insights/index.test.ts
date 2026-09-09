import { describe, expect, it } from "vitest";
import { computePerformanceMatrix } from "./index.js";

describe("computePerformanceMatrix", () => {
  it("shows higher visibility on one channel vs another for a topic", () => {
    const chats = [
      {
        chatId: "1",
        status: "ok" as const,
        channelId: "sim-0",
        countryCode: "US",
        topicId: "tpc_a",
        promptId: "pr_1",
      },
      {
        chatId: "2",
        status: "ok" as const,
        channelId: "sim-0",
        countryCode: "US",
        topicId: "tpc_a",
        promptId: "pr_1",
      },
      {
        chatId: "3",
        status: "ok" as const,
        channelId: "openai-1",
        countryCode: "US",
        topicId: "tpc_a",
        promptId: "pr_1",
      },
      {
        chatId: "4",
        status: "ok" as const,
        channelId: "openai-1",
        countryCode: "US",
        topicId: "tpc_a",
        promptId: "pr_1",
      },
    ];
    const mentions = [
      {
        chatId: "1",
        brandId: "br_acme",
        mentionCount: 1,
        position: 1,
        sentiment: 0.5,
      },
      {
        chatId: "2",
        brandId: "br_acme",
        mentionCount: 1,
        position: 1,
        sentiment: 0.5,
      },
      // openai-1: only 1 of 2 chats
      {
        chatId: "3",
        brandId: "br_acme",
        mentionCount: 1,
        position: 2,
        sentiment: 0,
      },
    ];
    const matrix = computePerformanceMatrix({
      chats,
      mentions,
      brandId: "br_acme",
      rowAxis: "topic",
      colAxis: "channel",
    });
    const sim = matrix.cells.find(
      (c) => c.rowKey === "tpc_a" && c.colKey === "sim-0",
    )!;
    const oai = matrix.cells.find(
      (c) => c.rowKey === "tpc_a" && c.colKey === "openai-1",
    )!;
    expect(sim.visibility).toBeCloseTo(1, 5);
    expect(oai.visibility).toBeCloseTo(0.5, 5);
    expect(sim.visibility).toBeGreaterThan(oai.visibility);
  });
});
