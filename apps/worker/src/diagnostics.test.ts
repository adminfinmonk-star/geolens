import { expect, it } from "vitest";
import { collectionFailureDetail } from "./diagnostics.js";

it("classifies recoverable failures without exposing provider payloads", () => {
  expect(collectionFailureDetail("HTTP_429", { error: "RESOURCE_EXHAUSTED secret-token" })).toContain("quota");
  expect(collectionFailureDetail("HTTP_401", { error: "secret-token" })).toContain("credential");
  expect(collectionFailureDetail("HTTP_429", {})).toContain("rate limit");
  expect(collectionFailureDetail("COLLECTOR_TIMEOUT", {})).toContain("timed out");
  expect(collectionFailureDetail("HTTP_500", { error: "secret-token" })).not.toContain("secret-token");
});
