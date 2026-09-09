import { describe, expect, it } from "vitest";
import { SimulatorAdapter } from "./simulator/index.js";

describe("SimulatorAdapter", () => {
  const adapter = new SimulatorAdapter();

  it("is deterministic for the same request", async () => {
    const req = {
      prompt: "best CRM for a 20-person agency",
      countryCode: "US",
      channelId: "sim-0",
      modelId: "simulator-v1",
      runDate: "2026-03-01",
      seed: "demo",
    };
    const a = await adapter.run(req);
    const b = await adapter.run(req);
    expect(a.text).toBe(b.text);
    expect(a.status).toBe(b.status);
    expect(a.sources).toEqual(b.sources);
  });

  it("changes output when runDate changes", async () => {
    const base = {
      prompt: "best CRM for a 20-person agency",
      countryCode: "US",
      channelId: "sim-0",
      modelId: "simulator-v1",
      seed: "demo",
    };
    const a = await adapter.run({ ...base, runDate: "2026-03-01" });
    const b = await adapter.run({ ...base, runDate: "2026-06-15" });
    // Not guaranteed different status, but seed differs so raw.seed hash differs
    expect((a.raw as { seed: number }).seed).not.toBe(
      (b.raw as { seed: number }).seed,
    );
  });

  it("reports healthy", async () => {
    expect((await adapter.health()).ok).toBe(true);
  });
});
