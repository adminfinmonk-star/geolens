/**
 * Demo fixtures are the synthetic Acme / BetaSoft dataset used by the offline demo
 * store and the test suite. Product surfaces must never fabricate them: a real
 * project with no collected data has to render an honest empty state instead.
 *
 * A store opts in by setting `demo_fixtures` (only `buildDemoStore` does).
 * `GEO_DEMO_FIXTURES=on|off` overrides for local debugging.
 */
export function demoFixturesEnabled(store: {
  demo_fixtures?: boolean;
}): boolean {
  const flag = process.env.GEO_DEMO_FIXTURES?.trim().toLowerCase();
  if (flag === "on" || flag === "true" || flag === "1") return true;
  if (flag === "off" || flag === "false" || flag === "0") return false;
  return store.demo_fixtures === true;
}

/**
 * Exact signatures written by the old always-on seeders. Earlier builds persisted
 * these into project_extension for real projects, so gating new writes is not
 * enough — the stale rows have to be removed on load.
 */
const FIXTURE_ATTRIBUTE_IDS = new Set([
  "attr_reliable",
  "attr_affordable",
  "attr_security",
  "attr_integ",
  "attr_analytics",
]);
const FIXTURE_OBJECTION_IDS = new Set(["obj_price", "obj_complex"]);
const FIXTURE_FACTS = new Set([
  "Acme CRM starts at $49/mo",
  "Acme integrates with Salesforce and HubSpot",
]);
const FIXTURE_PRODUCTS = new Set([
  "Acme CRM Pro",
  "BetaSoft Suite",
  "CloudNine Desk",
]);
const FIXTURE_MERCHANTS = new Set(["Acme Store"]);
const FIXTURE_ASSISTANT_SOURCES = new Set(["chatgpt.com", "perplexity.ai"]);

/**
 * Competitor brands invented by the old seeder. `br_acme` is deliberately absent:
 * it is the own-brand row and real projects rename it to their actual brand.
 */
const FIXTURE_BRAND_IDS = new Set(["br_beta", "br_gamma", "br_delta"]);
const FIXTURE_BRAND_NAMES = new Set([
  "betasoft",
  "gammahq",
  "deltaforce crm",
  "cloudnine desk",
  "cloudnine",
  "datapeak",
]);

/**
 * The old seeder stamped this invented robots.txt onto every project, which made
 * Crawlability report blocked search bots for domains it had never read.
 */
const FIXTURE_ROBOTS_SIGNATURE = [
  "User-agent: OAI-SearchBot",
  "Disallow: /",
  "User-agent: GPTBot",
  "Disallow: /",
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin",
].join("\n");

function isFixtureRobots(txt: string | undefined): boolean {
  if (txt == null) return false;
  const normalized = txt
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  return normalized === FIXTURE_ROBOTS_SIGNATURE;
}

/**
 * One-time heal for projects that are not demo stores: drop feature rows that
 * came from the old fixture seeders. Returns true when anything was removed.
 */
export function purgeLegacyFixtures(store: {
  demo_fixtures?: boolean;
  project: { domain?: string };
  brands?: { id: string; name: string; is_own: boolean }[];
  mentions?: { brand_id: string }[];
  facts?: { id: string; statement: string }[];
  claims?: { id: string; statement: string }[];
  claimVerdicts?: { claim_id: string; fact_id: string }[];
  perceptionAttributes?: { attributeId: string }[];
  perceptionObjections?: { id: string }[];
  perceptionRuns?: unknown[];
  products?: { id: string; name: string }[];
  merchants?: { id: string; name: string }[];
  chatProducts?: { product_id: string }[];
  shoppingAttributes?: { product_id: string }[];
  productCategories?: { path: string }[];
  agentLogs?: { request_url: string }[];
  gaReferrals?: { source: string; provenance?: string }[];
  robotsTxt?: string;
  robotsSource?: string;
  actions?: unknown[];
  actionEvents?: unknown[];
}): boolean {
  if (demoFixturesEnabled(store)) return false;
  let changed = false;

  if (store.robotsSource !== "fetched" && isFixtureRobots(store.robotsTxt)) {
    store.robotsTxt = undefined;
    store.robotsSource = undefined;
    changed = true;
  }

  const drop = <T>(list: T[] | undefined, isFixture: (row: T) => boolean) => {
    if (!list) return undefined;
    const kept = list.filter((row) => !isFixture(row));
    if (kept.length !== list.length) changed = true;
    return kept;
  };

  // Seeded competitors that never earned a mention. Requiring zero mentions keeps
  // a genuinely detected brand (a real "CloudNine" competitor) even if the name
  // collides with the fixture set.
  const mentioned = new Set((store.mentions ?? []).map((m) => m.brand_id));
  store.brands = drop(
    store.brands,
    (b) =>
      !b.is_own &&
      !mentioned.has(b.id) &&
      (FIXTURE_BRAND_IDS.has(b.id) ||
        FIXTURE_BRAND_NAMES.has(b.name.trim().toLowerCase())),
  );

  const deadFacts = new Set(
    (store.facts ?? [])
      .filter((f) => FIXTURE_FACTS.has(f.statement))
      .map((f) => f.id),
  );
  store.facts = drop(store.facts, (f) => deadFacts.has(f.id));

  const deadProducts = new Set(
    (store.products ?? [])
      .filter((p) => FIXTURE_PRODUCTS.has(p.name))
      .map((p) => p.id),
  );
  store.products = drop(store.products, (p) => deadProducts.has(p.id));
  store.chatProducts = drop(store.chatProducts, (a) =>
    deadProducts.has(a.product_id),
  );
  store.shoppingAttributes = drop(store.shoppingAttributes, (a) =>
    deadProducts.has(a.product_id),
  );
  store.merchants = drop(store.merchants, (m) =>
    FIXTURE_MERCHANTS.has(m.name),
  );
  store.productCategories = drop(store.productCategories, (c) =>
    c.path.startsWith("CRM > "),
  );

  store.perceptionAttributes = drop(store.perceptionAttributes, (a) =>
    FIXTURE_ATTRIBUTE_IDS.has(a.attributeId),
  );
  store.perceptionObjections = drop(store.perceptionObjections, (o) =>
    FIXTURE_OBJECTION_IDS.has(o.id),
  );
  if ((store.perceptionAttributes?.length ?? 0) === 0 && store.perceptionRuns?.length) {
    store.perceptionRuns = [];
    changed = true;
  }

  // A verdict judged against a removed fact no longer means anything.
  store.claimVerdicts = drop(store.claimVerdicts, (v) =>
    deadFacts.has(v.fact_id),
  );

  // Synthetic bot traffic and GA rows never came from this customer's site.
  const domain = store.project.domain?.toLowerCase();
  store.agentLogs = drop(store.agentLogs, (l) => {
    const url = l.request_url.toLowerCase();
    if (url.includes("acme.example")) return true;
    return domain == null || !url.includes(domain);
  });
  store.gaReferrals = drop(store.gaReferrals, (r) =>
    r.provenance !== "customer_analytics_import" && FIXTURE_ASSISTANT_SOURCES.has(r.source),
  );

  // Actions are derived data. Once any input was fabricated, every recommendation
  // built from that store is unfounded — clear them so the rules re-derive from
  // real signals only. (bootstrapProjectFeatures regenerates an empty list.)
  if (changed && (store.actions?.length || store.actionEvents?.length)) {
    store.actions = [];
    store.actionEvents = [];
  }

  return changed;
}

/** Provenance stamp attached to every feature report so the UI can be honest. */
export type DataState = "live" | "empty" | "demo_fixture";

export function dataState(
  store: { demo_fixtures?: boolean },
  hasRows: boolean,
): DataState {
  if (!hasRows) return "empty";
  return demoFixturesEnabled(store) ? "demo_fixture" : "live";
}
