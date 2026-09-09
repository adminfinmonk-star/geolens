import { describe, expect, it } from "vitest";
import {
  getChannel,
  listApiChannels,
  MODEL_CHANNELS,
  channelSupportsCountry,
} from "./index.js";

describe("MODEL_CHANNELS", () => {
  it("includes the simulator channel", () => {
    expect(getChannel("sim-0")?.surface).toBe("simulator");
  });

  it("has unique channel ids", () => {
    const ids = MODEL_CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists Peec-like API channels including Gemini proxies", () => {
    const api = listApiChannels();
    expect(api.length).toBeGreaterThanOrEqual(6);
    expect(getChannel("openai-0")?.surface).toBe("api");
    expect(getChannel("google-ai-mode")?.provider).toBe("google");
    expect(getChannel("copilot-1")?.id).toBe("copilot-1");
    for (const c of api) {
      expect(c.versionHistory.length).toBeGreaterThan(0);
      expect(c.geoCapability).toBeTruthy();
    }
  });

  it("respects unsupported countries", () => {
    expect(channelSupportsCountry("openai-1", "US")).toBe(true);
  });
});
