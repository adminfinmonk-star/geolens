import { eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { extractBrandProfile } from "@geo/core";
import type { Db } from "./client.js";
import {
  applyExtension,
  bootstrapProjectFeatures,
  extractExtension,
  type ProjectExtensionPayload,
} from "./bootstrap.js";
import { purgeLegacyFixtures } from "./fixtures.js";
import {
  brand,
  chat,
  chatBrandMention,
  chatSource,
  organization,
  project,
  projectExtension,
  prompt,
} from "./pg-schema.js";
import { metricsFromStore, type DemoStore } from "./seed.js";
import { newId } from "./schema.js";

/** Process-local cache so PG feature mutations survive within the API process. */
const storeCache = new Map<string, DemoStore>();

export function resetProjectStoreCache(projectId?: string) {
  if (projectId) storeCache.delete(projectId);
  else storeCache.clear();
}

export async function saveProjectExtension(
  db: Db,
  store: DemoStore,
): Promise<void> {
  const payload = JSON.stringify(extractExtension(store));
  await db
    .insert(projectExtension)
    .values({
      projectId: store.project.id,
      payloadJson: payload,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: projectExtension.projectId,
      set: {
        payloadJson: payload,
        updatedAt: new Date(),
      },
    });
}

async function loadExtension(
  db: Db,
  projectId: string,
): Promise<Partial<ProjectExtensionPayload> | null> {
  const rows = await db
    .select()
    .from(projectExtension)
    .where(eq(projectExtension.projectId, projectId))
    .limit(1);
  const row = rows[0];
  if (!row?.payloadJson) return null;
  try {
    return JSON.parse(row.payloadJson) as Partial<ProjectExtensionPayload>;
  } catch {
    return null;
  }
}

/** Persist brands/prompts/chats/mentions/sources added by bootstrap. */
export async function persistSpineAdds(
  db: Db,
  store: DemoStore,
): Promise<void> {
  for (const b of store.brands) {
    await db
      .insert(brand)
      .values({
        id: b.id,
        projectId: b.project_id,
        name: b.name,
        isOwn: b.is_own,
        aliasesJson: JSON.stringify(b.aliases),
        patternsJson: JSON.stringify(b.patterns),
      })
      .onConflictDoUpdate({
        target: brand.id,
        set: {
          name: b.name,
          isOwn: b.is_own,
          aliasesJson: JSON.stringify(b.aliases),
          patternsJson: JSON.stringify(b.patterns),
        },
      });
  }
  for (const pr of [...store.prompts].sort((a, b) => Number(a.status === "active") - Number(b.status === "active"))) {
    await db
      .insert(prompt)
      .values({
        id: pr.id,
        projectId: pr.project_id,
        text: pr.text,
        countryCode: pr.country_code,
        status: pr.status,
      })
      .onConflictDoUpdate({
        target: prompt.id,
        set: {
          text: pr.text,
          countryCode: pr.country_code,
          status: pr.status,
        },
      });
  }
  for (const c of store.chats) {
    await db
      .insert(chat)
      .values({
        id: c.id,
        projectId: c.project_id,
        promptId: c.prompt_id,
        modelChannelId: c.model_channel_id,
        countryCode: c.country_code,
        runDate: c.run_date,
        status: c.status,
        text: c.text,
        rawUri: c.raw_uri,
        rawPayloadJson:
          c.raw_payload === undefined ? null : JSON.stringify(c.raw_payload),
        surfaceKind: c.surface_kind,
        modelReported: c.model_reported,
        providerRequestId: c.provider_request_id,
        latencyMs: c.latency_ms,
        errorCode: c.error_code,
        errorDetail: c.error_detail,
        collectedAt: c.collected_at ? new Date(c.collected_at) : new Date(),
        retrievalMode: c.retrieval_mode,
        locale: c.locale,
        collectorVersion: c.collector_version,
        extractionVersion: c.extraction_version,
      })
      .onConflictDoNothing();
  }
  for (const m of store.mentions) {
    await db
      .insert(chatBrandMention)
      .values({
        chatId: m.chat_id,
        brandId: m.brand_id,
        mentionCount: m.mention_count,
        position: m.position,
        sentiment: m.sentiment,
      })
      .onConflictDoNothing();
  }
  for (const s of store.sources) {
    const existing = await db
      .select()
      .from(chatSource)
      .where(eq(chatSource.chatId, s.chat_id));
    if (existing.some((e) => e.url === s.url)) continue;
    await db.insert(chatSource).values({
      id: newId("src"),
      chatId: s.chat_id,
      url: s.url,
      domain: s.domain,
      cited: s.cited,
      citationCount: s.citation_count,
      retrievalRank: s.retrieval_rank,
    });
  }
}

/** Normalized brand identity — "Warby Parker" and "warbyparker" are one brand. */
function brandKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Collapse duplicate brand names in the store, keeping the first (own brand wins)
 * and repointing mentions at the survivor so no counts are lost.
 */
export function dedupeStoreBrands(store: DemoStore): number {
  const bySlug = new Map<string, string>();
  const remap = new Map<string, string>();
  const kept: typeof store.brands = [];

  for (const b of [...store.brands].sort((x, y) => Number(y.is_own) - Number(x.is_own))) {
    const key = brandKey(b.name);
    const winner = bySlug.get(key);
    if (winner == null) {
      bySlug.set(key, b.id);
      kept.push(b);
      continue;
    }
    remap.set(b.id, winner);
    const survivor = kept.find((k) => k.id === winner)!;
    survivor.aliases = [...new Set([...survivor.aliases, ...b.aliases])];
    survivor.patterns = [...new Set([...survivor.patterns, ...b.patterns])];
  }
  if (remap.size === 0) return 0;

  store.brands = kept;

  // Merge mentions onto the surviving brand, summing per (chat, brand).
  const merged = new Map<string, (typeof store.mentions)[number]>();
  const liveIds = new Set(store.brands.map((b) => b.id));
  for (const m of store.mentions) {
    const brandId = remap.get(m.brand_id) ?? m.brand_id;
    if (!liveIds.has(brandId)) continue;
    const key = `${m.chat_id}|${brandId}`;
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, { ...m, brand_id: brandId });
      continue;
    }
    cur.mention_count += m.mention_count;
    cur.position = Math.min(cur.position, m.position);
    cur.sentiment = (cur.sentiment + m.sentiment) / 2;
  }
  store.mentions = [...merged.values()];
  return remap.size;
}

/**
 * Persist collection state append-only. Existing evidence is never deleted;
 * reruns add new chats and derived facts while configuration is upserted.
 */
export async function replaceProjectCollection(
  db: Db,
  store: DemoStore,
): Promise<void> {
  dedupeStoreBrands(store);

  for (const b of store.brands) {
    await db
      .insert(brand)
      .values({
        id: b.id,
        projectId: b.project_id,
        name: b.name,
        isOwn: b.is_own,
        aliasesJson: JSON.stringify(b.aliases),
        patternsJson: JSON.stringify(b.patterns),
      })
      .onConflictDoUpdate({
        target: brand.id,
        set: {
          name: b.name,
          isOwn: b.is_own,
          aliasesJson: JSON.stringify(b.aliases),
          patternsJson: JSON.stringify(b.patterns),
        },
      });
  }

  // Prompt ids are versioned entities. Upsert status without deleting rows
  // referenced by earlier chats.
  for (const pr of [...store.prompts].sort((a, b) => Number(a.status === "active") - Number(b.status === "active"))) {
    await db
      .insert(prompt)
      .values({
        id: pr.id,
        projectId: pr.project_id,
        text: pr.text,
        countryCode: pr.country_code,
        status: pr.status,
      })
      .onConflictDoUpdate({
        target: prompt.id,
        set: { text: pr.text, countryCode: pr.country_code, status: pr.status },
      });
  }

  await persistCollectionEvidence(db, store);
  await saveProjectExtension(db, store);
  storeCache.set(store.project.id, store);
}

/** Commit evidence atomically, without overwriting configuration loaded before a run. */
export async function persistCollectionEvidence(
  db: Db,
  store: Pick<DemoStore, "chats" | "mentions" | "sources">,
): Promise<void> {
  await db.transaction(async (tx) => {
  const insertedIds = new Set<string>();
  for (const c of store.chats) {
    const inserted = await tx.insert(chat).values({
      id: c.id,
      projectId: c.project_id,
      promptId: c.prompt_id,
      modelChannelId: c.model_channel_id,
      countryCode: c.country_code,
      runDate: c.run_date,
      status: c.status,
      text: c.text,
      rawUri: c.raw_uri,
      rawPayloadJson:
        c.raw_payload === undefined ? null : JSON.stringify(c.raw_payload),
      surfaceKind: c.surface_kind,
      modelReported: c.model_reported,
      providerRequestId: c.provider_request_id,
      latencyMs: c.latency_ms,
      errorCode: c.error_code,
      errorDetail: c.error_detail,
      collectedAt: c.collected_at ? new Date(c.collected_at) : new Date(),
      retrievalMode: c.retrieval_mode,
      locale: c.locale,
      collectorVersion: c.collector_version,
      extractionVersion: c.extraction_version,
    }).onConflictDoNothing().returning({ id: chat.id });
    if (inserted[0]) insertedIds.add(inserted[0].id);
  }

  for (const m of store.mentions) {
    if (!insertedIds.has(m.chat_id)) continue;
    await tx.insert(chatBrandMention).values({
      chatId: m.chat_id,
      brandId: m.brand_id,
      mentionCount: m.mention_count,
      position: m.position,
      sentiment: m.sentiment,
    }).onConflictDoNothing();
  }

  for (const s of store.sources) {
    if (!insertedIds.has(s.chat_id)) continue;
    await tx.insert(chatSource).values({
      id: `src_${createHash("sha256").update(`${s.chat_id}|${s.url}`).digest("hex").slice(0, 24)}`,
      chatId: s.chat_id,
      url: s.url,
      domain: s.domain,
      cited: s.cited,
      citationCount: s.citation_count,
      retrievalRank: s.retrieval_rank,
    }).onConflictDoNothing();
  }

  });
}

export async function loadProjectStore(
  db: Db,
  projectId: string,
): Promise<DemoStore | null> {
  // PostgreSQL is authoritative across API and worker processes. A process-local
  // cache otherwise hides new evidence and replays stale project settings.

  const projects = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  const p = projects[0];
  if (!p) return null;

  const orgs = await db
    .select()
    .from(organization)
    .where(eq(organization.id, p.organizationId))
    .limit(1);
  const org = orgs[0]!;

  const brands = await db.select().from(brand).where(eq(brand.projectId, projectId));
  const prompts = await db
    .select()
    .from(prompt)
    .where(eq(prompt.projectId, projectId));
  const chats = await db.select().from(chat).where(eq(chat.projectId, projectId));
  const chatIds = chats.map((c) => c.id);

  const mentions = chatIds.length ? await db.select().from(chatBrandMention).where(inArray(chatBrandMention.chatId, chatIds)) : [];
  const sources = chatIds.length ? await db.select().from(chatSource).where(inArray(chatSource.chatId, chatIds)) : [];

  const store: DemoStore = {
    organization: {
      id: org.id,
      name: org.name,
      domain: org.domain ?? undefined,
      timezone: org.timezone,
      plan_code: org.planCode,
      billing_period: org.billingPeriod as "monthly" | "annual",
      is_agency: org.isAgency,
      credits_total: org.creditsTotal ?? null,
      bot_visits_used: org.botVisitsUsed ?? 0,
      created_at: org.createdAt.toISOString(),
    },
    user: {
      id: "usr_pg",
      email: "owner@local",
      created_at: new Date().toISOString(),
    },
    project: {
      id: p.id,
      organization_id: p.organizationId,
      name: p.name,
      domain: p.domain ?? undefined,
      location: p.location ?? undefined,
      default_country: p.defaultCountry,
      language: p.language,
      timezone: p.timezone,
      status: p.status,
      frequency: p.frequency as "daily" | "weekly",
      created_at: p.createdAt.toISOString(),
    },
    brands: brands.map((b) => ({
      id: b.id,
      project_id: b.projectId,
      name: b.name,
      is_own: b.isOwn,
      aliases: JSON.parse(b.aliasesJson) as string[],
      patterns: JSON.parse(b.patternsJson) as string[],
    })),
    prompts: prompts.map((pr) => ({
      id: pr.id,
      project_id: pr.projectId,
      text: pr.text,
      country_code: pr.countryCode,
      status: pr.status as "active" | "paused" | "archived",
    })),
    chats: chats.map((c) => ({
      id: c.id,
      project_id: c.projectId,
      prompt_id: c.promptId,
      model_channel_id: c.modelChannelId,
      country_code: c.countryCode,
      run_date: String(c.runDate),
      status: c.status as "ok" | "empty" | "error" | "blocked",
      text: c.text,
      raw_uri: c.rawUri ?? undefined,
      raw_payload: c.rawPayloadJson
        ? (JSON.parse(c.rawPayloadJson) as unknown)
        : undefined,
      surface_kind:
        (c.surfaceKind as "ui" | "api" | "simulator" | null) ?? undefined,
      model_reported: c.modelReported ?? undefined,
      provider_request_id: c.providerRequestId ?? undefined,
      latency_ms: c.latencyMs ?? undefined,
      error_code: c.errorCode ?? undefined,
      error_detail: c.errorDetail ?? undefined,
      collected_at: c.collectedAt.toISOString(),
      retrieval_mode: c.retrievalMode ?? undefined,
      locale: c.locale ?? undefined,
      collector_version: c.collectorVersion ?? undefined,
      extraction_version: c.extractionVersion ?? undefined,
    })),
    mentions: mentions.map((m) => ({
      chat_id: m.chatId,
      brand_id: m.brandId,
      mention_count: m.mentionCount,
      position: m.position,
      sentiment: m.sentiment,
    })),
    sources: sources.map((s) => ({
      chat_id: s.chatId,
      url: s.url,
      domain: s.domain,
      cited: s.cited,
      citation_count: s.citationCount,
      retrieval_rank: s.retrievalRank,
    })),
    topics: [],
    tags: [],
    brandProfile: extractBrandProfile(p.domain ?? "example.com"),
    rejectedCompetitorNames: [],
    fanouts: [],
    ads: [],
    sharedViews: [],
    sourceClassifications: {},
    sourceBookmarks: [],
    actions: [],
    actionEvents: [],
    robotsTxt: undefined,
    agentLogs: [],
    gaReferrals: [],
    logIntegrations: [],
    facts: [],
    claims: [],
    claimVerdicts: [],
    perceptionAttributes: [],
    perceptionRuns: [],
    perceptionObjections: [],
    products: [],
    merchants: [],
    chatProducts: [],
    shoppingAttributes: [],
    productCategories: [],
    pendingCategoryDraft: [],
  };

  const ext = await loadExtension(db, projectId);
  applyExtension(store, ext);

  // Earlier builds persisted demo fixtures into real projects. Remove them so
  // feature surfaces report an honest empty state instead of Acme/BetaSoft rows.
  const purged = purgeLegacyFixtures(store);

  const hadExtension =
    !!ext &&
    ((ext.facts?.length ?? 0) > 0 ||
      (ext.products?.length ?? 0) > 0 ||
      (ext.actions?.length ?? 0) > 0);

  // Reading a report must never delete brands or rewrite historical mentions.
  const { spineChanged, featuresSeeded } = bootstrapProjectFeatures(store);
  if (spineChanged) {
    await persistSpineAdds(db, store);
  }
  if (!hadExtension || featuresSeeded || spineChanged || purged) {
    await saveProjectExtension(db, store);
  }

  storeCache.set(projectId, store);
  return store;
}

/**
 * Persist feature slice after in-memory mutations (actions, catalog upload, etc.).
 */
export async function persistProjectStore(
  db: Db | null,
  store: DemoStore,
): Promise<void> {
  if (!db) return;
  storeCache.set(store.project.id, store);
  await saveProjectExtension(db, store);
}

export async function seedPostgresFromDemo(
  db: Db,
  store: DemoStore,
): Promise<void> {
  await db
    .insert(organization)
    .values({
      id: store.organization.id,
      name: store.organization.name,
      domain: store.organization.domain,
      timezone: store.organization.timezone,
      planCode: store.organization.plan_code,
      billingPeriod: store.organization.billing_period,
      isAgency: store.organization.is_agency,
      creditsTotal: store.organization.credits_total ?? null,
      botVisitsUsed: store.organization.bot_visits_used ?? 0,
    })
    .onConflictDoNothing();

  await db
    .insert(project)
    .values({
      id: store.project.id,
      organizationId: store.project.organization_id,
      name: store.project.name,
      domain: store.project.domain,
      location: store.project.location,
      defaultCountry: store.project.default_country,
      language: store.project.language,
      timezone: store.project.timezone,
      status: store.project.status,
      frequency: store.project.frequency,
    })
    .onConflictDoNothing();

  for (const b of store.brands) {
    await db
      .insert(brand)
      .values({
        id: b.id,
        projectId: b.project_id,
        name: b.name,
        isOwn: b.is_own,
        aliasesJson: JSON.stringify(b.aliases),
        patternsJson: JSON.stringify(b.patterns),
      })
      .onConflictDoNothing();
  }

  for (const pr of store.prompts) {
    await db
      .insert(prompt)
      .values({
        id: pr.id,
        projectId: pr.project_id,
        text: pr.text,
        countryCode: pr.country_code,
        status: pr.status,
      })
      .onConflictDoNothing();
  }

  for (const c of store.chats) {
    await db
      .insert(chat)
      .values({
        id: c.id,
        projectId: c.project_id,
        promptId: c.prompt_id,
        modelChannelId: c.model_channel_id,
        countryCode: c.country_code,
        runDate: c.run_date,
        status: c.status,
        text: c.text,
        rawUri: c.raw_uri,
        rawPayloadJson:
          c.raw_payload === undefined ? null : JSON.stringify(c.raw_payload),
        surfaceKind: c.surface_kind,
        modelReported: c.model_reported,
        providerRequestId: c.provider_request_id,
        latencyMs: c.latency_ms,
        errorCode: c.error_code,
        errorDetail: c.error_detail,
        collectedAt: c.collected_at ? new Date(c.collected_at) : new Date(),
        retrievalMode: c.retrieval_mode,
        locale: c.locale,
        collectorVersion: c.collector_version,
        extractionVersion: c.extraction_version,
      })
      .onConflictDoNothing();
  }

  for (const m of store.mentions) {
    await db
      .insert(chatBrandMention)
      .values({
        chatId: m.chat_id,
        brandId: m.brand_id,
        mentionCount: m.mention_count,
        position: m.position,
        sentiment: m.sentiment,
      })
      .onConflictDoNothing();
  }

  for (const s of store.sources) {
    await db
      .insert(chatSource)
      .values({
        id: `src_${createHash("sha256").update(`${s.chat_id}|${s.url}`).digest("hex").slice(0, 24)}`,
        chatId: s.chat_id,
        url: s.url,
        domain: s.domain,
        cited: s.cited,
        citationCount: s.citation_count,
        retrievalRank: s.retrieval_rank,
      })
      .onConflictDoNothing();
  }

  await saveProjectExtension(db, store);
  storeCache.set(store.project.id, store);
}

export { metricsFromStore };
