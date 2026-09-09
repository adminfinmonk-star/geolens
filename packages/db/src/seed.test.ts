import { describe, expect, it } from "vitest";
import { DEFAULT_API_CHANNELS } from "@geo/adapters";
import { buildDemoStore, metricsFromStore } from "./seed.js";

describe("buildDemoStore", () => {
  it("produces days × prompts × channels of chats and valid metrics", async () => {
    const store = await buildDemoStore({ days: 14, seed: "test" });
    expect(store.prompts).toHaveLength(5);
    expect(store.chats.length).toBe(14 * 5 * DEFAULT_API_CHANNELS.length);
    expect(store.mentions.length).toBeGreaterThan(0);

    const metrics = metricsFromStore(store);
    expect(metrics).toHaveLength(store.brands.length);

    const own = metrics.find((m) => m.is_own)!;
    expect(own.visibility).toBeGreaterThanOrEqual(0);
    expect(own.visibility).toBeLessThanOrEqual(1);
    expect(own.share_of_voice).toBeGreaterThanOrEqual(0);
    expect(own.share_of_voice).toBeLessThanOrEqual(1);

    const sovSum = metrics.reduce((s, m) => s + m.share_of_voice, 0);
    expect(sovSum).toBeCloseTo(1, 5);
  }, 30_000);

  it("is deterministic across runs", async () => {
    const a = await buildDemoStore({ days: 3, seed: "det" });
    const b = await buildDemoStore({ days: 3, seed: "det" });
    expect(a.chats.map((c) => c.text)).toEqual(b.chats.map((c) => c.text));
  }, 30_000);
});
