/**
 * AI Shopping (§11) — product normalize/match, SKU metrics, CSV parse, price drift.
 * Pure functions, no I/O.
 */

export function normalizeProductName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(\d+)\s*(oz|ml|in|cm|gb|tb)\b/g, "$1$2")
    .replace(/\b(black|white|red|blue|green|silver|gold|xl|xxl|small|medium|large)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dice coefficient on character trigrams. */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return (2 * inter) / (ta.size + tb.size);
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    out.add(padded.slice(i, i + 3));
  }
  return out;
}

export interface CatalogProduct {
  id: string;
  name: string;
  brand?: string;
  category?: string;
}

export interface ProductMatch {
  productId: string;
  confidence: number;
  method: "exact" | "contains" | "trigram" | "unmatched";
}

/**
 * Match noisy AI product names to catalog (§11.2).
 * Embedding step omitted in deterministic CI path.
 */
export function matchProduct(
  rawName: string,
  brandHint: string | undefined,
  catalog: CatalogProduct[],
): ProductMatch {
  const n = normalizeProductName(rawName);
  const brandN = brandHint ? normalizeProductName(brandHint) : "";

  for (const p of catalog) {
    const pn = normalizeProductName(p.name);
    const pb = p.brand ? normalizeProductName(p.brand) : "";
    if (pn === n && (!brandN || !pb || brandN === pb)) {
      return { productId: p.id, confidence: 1, method: "exact" };
    }
  }

  for (const p of catalog) {
    const pn = normalizeProductName(p.name);
    if (n.includes(pn) || pn.includes(n)) {
      if (brandN && p.brand) {
        const pb = normalizeProductName(p.brand);
        if (pb && brandN !== pb) continue;
      }
      return { productId: p.id, confidence: 0.85, method: "contains" };
    }
  }

  let best: ProductMatch | null = null;
  for (const p of catalog) {
    if (brandN && p.brand) {
      const pb = normalizeProductName(p.brand);
      if (pb && brandN !== pb) continue;
    }
    const sim = trigramSimilarity(n, normalizeProductName(p.name));
    if (sim >= 0.72 && (!best || sim > best.confidence)) {
      best = { productId: p.id, confidence: 0.75, method: "trigram" };
    }
  }
  if (best) return best;

  return { productId: "", confidence: 0, method: "unmatched" };
}

export interface ProductAppearanceFact {
  chatId: string;
  productId: string;
  position: number;
  mentionedPrice?: number;
}

export interface ProductMetricRow {
  productId: string;
  visibility: number;
  win_rate: number;
  avg_position: number;
  appearances: number;
  share_of_voice: number;
  mentioned_price_avg: number | null;
  price_drift: number | null;
}

/**
 * SKU metrics (§11.3). Position emphasized — win_rate = pos 1 / appearances.
 */
export function computeProductMetrics(
  chatsInScope: string[],
  appearances: ProductAppearanceFact[],
  catalogPrices: Map<string, number | null>,
): ProductMetricRow[] {
  const scope = new Set(chatsInScope);
  const scoped = appearances.filter((a) => scope.has(a.chatId));
  const totalMentions = scoped.length;
  const byProduct = new Map<string, ProductAppearanceFact[]>();
  for (const a of scoped) {
    const list = byProduct.get(a.productId) ?? [];
    list.push(a);
    byProduct.set(a.productId, list);
  }

  const chatCount = Math.max(1, chatsInScope.length);
  const rows: ProductMetricRow[] = [];
  for (const [productId, list] of byProduct) {
    const wins = list.filter((a) => a.position === 1).length;
    const prices = list
      .map((a) => a.mentionedPrice)
      .filter((p): p is number => p != null);
    const mentionedAvg =
      prices.length === 0
        ? null
        : prices.reduce((s, p) => s + p, 0) / prices.length;
    const catalog = catalogPrices.get(productId) ?? null;
    const price_drift =
      mentionedAvg != null && catalog != null ? mentionedAvg - catalog : null;

    rows.push({
      productId,
      visibility: list.length / chatCount,
      win_rate: list.length === 0 ? 0 : wins / list.length,
      avg_position:
        list.reduce((s, a) => s + a.position, 0) / Math.max(1, list.length),
      appearances: list.length,
      share_of_voice: totalMentions === 0 ? 0 : list.length / totalMentions,
      mentioned_price_avg: mentionedAvg,
      price_drift,
    });
  }
  return rows.sort((a, b) => b.visibility - a.visibility);
}

export interface CatalogCsvRow {
  title: string;
  brand: string;
  description?: string;
  price?: number;
  currency?: string;
  link?: string;
  imageLink?: string;
  category?: string;
}

/** Parse Peec/GMC-style CSV (§11.1). Required: title, brand. */
export function parseCatalogCsv(csv: string): CatalogCsvRow[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase().trim());
  const titleIdx = headers.findIndex((h) =>
    ["title", "name", "product_title", "item_title"].includes(h),
  );
  const brandIdx = headers.findIndex((h) => h === "brand");
  if (titleIdx < 0 || brandIdx < 0) {
    throw new Error("csv_requires_title_and_brand");
  }
  const col = (name: string[]) =>
    headers.findIndex((h) => name.includes(h));

  const rows: CatalogCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const title = cells[titleIdx]?.trim() ?? "";
    const brand = cells[brandIdx]?.trim() ?? "";
    if (!title || !brand) continue;
    const priceRaw = cells[col(["price", "catalog_price"])] ?? "";
    const price = priceRaw ? Number(String(priceRaw).replace(/[^0-9.]/g, "")) : undefined;
    rows.push({
      title,
      brand,
      description: cells[col(["description", "desc"])] || undefined,
      price: price != null && !Number.isNaN(price) ? price : undefined,
      currency: (cells[col(["currency"])] || "USD").slice(0, 3).toUpperCase(),
      link: cells[col(["link", "url", "product_link"])] || undefined,
      imageLink: cells[col(["imagelink", "image_link", "image"])] || undefined,
      category: cells[col(["category", "product_type"])] || undefined,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export type AttributeTab = "characteristics" | "facts" | "ratings";

export interface AttributeCell {
  productId: string;
  attribute: string;
  tab: AttributeTab;
  value: string | number | boolean | null;
}

/** Empty cells where competitors have values → R9 evidence (§11.4). */
export function findAttributeGaps(
  cells: AttributeCell[],
  ownProductIds: Set<string>,
): { productId: string; attribute: string; competitorValues: string[] }[] {
  const byAttr = new Map<string, AttributeCell[]>();
  for (const c of cells) {
    const list = byAttr.get(c.attribute) ?? [];
    list.push(c);
    byAttr.set(c.attribute, list);
  }
  const gaps: {
    productId: string;
    attribute: string;
    competitorValues: string[];
  }[] = [];

  for (const [attribute, list] of byAttr) {
    const competitorFilled = list.filter(
      (c) =>
        !ownProductIds.has(c.productId) &&
        c.value != null &&
        c.value !== "",
    );
    if (competitorFilled.length === 0) continue;
    for (const ownId of ownProductIds) {
      const own = list.find((c) => c.productId === ownId);
      if (!own || own.value == null || own.value === "") {
        gaps.push({
          productId: ownId,
          attribute,
          competitorValues: competitorFilled.map(
            (c) => `${c.value} (${c.productId})`,
          ),
        });
      }
    }
  }
  return gaps;
}

export function draftCategoryTree(
  paths: string[],
): { name: string; path: string; parentPath: string | null }[] {
  const seen = new Set<string>();
  const nodes: { name: string; path: string; parentPath: string | null }[] = [];
  for (const raw of paths) {
    if (!raw) continue;
    const parts = raw.split(/\s*>\s*/).map((p) => p.trim()).filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const parentPath = i === 0 ? null : acc;
      acc = i === 0 ? parts[i]! : `${acc} > ${parts[i]}`;
      if (seen.has(acc)) continue;
      seen.add(acc);
      nodes.push({ name: parts[i]!, path: acc, parentPath });
    }
  }
  return nodes;
}
