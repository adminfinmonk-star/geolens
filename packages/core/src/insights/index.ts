import { computeBrandMetrics, type BrandMetrics } from "../metrics/brands.js";

export type MatrixAxis = "topic" | "channel" | "country" | "brand";

export interface MatrixCell {
  rowKey: string;
  colKey: string;
  visibility: number;
  share_of_voice: number;
  position: number | null;
  sentiment: number | null;
  visibility_count: number;
  visibility_total: number;
}

export interface MatrixResult {
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  rowKeys: string[];
  colKeys: string[];
  cells: MatrixCell[];
  metric: "visibility";
}

export interface InsightChat {
  chatId: string;
  status: "ok" | "empty" | "error" | "blocked";
  channelId: string;
  countryCode: string;
  topicId: string;
  promptId: string;
}

export interface InsightMention {
  chatId: string;
  brandId: string;
  mentionCount: number;
  position: number;
  sentiment: number;
}

/**
 * Performance matrix: brand metrics sliced by two dimensions (§15.6).
 * Default answers "which topics do I own on channel A vs B".
 */
export function computePerformanceMatrix(input: {
  chats: InsightChat[];
  mentions: InsightMention[];
  brandId: string;
  rowAxis: MatrixAxis;
  colAxis: MatrixAxis;
  /** Optional filter to one brand for the cell metric focus */
}): MatrixResult {
  const rowKeys = uniqueKeys(input.chats, input.rowAxis);
  const colKeys = uniqueKeys(input.chats, input.colAxis);
  const cells: MatrixCell[] = [];

  for (const rowKey of rowKeys) {
    for (const colKey of colKeys) {
      const scopedChats = input.chats.filter(
        (c) =>
          axisValue(c, input.rowAxis) === rowKey &&
          axisValue(c, input.colAxis) === colKey,
      );
      const chatIds = new Set(scopedChats.map((c) => c.chatId));
      const scopedMentions = input.mentions.filter((m) =>
        chatIds.has(m.chatId),
      );
      const metrics = computeBrandMetrics(
        scopedChats.map((c) => ({ chatId: c.chatId, status: c.status })),
        scopedMentions.map((m) => ({
          chatId: m.chatId,
          brandId: m.brandId,
          mentionCount: m.mentionCount,
          position: m.position,
          sentiment: m.sentiment,
        })),
        [input.brandId],
      );
      const m = metrics[0]!;
      cells.push({
        rowKey,
        colKey,
        visibility: m.visibility,
        share_of_voice: m.shareOfVoice,
        position: m.position,
        sentiment: m.sentiment,
        visibility_count: m.visibilityCount,
        visibility_total: m.visibilityTotal,
      });
    }
  }

  return {
    rowAxis: input.rowAxis,
    colAxis: input.colAxis,
    rowKeys,
    colKeys,
    cells,
    metric: "visibility",
  };
}

function axisValue(c: InsightChat, axis: MatrixAxis): string {
  switch (axis) {
    case "topic":
      return c.topicId;
    case "channel":
      return c.channelId;
    case "country":
      return c.countryCode;
    case "brand":
      return c.promptId;
  }
}

function uniqueKeys(chats: InsightChat[], axis: MatrixAxis): string[] {
  return [...new Set(chats.map((c) => axisValue(c, axis)))].sort();
}

export function strongestWeakestChannel(
  matrix: MatrixResult,
  rowKey: string,
): { strongest: string | null; weakest: string | null } {
  const cells = matrix.cells.filter((c) => c.rowKey === rowKey);
  if (cells.length === 0) return { strongest: null, weakest: null };
  const sorted = [...cells].sort((a, b) => b.visibility - a.visibility);
  return {
    strongest: sorted[0]?.colKey ?? null,
    weakest: sorted[sorted.length - 1]?.colKey ?? null,
  };
}

export type { BrandMetrics };
