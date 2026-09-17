import {
  assignProjectBands,
  generateActions,
  type ActionsEvidenceBundle,
  type GeneratedActionDraft,
} from "@geo/core";
import {
  newId,
  type ActionRecord,
  type ActionStatus,
  type ActionStatusEvent,
} from "./schema.js";
import { reportsFromStore } from "./sources.js";
import { agentEvidenceForActions } from "./agentAnalytics.js";
import { contradictedClaimsForActions } from "./perception.js";
import { productAttributeGapsForActions } from "./shopping.js";
import type { DemoStore } from "./seed.js";

const lastGenerateAt = new Map<string, number>();
const COOLDOWN_MS = 30_000;

function pageTypeFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("compar")) return "comparison";
  if (u.includes("pric")) return "pricing";
  if (u.includes("review")) return "review";
  if (u.includes("blog") || u.includes("article")) return "article";
  return "landing";
}

/** Build evidence bundle from demo store (+ seeded crawl/fact/shopping stubs). */
export function evidenceBundleFromStore(store: DemoStore): ActionsEvidenceBundle {
  const { domains, urls } = reportsFromStore(store);
  const own = store.brands.find((b) => b.is_own);
  const ownDomains = store.project.domain
    ? [store.project.domain]
    : ["acme.example"];

  const topicImportance: Record<string, number> = {};
  for (const t of store.topics) {
    const prompts = store.prompts.filter((p) => p.topic_id === t.id);
    const vol =
      prompts.reduce((s, p) => s + (p.volume_score ?? 3), 0) /
      Math.max(1, prompts.length);
    topicImportance[t.id] = Math.min(1, (prompts.length / 5) * 0.5 + vol / 10);
  }

  // R1: topic × page-type gaps from cited competitor vs own sources
  const gapMap = new Map<
    string,
    {
      topicId: string;
      topicName: string;
      pageType: string;
      competitorCitedCount: number;
      ownCitedCount: number;
      competitorUrls: Map<string, number>;
    }
  >();

  for (const src of store.sources) {
    if (!src.cited) continue;
    const chat = store.chats.find((c) => c.id === src.chat_id);
    if (!chat) continue;
    const prompt = store.prompts.find((p) => p.id === chat.prompt_id);
    const topicId = prompt?.topic_id ?? "untagged";
    const topicName =
      store.topics.find((t) => t.id === topicId)?.name ?? "Untagged";
    const pageType = pageTypeFromUrl(src.url);
    const key = `${topicId}|${pageType}`;
    const cur = gapMap.get(key) ?? {
      topicId,
      topicName,
      pageType,
      competitorCitedCount: 0,
      ownCitedCount: 0,
      competitorUrls: new Map<string, number>(),
    };
    const isOwn = ownDomains.some(
      (d) => src.domain.toLowerCase() === d.toLowerCase(),
    );
    if (isOwn) {
      cur.ownCitedCount += src.citation_count || 1;
    } else {
      cur.competitorCitedCount += src.citation_count || 1;
      cur.competitorUrls.set(
        src.url,
        (cur.competitorUrls.get(src.url) ?? 0) + (src.citation_count || 1),
      );
    }
    gapMap.set(key, cur);
  }

  const topicPageTypeGaps = [...gapMap.values()].map((g) => ({
    topicId: g.topicId,
    topicName: g.topicName,
    pageType: g.pageType,
    competitorCitedCount: g.competitorCitedCount,
    ownCitedCount: g.ownCitedCount,
    competitorUrls: [...g.competitorUrls.entries()]
      .map(([url, citations]) => ({ url, citations }))
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 8),
  }));

  // Fanouts: own domain present in sources of same chat?
  const fanoutAgg = new Map<
    string,
    { text: string; type: string; occurrences: number; ownHits: number }
  >();
  for (const f of store.fanouts) {
    const key = `${f.type}|${f.text}`;
    const cur = fanoutAgg.get(key) ?? {
      text: f.text,
      type: f.type,
      occurrences: 0,
      ownHits: 0,
    };
    cur.occurrences += 1;
    const chatSources = store.sources.filter((s) => s.chat_id === f.chat_id);
    if (
      chatSources.some((s) =>
        ownDomains.some((d) => s.domain.toLowerCase() === d.toLowerCase()),
      )
    ) {
      cur.ownHits += 1;
    }
    fanoutAgg.set(key, cur);
  }

  const dates = store.chats.map((c) => c.run_date).sort();
  const windowDays =
    dates.length >= 2
      ? Math.max(
          1,
          Math.round(
            (Date.parse(dates[dates.length - 1]!) - Date.parse(dates[0]!)) /
              86_400_000,
          ) + 1,
        )
      : 90;

  return {
    ownBrandName: own?.name ?? "Your brand",
    ownDomains,
    windowDays,
    domains: domains.map((d) => ({
      domain: d.domain,
      classification: d.classification,
      retrieval_count: d.retrieval_count,
      gap_score: d.gap_score,
      gap_score_normalized: d.gap_score_normalized,
      competitor_brands_mentioned: d.competitor_brands_mentioned,
      own_brand_mentioned: d.own_brand_mentioned,
      total_citations: d.total_citations,
    })),
    urls: urls.map((u) => ({
      url: u.url,
      domain: u.domain,
      classification: u.classification,
      retrieval_count: u.retrieval_count,
      citation_count: u.citation_count,
      citation_rate: u.citation_rate,
      gap_score: u.gap_score,
      own_brand_mentioned: u.own_brand_mentioned,
      competitor_brands_mentioned: u.competitor_brands_mentioned,
    })),
    topicPageTypeGaps,
    fanouts: [...fanoutAgg.values()].map((f) => ({
      text: f.text,
      type: f.type,
      occurrences: f.occurrences,
      ownDomainInSources: f.ownHits > 0,
    })),
    // Seeded stubs until Perception/Shopping land; crawlability from agent analytics
    ...(() => {
      const ev = agentEvidenceForActions(store);
      return {
        robotsBlocks: ev.robotsBlocks,
        crawlErrors: ev.crawlErrors,
      };
    })(),
    contradictedClaims: contradictedClaimsForActions(store),
    productAttributeGaps: productAttributeGapsForActions(store),
    topicImportance,
    // Slightly lower thresholds so demo seed produces R1/R10
    r1Threshold: 2,
    fanoutThreshold: 3,
    highRetrievalThreshold: 3,
    r3Threshold: 3,
  };
}

function draftToRecord(
  store: DemoStore,
  draft: GeneratedActionDraft,
  impact_band: string,
  now: string,
): ActionRecord {
  return {
    id: newId("act"),
    project_id: store.project.id,
    rule_id: draft.rule_id,
    group: draft.group,
    subtype: draft.subtype,
    status: "new",
    overview: draft.overview,
    why_this_matters: draft.why_this_matters,
    competitor_evidence: draft.competitor_evidence,
    brief: draft.brief,
    steps: draft.steps.map((s) => ({
      id: newId("stp"),
      text: s.text,
      done: false,
    })),
    expected_outcome: draft.expected_outcome,
    additional_context: draft.additional_context,
    scope: { ...draft.scope, domain: store.project.domain ?? undefined },
    evidence: draft.evidence,
    opportunity_score: draft.opportunity_score,
    relative_opportunity_score: draft.relative_opportunity_score,
    impact_band,
    created_at: now,
    updated_at: now,
  };
}

export function generateActionsForStore(
  store: DemoStore,
  opts?: { force?: boolean },
): { actions: ActionRecord[]; cooldown_ms: number; regenerated: boolean } {
  const now = Date.now();
  const prev = lastGenerateAt.get(store.project.id) ?? 0;
  if (!opts?.force && now - prev < COOLDOWN_MS && store.actions.length > 0) {
    return {
      actions: store.actions,
      cooldown_ms: COOLDOWN_MS - (now - prev),
      regenerated: false,
    };
  }

  const bundle = evidenceBundleFromStore(store);
  const drafts = generateActions(bundle);
  const banded = assignProjectBands(drafts);
  const iso = new Date().toISOString();

  // Preserve status for matching rule+overview keys when regenerating
  const prevByKey = new Map(
    store.actions.map((a) => [`${a.rule_id}|${a.overview}`, a]),
  );

  const next: ActionRecord[] = banded.map((d) => {
    const existing = prevByKey.get(`${d.rule_id}|${d.overview}`);
    const rec = draftToRecord(store, d, d.impact_band, iso);
    if (existing) {
      rec.id = existing.id;
      rec.status = existing.status;
      rec.steps = existing.steps;
      rec.created_at = existing.created_at;
    }
    return rec;
  });

  store.actions = next;
  lastGenerateAt.set(store.project.id, now);

  // Seed a couple lifecycle events for Impact demo if none yet
  if (store.actionEvents.length === 0 && next.length > 0) {
    const a0 = next[0]!;
    const a1 = next[1] ?? next[0]!;
    const day = store.chats[Math.floor(store.chats.length * 0.6)]?.run_date;
    const day2 = store.chats[Math.floor(store.chats.length * 0.75)]?.run_date;
    if (day) {
      a0.status = "in_progress";
      store.actionEvents.push({
        id: newId("asev"),
        action_id: a0.id,
        project_id: store.project.id,
        from: "new",
        to: "in_progress",
        at: `${day}T12:00:00.000Z`,
      });
    }
    if (day2) {
      a1.status = "done";
      store.actionEvents.push({
        id: newId("asev"),
        action_id: a1.id,
        project_id: store.project.id,
        from: "in_progress",
        to: "done",
        at: `${day2}T15:00:00.000Z`,
      });
    }
  }

  return { actions: store.actions, cooldown_ms: COOLDOWN_MS, regenerated: true };
}

export function listActions(
  store: DemoStore,
  filters?: {
    status?: ActionStatus | "all";
    group?: string;
    regroup?: "group" | "subtype";
  },
) {
  if (store.actions.length === 0) {
    generateActionsForStore(store, { force: true });
  }
  const currentDomain = store.project.domain?.toLowerCase();
  let rows = store.actions.filter((action) => {
    if (!store.analysisScope || !currentDomain) return true;
    return action.scope.domain?.toLowerCase() === currentDomain;
  });
  if (filters?.status && filters.status !== "all") {
    rows = rows.filter((a) => a.status === filters.status);
  }
  if (filters?.group) {
    rows = rows.filter((a) => a.group === filters.group);
  }
  rows.sort((a, b) => b.opportunity_score - a.opportunity_score);

  const scopedActions = store.actions.filter((action) => {
    if (!store.analysisScope || !currentDomain) return true;
    return action.scope.domain?.toLowerCase() === currentDomain;
  });
  const counts = {
    SITE_AUDIT: scopedActions.filter((a) => a.group === "SITE_AUDIT").length,
    OWNED: scopedActions.filter((a) => a.group === "OWNED").length,
    EARNED: scopedActions.filter((a) => a.group === "EARNED").length,
    by_status: {
      new: scopedActions.filter((a) => a.status === "new").length,
      in_progress: scopedActions.filter((a) => a.status === "in_progress").length,
      done: scopedActions.filter((a) => a.status === "done").length,
      declined: scopedActions.filter((a) => a.status === "declined").length,
    },
  };

  return { rows, counts };
}

export function getAction(store: DemoStore, actionId: string) {
  return store.actions.find((a) => a.id === actionId) ?? null;
}

const TRANSITIONS: Record<
  ActionStatus,
  Partial<Record<string, ActionStatus>>
> = {
  new: { accept: "in_progress", decline: "declined" },
  in_progress: { complete: "done", cancel: "new" },
  done: {},
  declined: {},
};

export function transitionAction(
  store: DemoStore,
  actionId: string,
  verb: "accept" | "decline" | "complete" | "cancel",
  userId?: string,
): ActionRecord | null {
  const action = getAction(store, actionId);
  if (!action) return null;
  const next = TRANSITIONS[action.status][verb];
  if (!next) return null;
  const from = action.status;
  action.status = next;
  action.updated_at = new Date().toISOString();
  store.actionEvents.push({
    id: newId("asev"),
    action_id: action.id,
    project_id: store.project.id,
    from,
    to: next,
    at: action.updated_at,
    user_id: userId,
  });
  return action;
}

export function toggleActionStep(
  store: DemoStore,
  actionId: string,
  stepId: string,
): ActionRecord | null {
  const action = getAction(store, actionId);
  if (!action) return null;
  const step = action.steps.find((s) => s.id === stepId);
  if (!step) return null;
  step.done = !step.done;
  action.updated_at = new Date().toISOString();
  return action;
}

/**
 * Impact: daily visibility for own brand + status markers.
 * Do not claim causality — markers are before/after aids only.
 */
export function impactFromStore(store: DemoStore) {
  const own = store.brands.find((b) => b.is_own);
  if (!own) {
    return { series: [], markers: [], note: "no_own_brand" };
  }

  const byDate = new Map<string, { chats: string[]; mentioned: Set<string> }>();
  for (const c of store.chats) {
    if (c.status !== "ok" && c.status !== "empty") continue;
    const bucket = byDate.get(c.run_date) ?? {
      chats: [],
      mentioned: new Set(),
    };
    bucket.chats.push(c.id);
    byDate.set(c.run_date, bucket);
  }
  for (const m of store.mentions) {
    if (m.brand_id !== own.id) continue;
    const chat = store.chats.find((c) => c.id === m.chat_id);
    if (!chat) continue;
    const bucket = byDate.get(chat.run_date);
    if (bucket) bucket.mentioned.add(chat.id);
  }

  const series = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      visibility: b.chats.length === 0 ? 0 : b.mentioned.size / b.chats.length,
      chat_count: b.chats.length,
    }));

  const markers = store.actionEvents
    .filter((e) => e.to === "in_progress" || e.to === "done")
    .map((e) => {
      const action = getAction(store, e.action_id);
      return {
        at: e.at,
        date: e.at.slice(0, 10),
        kind: e.to === "done" ? ("done" as const) : ("in_progress" as const),
        action_id: e.action_id,
        overview: action?.overview ?? e.action_id,
        color: e.to === "done" ? "green" : "amber",
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    series,
    markers,
    note: "Markers show when actions changed status. This is not causal attribution.",
  };
}

export type { ActionStatusEvent };
