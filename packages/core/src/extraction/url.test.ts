import { describe, expect, it } from "vitest";
import { normalizeUrl, extractDomain } from "./url.js";

describe("normalizeUrl", () => {
  it("lowercases host and strips www + utm", () => {
    expect(
      normalizeUrl("HTTPS://WWW.Example.com/Path/?utm_source=x&b=2&a=1"),
    ).toBe("https://example.com/Path?a=1&b=2");
  });

  it("strips trailing slash except root", () => {
    expect(normalizeUrl("https://example.com/docs/")).toBe(
      "https://example.com/docs",
    );
  });

  it("extractDomain works on normalized urls", () => {
    expect(extractDomain(normalizeUrl("https://www.Foo.com/x"))).toBe("foo.com");
  });
});
