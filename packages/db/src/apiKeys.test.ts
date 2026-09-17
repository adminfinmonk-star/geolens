import { beforeEach, describe, expect, it } from "vitest";
import {
  createApiKey,
  resetApiKeyStore,
  revokeApiKey,
  verifyApiKey,
} from "./apiKeys.js";

describe("API key tenant isolation", () => {
  beforeEach(() => resetApiKeyStore());

  it("cannot revoke a key from another organization or project", async () => {
    const { record, plaintext } = await createApiKey(null, {
      organizationId: "org_a",
      projectId: "prj_a",
      name: "automation",
      scopes: ["read"],
    });

    expect(
      await revokeApiKey(null, record.id, {
        organizationId: "org_b",
        projectId: "prj_b",
      }),
    ).toBe(false);
    expect(await verifyApiKey(null, plaintext)).not.toBeNull();

    expect(
      await revokeApiKey(null, record.id, {
        organizationId: "org_a",
        projectId: "prj_other",
      }),
    ).toBe(false);
    expect(await verifyApiKey(null, plaintext)).not.toBeNull();

    expect(
      await revokeApiKey(null, record.id, {
        organizationId: "org_a",
        projectId: "prj_a",
      }),
    ).toBe(true);
    expect(await verifyApiKey(null, plaintext)).toBeNull();
  });
});
