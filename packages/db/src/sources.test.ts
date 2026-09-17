import { describe, expect, it } from "vitest";
import {
  getDemoStore,
  reportsFromStore,
  resetDemoStore,
  setDomainClassification,
  toggleBookmark,
} from "./index.js";

describe("reportsFromStore", () => {
  it("produces domain metrics and real gaps from seeded data", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const { domains, urls, domainGaps, urlGaps } = reportsFromStore(store);
    expect(domains.length).toBeGreaterThan(0);
    expect(urls.length).toBeGreaterThan(0);
    expect(domainGaps.length + urlGaps.length).toBeGreaterThan(0);
    for (const g of domainGaps) {
      expect(g.own_brand_mentioned).toBe(false);
      expect(g.competitor_brands_mentioned).toBeGreaterThan(0);
      expect(g.guidance.length).toBeGreaterThan(0);
    }
  });

  it("applies classification override and bookmark", async () => {
    resetDemoStore();
    const store = await getDemoStore();
    const domain = store.sources[0]!.domain;
    setDomainClassification(store, domain, "CORPORATE");
    toggleBookmark(store, domain);
    const { domains } = reportsFromStore(store);
    const row = domains.find((d) => d.domain === domain)!;
    expect(row.classification).toBe("CORPORATE");
    expect(row.classification_overridden).toBe(true);
    expect(row.bookmarked).toBe(true);
  });
});
