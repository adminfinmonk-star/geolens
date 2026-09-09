/**
 * Credits are allocation slots, not consumption (§16.3).
 * 1 prompt × 1 model × 1 day = 1 credit
 * weekly ≈ ⅓ of daily
 */

export type CreditInput = {
  active_prompts: number;
  active_channels: number;
  /** Days in the billing month that the project runs (default 30). */
  run_days?: number;
  frequency: "daily" | "weekly";
};

export function computeProjectCredits(input: CreditInput): number {
  const days = input.run_days ?? 30;
  const freqFactor = input.frequency === "weekly" ? 1 / 3 : 1;
  return Math.ceil(
    input.active_prompts * input.active_channels * days * freqFactor,
  );
}

export function creditsForMonth(
  prompts: number,
  channels: number,
  frequency: "daily" | "weekly" = "daily",
): number {
  return computeProjectCredits({
    active_prompts: prompts,
    active_channels: channels,
    run_days: 30,
    frequency,
  });
}
