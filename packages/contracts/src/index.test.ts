import { describe, expect, it } from "vitest";
import { ReportRequestSchema } from "./index.js";

describe("ReportRequestSchema", () => {
  it("parses a minimal valid report request", () => {
    const parsed = ReportRequestSchema.parse({
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    });
    expect(parsed.filters).toEqual([]);
    expect(parsed.having).toEqual([]);
    expect(parsed.dimensions).toEqual([]);
  });
});
