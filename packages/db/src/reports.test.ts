import { describe, expect, it } from "vitest";
import {
  brandsReportPayload,
  createApiKey,
  getDemoStore,
  resetApiKeyStore,
  resetDemoStore,
  verifyApiKey,
} from "./index.js";

describe("Phase 10 reports + api keys", () => {
  it("create/verify api key in memory", async () => {
    resetApiKeyStore();
    const { plaintext, record } = await createApiKey(null, {
      organizationId: "org_demo",
      projectId: "prj_demo",
      name: "ci",
    });
    expect(plaintext.startsWith("geo_")).toBe(true);
    expect(record.key_prefix.length).toBeGreaterThan(4);
    const ok = await verifyApiKey(null, plaintext);
    expect(ok?.project_id).toBe("prj_demo");
    expect(await verifyApiKey(null, "geo_bad")).toBeNull();
  });

  it("brandsReportPayload is stable for demo store", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const a = brandsReportPayload(store);
    const b = brandsReportPayload(store);
    expect(a.rows.map((r) => r.visibility)).toEqual(
      b.rows.map((r) => r.visibility),
    );
    expect(a.rows.some((r) => r.is_own)).toBe(true);
  }, 60_000);
});
