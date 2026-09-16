import { ensureAgentAnalytics } from "./agentAnalytics.js";
import { generateActionsForStore } from "./actions.js";
import { ensureCommercial } from "./commercial.js";
import { demoFixturesEnabled } from "./fixtures.js";
import { ensurePerception } from "./perception.js";
import { ensureShopping } from "./shopping.js";
import { newId } from "./schema.js";
import type { DemoStore } from "./seed.js";

/** Fields persisted in project_extension (not the chat spine tables). */
export type ProjectExtensionPayload = Pick<
  DemoStore,
  | "topics"
  | "tags"
  | "brandProfile"
  | "rejectedCompetitorNames"
  | "fanouts"
  | "ads"
  | "sharedViews"
  | "actions"
  | "actionEvents"
  | "robotsTxt"
  | "robotsFetchedAt"
  | "robotsSource"
  | "agentLogs"
  | "gaReferrals"
  | "logIntegrations"
  | "facts"
  | "claims"
  | "claimVerdicts"
  | "perceptionAttributes"
  | "perceptionRuns"
  | "perceptionObjections"
  | "products"
  | "merchants"
  | "chatProducts"
  | "shoppingAttributes"
  | "productCategories"
  | "pendingCategoryDraft"
  | "commercial"
  | "auditLog"
>;

export function extractExtension(store: DemoStore): ProjectExtensionPayload {
  return {
    topics: store.topics,
    tags: store.tags,
    brandProfile: store.brandProfile,
    rejectedCompetitorNames: store.rejectedCompetitorNames,
    fanouts: store.fanouts,
    ads: store.ads,
    sharedViews: store.sharedViews,
    actions: store.actions,
    actionEvents: store.actionEvents,
    robotsTxt: store.robotsTxt,
    robotsFetchedAt: store.robotsFetchedAt,
    robotsSource: store.robotsSource,
    agentLogs: store.agentLogs,
    gaReferrals: store.gaReferrals,
    logIntegrations: store.logIntegrations,
    facts: store.facts,
    claims: store.claims,
    claimVerdicts: store.claimVerdicts,
    perceptionAttributes: store.perceptionAttributes,
    perceptionRuns: store.perceptionRuns,
    perceptionObjections: store.perceptionObjections,
    products: store.products,
    merchants: store.merchants,
    chatProducts: store.chatProducts,
    shoppingAttributes: store.shoppingAttributes,
    productCategories: store.productCategories,
    pendingCategoryDraft: store.pendingCategoryDraft,
    commercial: store.commercial,
    auditLog: store.auditLog,
  };
}

export function applyExtension(
  store: DemoStore,
  ext: Partial<ProjectExtensionPayload> | null | undefined,
) {
  if (!ext) return;
  Object.assign(store, {
    topics: ext.topics ?? store.topics,
    tags: ext.tags ?? store.tags,
    brandProfile: ext.brandProfile ?? store.brandProfile,
    rejectedCompetitorNames:
      ext.rejectedCompetitorNames ?? store.rejectedCompetitorNames,
    fanouts: ext.fanouts ?? store.fanouts,
    ads: ext.ads ?? store.ads,
    sharedViews: ext.sharedViews ?? store.sharedViews,
    actions: ext.actions ?? store.actions,
    actionEvents: ext.actionEvents ?? store.actionEvents,
    robotsTxt: ext.robotsTxt ?? store.robotsTxt,
    robotsFetchedAt: ext.robotsFetchedAt ?? store.robotsFetchedAt,
    robotsSource: ext.robotsSource ?? store.robotsSource,
    agentLogs: ext.agentLogs ?? store.agentLogs,
    gaReferrals: ext.gaReferrals ?? store.gaReferrals,
    logIntegrations: ext.logIntegrations ?? store.logIntegrations,
    facts: ext.facts ?? store.facts,
    claims: ext.claims ?? store.claims,
    claimVerdicts: ext.claimVerdicts ?? store.claimVerdicts,
    perceptionAttributes: ext.perceptionAttributes ?? store.perceptionAttributes,
    perceptionRuns: ext.perceptionRuns ?? store.perceptionRuns,
    perceptionObjections: ext.perceptionObjections ?? store.perceptionObjections,
    products: ext.products ?? store.products,
    merchants: ext.merchants ?? store.merchants,
    chatProducts: ext.chatProducts ?? store.chatProducts,
    shoppingAttributes: ext.shoppingAttributes ?? store.shoppingAttributes,
    productCategories: ext.productCategories ?? store.productCategories,
    pendingCategoryDraft: ext.pendingCategoryDraft ?? store.pendingCategoryDraft,
    commercial: ext.commercial ?? store.commercial,
    auditLog: ext.auditLog ?? store.auditLog,
  });
}

/**
 * Ensure a Postgres-backed project has enough spine + feature seed that
 * Perception / Shopping / Actions / Agent are not empty shells.
 * Returns whether spine rows were added (caller should write brands/prompts/chats).
 */
export function bootstrapProjectFeatures(store: DemoStore): {
  spineChanged: boolean;
  featuresSeeded: boolean;
} {
  let spineChanged = false;
  const fixtures = demoFixturesEnabled(store);

  // The tracked brand is real (it is the project itself). Competitors are not
  // invented — they are discovered from collected answers.
  if (store.brands.length === 0) {
    const name =
      store.project.name.replace(/\s+project$/i, "").trim() ||
      store.project.domain?.replace(/^www\./, "").split(".")[0] ||
      "My brand";
    store.brands.push({
      id: newId("br"),
      project_id: store.project.id,
      name,
      is_own: true,
      aliases: [name.toLowerCase()],
      patterns: [],
    });
    if (fixtures) {
      store.brands.push({
        id: newId("br"),
        project_id: store.project.id,
        name: "BetaSoft",
        is_own: false,
        aliases: ["betasoft"],
        patterns: [],
      });
    }
    spineChanged = true;
  }

  if (store.prompts.length === 0 && fixtures) {
    store.prompts.push({
      id: newId("pr"),
      project_id: store.project.id,
      text: "best crm software for small business",
      country_code: store.project.default_country || "US",
      status: "active",
    });
    spineChanged = true;
  }

  // Never fabricate chats: an un-collected project must read as un-collected.
  if (fixtures && store.chats.length === 0 && !store.project.domain) {
    const own = store.brands.find((b) => b.is_own)!;
    const prompt = store.prompts[0]!;
    const runDate = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 5; i++) {
      const chatId = newId("cht");
      const text =
        i % 2 === 0
          ? `${own.name} CRM starts at $9/mo and competes with BetaSoft Suite. Acme CRM Pro is popular.`
          : `${own.name} is known for reliability. Teams also evaluate BetaSoft and CloudNine.`;
      store.chats.push({
        id: chatId,
        project_id: store.project.id,
        prompt_id: prompt.id,
        model_channel_id: "openai-1",
        country_code: prompt.country_code,
        run_date: runDate,
        status: "ok",
        text,
        surface_kind: "api",
      });
      store.mentions.push({
        chat_id: chatId,
        brand_id: own.id,
        mention_count: 1,
        position: 1,
        sentiment: 0.6,
      });
      store.sources.push({
        chat_id: chatId,
        url: `https://${store.project.domain ?? "acme.example"}/pricing`,
        domain: store.project.domain ?? "acme.example",
        cited: true,
        citation_count: 1,
        retrieval_rank: 1,
      });
    }
    spineChanged = true;
  }

  const beforeFacts = store.facts?.length ?? 0;
  const beforeProducts = store.products?.length ?? 0;
  const beforeActions = store.actions?.length ?? 0;

  ensureAgentAnalytics(store);
  ensurePerception(store);
  ensureShopping(store);
  ensureCommercial(store);

  if ((store.actions?.length ?? 0) === 0) {
    generateActionsForStore(store, { force: true });
  }

  const featuresSeeded =
    spineChanged ||
    beforeFacts === 0 ||
    beforeProducts === 0 ||
    beforeActions === 0 ||
    (store.facts?.length ?? 0) > beforeFacts ||
    (store.products?.length ?? 0) > beforeProducts ||
    (store.actions?.length ?? 0) > beforeActions;

  return { spineChanged, featuresSeeded };
}
