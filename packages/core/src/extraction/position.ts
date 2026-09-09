import type { BrandMention } from "./brands.js";

export interface PositionedMention extends BrandMention {
  /** 1-based first-appearance order among distinct brands in the answer. */
  position: number;
}

/**
 * Position = order of first appearance of each distinct brand (§7.2).
 * Subsequent mentions of the same brand keep the first position.
 */
export function assignPositions(mentions: BrandMention[]): PositionedMention[] {
  const firstOrder = new Map<string, number>();
  let next = 1;
  for (const m of mentions) {
    if (!firstOrder.has(m.brandId)) {
      firstOrder.set(m.brandId, next++);
    }
  }
  return mentions.map((m) => ({
    ...m,
    position: firstOrder.get(m.brandId)!,
  }));
}
