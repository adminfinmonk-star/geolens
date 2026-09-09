/**
 * Heuristic sentiment scoring (§7.3) without LLM for Phase 1 CI.
 * Returns score in [-1, 1]. Spec LLM path can replace later; formula consumers
 * still use sentiment_sum / sentiment_count.
 */

const POSITIVE = [
  "best",
  "excellent",
  "leading",
  "reliable",
  "recommended",
  "strong",
  "top",
  "great",
  "innovative",
  "trusted",
];

const NEGATIVE = [
  "worst",
  "poor",
  "unreliable",
  "avoid",
  "weak",
  "expensive",
  "slow",
  "limited",
  "outdated",
  "problematic",
];

export function scoreSentimentAround(
  text: string,
  start: number,
  end: number,
  window = 80,
): number {
  const from = Math.max(0, start - window);
  const to = Math.min(text.length, end + window);
  const slice = text.slice(from, to).toLowerCase();

  let score = 0;
  for (const w of POSITIVE) {
    if (slice.includes(w)) score += 0.25;
  }
  for (const w of NEGATIVE) {
    if (slice.includes(w)) score -= 0.25;
  }
  return Math.max(-1, Math.min(1, score));
}
