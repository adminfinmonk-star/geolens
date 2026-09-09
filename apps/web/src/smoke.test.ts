import { describe, expect, it } from "vitest";

describe("web smoke", () => {
  it("formats visibility percent", () => {
    const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
    expect(pct(0.4)).toBe("40.0%");
  });
});
