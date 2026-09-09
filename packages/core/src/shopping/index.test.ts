import { describe, expect, it } from "vitest";
import {
  computeProductMetrics,
  findAttributeGaps,
  matchProduct,
  normalizeProductName,
  parseCatalogCsv,
  trigramSimilarity,
} from "./index.js";

describe("normalize + match", () => {
  it("normalizes units and colour qualifiers", () => {
    expect(normalizeProductName("Acme CRM Pro — Black 16 oz")).toContain("acme crm pro");
    expect(normalizeProductName("Acme CRM Pro — Black 16 oz")).toContain("16oz");
  });

  it("matches exact then contains then trigram", () => {
    const catalog = [
      { id: "p1", name: "Acme CRM Pro", brand: "Acme" },
      { id: "p2", name: "BetaSoft Suite", brand: "BetaSoft" },
    ];
    expect(matchProduct("Acme CRM Pro", "Acme", catalog).method).toBe("exact");
    expect(matchProduct("Try Acme CRM Pro today", "Acme", catalog).confidence).toBe(
      0.85,
    );
    const fuzzy = matchProduct("Acme CRM Prro", "Acme", catalog);
    expect(fuzzy.method).toBe("trigram");
    expect(fuzzy.productId).toBe("p1");
    expect(matchProduct("Unknown Gadget", undefined, catalog).method).toBe(
      "unmatched",
    );
  });

  it("trigram similarity is symmetric-ish", () => {
    expect(trigramSimilarity("acme crm", "acme crm")).toBe(1);
    expect(trigramSimilarity("acme", "zzzz")).toBeLessThan(0.3);
  });
});

describe("SKU metrics + price drift", () => {
  it("computes win rate and price drift", () => {
    const chats = ["c1", "c2", "c3", "c4"];
    const rows = computeProductMetrics(
      chats,
      [
        { chatId: "c1", productId: "p1", position: 1, mentionedPrice: 9 },
        { chatId: "c2", productId: "p1", position: 2, mentionedPrice: 9 },
        { chatId: "c1", productId: "p2", position: 2 },
        { chatId: "c3", productId: "p2", position: 1 },
      ],
      new Map([["p1", 49], ["p2", 39]]),
    );
    const p1 = rows.find((r) => r.productId === "p1")!;
    expect(p1.appearances).toBe(2);
    expect(p1.visibility).toBe(0.5);
    expect(p1.win_rate).toBe(0.5);
    expect(p1.price_drift).toBe(9 - 49);
  });
});

describe("catalog CSV + attribute gaps", () => {
  it("parses title/brand CSV and finds empty own cells", () => {
    const rows = parseCatalogCsv(
      "title,brand,price,currency,category\nAcme CRM Pro,Acme,49,USD,CRM > Pro\n",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Acme CRM Pro");
    expect(rows[0]!.price).toBe(49);

    const gaps = findAttributeGaps(
      [
        { productId: "own", attribute: "SSO", tab: "facts", value: null },
        {
          productId: "comp",
          attribute: "SSO",
          tab: "facts",
          value: "SAML",
        },
      ],
      new Set(["own"]),
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.attribute).toBe("SSO");
  });
});
