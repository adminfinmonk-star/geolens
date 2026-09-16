import {
  computeProductMetrics,
  draftCategoryTree,
  findAttributeGaps,
  matchProduct,
  parseCatalogCsv,
  type AttributeTab,
} from "@geo/core";
import { dataState, demoFixturesEnabled } from "./fixtures.js";
import { newId } from "./schema.js";
import type { DemoStore } from "./seed.js";

export interface ProductRecord {
  id: string;
  project_id: string;
  name: string;
  brand_name: string;
  description?: string;
  image_url?: string;
  link?: string;
  catalog_price: number | null;
  currency: string;
  category_path?: string;
  source: "CATALOG" | "LLM";
  merchant_id?: string;
  first_seen_at: string;
}

export interface MerchantRecord {
  id: string;
  name: string;
  domain?: string;
}

export interface ChatProductAppearance {
  chat_id: string;
  product_id: string;
  position: number;
  mentioned_price?: number;
  currency?: string;
  merchant_id?: string;
  rating?: number;
  shopping_queries: string[];
}

export interface ShoppingAttributeCell {
  product_id: string;
  attribute: string;
  tab: AttributeTab;
  value: string | number | boolean | null;
}

export interface ProductCategoryNode {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
}

export function ensureShopping(store: DemoStore) {
  if (!store.products) store.products = [];
  if (!store.merchants) store.merchants = [];
  if (!store.chatProducts) store.chatProducts = [];
  if (!store.shoppingAttributes) store.shoppingAttributes = [];
  if (!store.productCategories) store.productCategories = [];
  if (!store.pendingCategoryDraft) store.pendingCategoryDraft = [];

  if (demoFixturesEnabled(store) && store.products.length === 0) {
    seedShopping(store);
  }
}

function seedShopping(store: DemoStore) {
  const now = new Date().toISOString();
  const ownBrand = store.brands.find((b) => b.is_own)?.name ?? "Acme";

  const merAcme: MerchantRecord = {
    id: newId("mer"),
    name: "Acme Store",
    domain: "shop.acme.example",
  };
  const merAmazon: MerchantRecord = {
    id: newId("mer"),
    name: "Amazon",
    domain: "amazon.com",
  };
  store.merchants.push(merAcme, merAmazon);

  const catNodes = draftCategoryTree(["CRM > Pro", "CRM > Competitor"]);
  for (const n of catNodes) {
    store.productCategories.push({
      id: newId("cat"),
      name: n.name,
      path: n.path,
      parent_id: n.parentPath
        ? store.productCategories.find((c) => c.path === n.parentPath)?.id ??
          null
        : null,
    });
  }

  const own: ProductRecord = {
    id: newId("prd"),
    project_id: store.project.id,
    name: "Acme CRM Pro",
    brand_name: ownBrand,
    description: "Flagship CRM seat plan",
    catalog_price: 49,
    currency: "USD",
    category_path: "CRM > Pro",
    source: "CATALOG",
    merchant_id: merAcme.id,
    link: "https://acme.example/crm-pro",
    first_seen_at: now,
  };
  const beta: ProductRecord = {
    id: newId("prd"),
    project_id: store.project.id,
    name: "BetaSoft Suite",
    brand_name: "BetaSoft",
    catalog_price: 39,
    currency: "USD",
    category_path: "CRM > Competitor",
    source: "LLM",
    merchant_id: merAmazon.id,
    first_seen_at: now,
  };
  const cloud: ProductRecord = {
    id: newId("prd"),
    project_id: store.project.id,
    name: "CloudNine Desk",
    brand_name: "CloudNine",
    catalog_price: null,
    currency: "USD",
    category_path: "CRM > Competitor",
    source: "LLM",
    merchant_id: merAmazon.id,
    first_seen_at: now,
  };
  store.products.push(own, beta, cloud);

  // Appearances across a slice of ok chats — price drift $9 vs $49
  const okChats = store.chats.filter((c) => c.status === "ok").slice(0, 40);
  okChats.forEach((chat, i) => {
    const shoppingQ = [
      "best crm software for small business",
      "acme crm pricing",
      "crm with sso",
    ];
    store.chatProducts.push({
      chat_id: chat.id,
      product_id: own.id,
      position: i % 5 === 0 ? 1 : 2 + (i % 3),
      mentioned_price: i % 2 === 0 ? 9 : 49,
      currency: "USD",
      merchant_id: i % 3 === 0 ? merAmazon.id : merAcme.id,
      rating: 4.2,
      shopping_queries: [shoppingQ[i % shoppingQ.length]!],
    });
    if (i % 2 === 0) {
      store.chatProducts.push({
        chat_id: chat.id,
        product_id: beta.id,
        position: i % 5 === 0 ? 2 : 1,
        mentioned_price: 39,
        currency: "USD",
        merchant_id: merAmazon.id,
        rating: 4.5,
        shopping_queries: ["betasoft vs acme"],
      });
    }
    if (i % 4 === 0) {
      store.chatProducts.push({
        chat_id: chat.id,
        product_id: cloud.id,
        position: 3,
        merchant_id: merAmazon.id,
        shopping_queries: ["cloudnine desk review"],
      });
    }
  });

  // Attribute grid — SSO empty for own → R9
  store.shoppingAttributes = [
    {
      product_id: own.id,
      attribute: "SSO",
      tab: "facts",
      value: null,
    },
    {
      product_id: beta.id,
      attribute: "SSO",
      tab: "facts",
      value: "SAML",
    },
    {
      product_id: cloud.id,
      attribute: "SSO",
      tab: "facts",
      value: "OIDC",
    },
    {
      product_id: own.id,
      attribute: "Seats included",
      tab: "characteristics",
      value: "5",
    },
    {
      product_id: beta.id,
      attribute: "Seats included",
      tab: "characteristics",
      value: "10",
    },
    {
      product_id: own.id,
      attribute: "G2 rating",
      tab: "ratings",
      value: 4.2,
    },
    {
      product_id: beta.id,
      attribute: "G2 rating",
      tab: "ratings",
      value: 4.6,
    },
  ];

  // Inject a few shopping fanouts
  for (const chat of okChats.slice(0, 8)) {
    store.fanouts.push({
      chat_id: chat.id,
      text: "crm software buy online",
      type: "shopping",
    });
  }
}

export function shoppingSummary(store: DemoStore) {
  ensureShopping(store);
  const scope = store.chats.filter((c) => c.status === "ok").map((c) => c.id);
  const prices = new Map(
    store.products.map((p) => [p.id, p.catalog_price] as const),
  );
  const metrics = computeProductMetrics(
    scope,
    store.chatProducts.map((a) => ({
      chatId: a.chat_id,
      productId: a.product_id,
      position: a.position,
      mentionedPrice: a.mentioned_price,
    })),
    prices,
  );

  const top = metrics.slice(0, 7).map((m) => {
    const p = store.products.find((x) => x.id === m.productId)!;
    return { ...m, name: p.name, brand_name: p.brand_name, source: p.source };
  });

  const drifts = metrics
    .filter((m) => m.price_drift != null && Math.abs(m.price_drift) >= 1)
    .map((m) => {
      const p = store.products.find((x) => x.id === m.productId)!;
      return {
        product_id: p.id,
        name: p.name,
        catalog_price: p.catalog_price,
        mentioned_price_avg: m.mentioned_price_avg,
        price_drift: m.price_drift,
      };
    });

  return {
    data_state: dataState(store, store.products.length > 0),
    empty_reason:
      store.products.length > 0
        ? null
        : "No products detected in collected chats yet. Upload a catalog CSV to track your own products and price drift.",
    engine_note:
      "Shopping carousels are only collected on shopping-capable channels. Other engines show an explicit not-supported state rather than empty charts.",
    position_note:
      "Users typically see 2–3 carousel results before scrolling — a product that appears often at position 8 is effectively invisible. Read win rate alongside visibility.",
    empty_state:
      'Continue without uploading — "All products" already works from tracked chats.',
    catalog_count: store.products.filter((p) => p.source === "CATALOG").length,
    all_count: store.products.length,
    top_products: top,
    price_drift: drifts,
    shopping_queries: demandQueries(store, "shopping"),
    shopping_fanouts: demandQueries(store, "fanout"),
  };
}

function demandQueries(
  store: DemoStore,
  kind: "shopping" | "fanout",
): { text: string; occurrences: number; mode: string }[] {
  const counts = new Map<string, number>();
  if (kind === "shopping") {
    for (const a of store.chatProducts) {
      for (const q of a.shopping_queries) {
        counts.set(q, (counts.get(q) ?? 0) + 1);
      }
    }
  } else {
    for (const f of store.fanouts.filter((x) => x.type === "shopping")) {
      counts.set(f.text, (counts.get(f.text) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([text, occurrences]) => ({
      text,
      occurrences,
      mode: occurrences >= 10 ? "top" : occurrences >= 4 ? "trending" : "new",
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 20);
}

export function shoppingProductsReport(
  store: DemoStore,
  opts?: { source?: "catalog" | "all" },
) {
  ensureShopping(store);
  const source = opts?.source ?? "all";
  const products =
    source === "catalog"
      ? store.products.filter((p) => p.source === "CATALOG")
      : store.products;

  const scope = store.chats.filter((c) => c.status === "ok").map((c) => c.id);
  const prices = new Map(
    store.products.map((p) => [p.id, p.catalog_price] as const),
  );
  const metrics = computeProductMetrics(
    scope,
    store.chatProducts.map((a) => ({
      chatId: a.chat_id,
      productId: a.product_id,
      position: a.position,
      mentionedPrice: a.mentioned_price,
    })),
    prices,
  );
  const byId = new Map(metrics.map((m) => [m.productId, m]));

  return {
    source,
    rows: products.map((p) => {
      const m = byId.get(p.id);
      const apps = store.chatProducts.filter((a) => a.product_id === p.id);
      const competitors = [
        ...new Set(
          apps.flatMap((a) =>
            store.chatProducts
              .filter(
                (x) => x.chat_id === a.chat_id && x.product_id !== p.id,
              )
              .map((x) => store.products.find((pr) => pr.id === x.product_id)?.name)
              .filter(Boolean),
          ),
        ),
      ] as string[];
      const topQueries = [
        ...new Set(apps.flatMap((a) => a.shopping_queries)),
      ].slice(0, 5);
      return {
        id: p.id,
        name: p.name,
        brand_name: p.brand_name,
        source: p.source,
        category_path: p.category_path,
        catalog_price: p.catalog_price,
        currency: p.currency,
        visibility: m?.visibility ?? 0,
        win_rate: m?.win_rate ?? 0,
        avg_position: m?.avg_position ?? null,
        appearances: m?.appearances ?? 0,
        mentioned_price_avg: m?.mentioned_price_avg ?? null,
        price_drift: m?.price_drift ?? null,
        competing_products: competitors.slice(0, 5),
        top_shopping_queries: topQueries,
      };
    }),
  };
}

export function shoppingProductDetail(store: DemoStore, productId: string) {
  ensureShopping(store);
  const product = store.products.find((p) => p.id === productId);
  if (!product) return null;
  const list = shoppingProductsReport(store).rows.find((r) => r.id === productId)!;
  const attrs = store.shoppingAttributes.filter((a) => a.product_id === productId);
  const coFeatured = list.competing_products;
  const appearances = store.chatProducts.filter((a) => a.product_id === productId);
  const positions = appearances.map((a) => a.position).sort((a, b) => a - b);
  const box = positionBox(positions);

  return {
    product,
    metrics: list,
    co_featured: coFeatured,
    position_box: box,
    attributes: {
      characteristics: attrs.filter((a) => a.tab === "characteristics"),
      facts: attrs.filter((a) => a.tab === "facts"),
      ratings: attrs.filter((a) => a.tab === "ratings"),
    },
    chats: appearances.slice(0, 50).map((a) => ({
      chat_id: a.chat_id,
      position: a.position,
      mentioned_price: a.mentioned_price,
    })),
  };
}

function positionBox(sorted: number[]) {
  if (sorted.length === 0) {
    return { min: null, q1: null, median: null, q3: null, max: null };
  }
  const q = (p: number) => {
    const i = (sorted.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
  };
  return {
    min: sorted[0]!,
    q1: q(0.25),
    median: q(0.5),
    q3: q(0.75),
    max: sorted[sorted.length - 1]!,
  };
}

export function shoppingMerchantsReport(store: DemoStore) {
  ensureShopping(store);
  const rows = store.merchants.map((m) => {
    const apps = store.chatProducts.filter((a) => a.merchant_id === m.id);
    const wins = apps.filter((a) => a.position === 1).length;
    const ratings = apps
      .map((a) => a.rating)
      .filter((r): r is number => r != null);
    return {
      id: m.id,
      name: m.name,
      domain: m.domain,
      mentions: apps.length,
      buy_box_win_rate: apps.length === 0 ? 0 : wins / apps.length,
      avg_position:
        apps.length === 0
          ? null
          : apps.reduce((s, a) => s + a.position, 0) / apps.length,
      avg_rating:
        ratings.length === 0
          ? null
          : ratings.reduce((s, r) => s + r, 0) / ratings.length,
    };
  });
  const total = rows.reduce((s, r) => s + r.mentions, 0) || 1;
  return {
    rows: rows
      .map((r) => ({ ...r, share_of_voice: r.mentions / total }))
      .sort((a, b) => b.mentions - a.mentions),
  };
}

export function shoppingAttributesReport(store: DemoStore) {
  ensureShopping(store);
  const ownIds = new Set(
    store.products
      .filter((p) => p.source === "CATALOG")
      .map((p) => p.id),
  );
  const gaps = findAttributeGaps(
    store.shoppingAttributes.map((a) => ({
      productId: a.product_id,
      attribute: a.attribute,
      tab: a.tab,
      value: a.value,
    })),
    ownIds,
  );
  return {
    cells: store.shoppingAttributes,
    gaps: gaps.map((g) => ({
      ...g,
      product: store.products.find((p) => p.id === g.productId)?.name,
    })),
    guidance:
      "Empty cells where competitors have values mean the model could not find that info on your PDP — maps to Actions R9.",
  };
}

/**
 * Catalog CSV upload — additive, drafts category tree, backfills last 30 days of chats.
 */
export function ingestCatalogCsv(
  store: DemoStore,
  csv: string,
  opts?: { commitCategories?: boolean },
): {
  added: number;
  matched_appearances: number;
  category_draft: { name: string; path: string; parentPath: string | null }[];
  price_drift_visible: boolean;
} {
  ensureShopping(store);
  const parsed = parseCatalogCsv(csv);
  const draft = draftCategoryTree(
    parsed.map((r) => r.category ?? "").filter(Boolean),
  );
  store.pendingCategoryDraft = draft;

  if (opts?.commitCategories !== false) {
    for (const n of draft) {
      if (store.productCategories.some((c) => c.path === n.path)) continue;
      store.productCategories.push({
        id: newId("cat"),
        name: n.name,
        path: n.path,
        parent_id: n.parentPath
          ? store.productCategories.find((c) => c.path === n.parentPath)?.id ??
            null
          : null,
      });
    }
  }

  const now = new Date().toISOString();
  let added = 0;
  const newIds: string[] = [];
  for (const row of parsed) {
    const exists = store.products.find(
      (p) =>
        p.name.toLowerCase() === row.title.toLowerCase() &&
        p.brand_name.toLowerCase() === row.brand.toLowerCase(),
    );
    if (exists) {
      if (row.price != null) exists.catalog_price = row.price;
      if (row.link) exists.link = row.link;
      exists.source = "CATALOG";
      newIds.push(exists.id);
      continue;
    }
    const id = newId("prd");
    store.products.push({
      id,
      project_id: store.project.id,
      name: row.title,
      brand_name: row.brand,
      description: row.description,
      image_url: row.imageLink,
      link: row.link,
      catalog_price: row.price ?? null,
      currency: row.currency ?? "USD",
      category_path: row.category,
      source: "CATALOG",
      first_seen_at: now,
    });
    newIds.push(id);
    added += 1;
  }

  // 30-day backfill: rematch LLM-named appearances / inject from chat text prices
  const cutoff = Date.now() - 30 * 86_400_000;
  const recentChats = store.chats.filter(
    (c) => c.status === "ok" && new Date(c.run_date).getTime() >= cutoff,
  );
  const catalog = store.products
    .filter((p) => p.source === "CATALOG")
    .map((p) => ({ id: p.id, name: p.name, brand: p.brand_name }));

  let matched = 0;
  for (const chat of recentChats) {
    for (const pid of newIds) {
      const product = store.products.find((p) => p.id === pid)!;
      const hit = matchProduct(product.name, product.brand_name, catalog);
      if (hit.method === "unmatched") continue;
      const already = store.chatProducts.some(
        (a) => a.chat_id === chat.id && a.product_id === pid,
      );
      if (already) {
        matched += 1;
        continue;
      }
      // Soft backfill when chat text mentions brand/product
      const blob = chat.text.toLowerCase();
      if (
        blob.includes(product.brand_name.toLowerCase()) ||
        blob.includes(product.name.toLowerCase().slice(0, 8))
      ) {
        store.chatProducts.push({
          chat_id: chat.id,
          product_id: pid,
          position: 2,
          mentioned_price: /\$9/.test(chat.text) ? 9 : product.catalog_price ?? undefined,
          currency: product.currency,
          shopping_queries: ["backfill match"],
        });
        matched += 1;
      }
    }
  }

  const summary = shoppingSummary(store);
  return {
    added,
    matched_appearances: matched,
    category_draft: draft,
    price_drift_visible: summary.price_drift.length > 0,
  };
}

export function productAttributeGapsForActions(store: DemoStore) {
  ensureShopping(store);
  const report = shoppingAttributesReport(store);
  return report.gaps.map((g) => ({
    product: g.product ?? g.productId,
    attribute: g.attribute,
    competitorValues: g.competitorValues,
  }));
}
