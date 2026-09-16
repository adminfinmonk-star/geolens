import { compareBrandRank, competitiveVisibilityScore } from "@geo/core";
import type { DemoStore } from "./seed.js";
import { metricsFromStore } from "./seed.js";

/** Canonical brands report — dashboard, API, MCP, CSV must call this. */
export function brandsReportPayload(store: DemoStore) {
  const rows = metricsFromStore(store).sort(
    (a, b) => b.visibility - a.visibility,
  );
  return {
    project_id: store.project.id,
    formula: {
      visibility: "visibility_count / visibility_total",
      share_of_voice: "brand_mentions / all_brand_mentions",
      position: "mean position among chats where brand appears",
      sentiment: "mean sentiment among chats where brand appears",
    },
    filters_vs_having:
      "filters shrink the chat set before aggregation; having filters metric rows after.",
    pitfalls: [
      "Empty/error chats do not depress visibility denominators.",
      "SoV collapses when the brand set changes — compare like-for-like windows.",
    ],
    rows,
    meta: {
      chats: store.chats.length,
      additive: true,
      rollup_watermark: new Date().toISOString(),
    },
  };
}

export function brandsReportCsv(store: DemoStore): string {
  const { rows } = brandsReportPayload(store);
  const header = [
    "brand_id",
    "brand_name",
    "is_own",
    "visibility",
    "share_of_voice",
    "position",
    "sentiment",
    "mention_count",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.brand_id,
      csvEscape(r.brand_name),
      r.is_own ? "1" : "0",
      r.visibility,
      r.share_of_voice,
      r.position ?? "",
      r.sentiment ?? "",
      r.mention_count,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function chatsReportCsv(store: DemoStore, limit = 5000): string {
  const header = [
    "chat_id",
    "run_date",
    "country_code",
    "model_channel_id",
    "surface_kind",
    "status",
    "prompt_id",
    "prompt_text",
    "brand_mentions",
  ].join(",");
  const promptById = new Map(store.prompts.map((p) => [p.id, p]));
  const lines = store.chats.slice(0, limit).map((c) => {
    const mentions = store.mentions
      .filter((m) => m.chat_id === c.id)
      .map((m) => {
        const b = store.brands.find((x) => x.id === m.brand_id);
        return b?.name ?? m.brand_id;
      })
      .join("|");
    return [
      c.id,
      c.run_date,
      c.country_code,
      c.model_channel_id,
      c.surface_kind ?? "",
      c.status,
      c.prompt_id,
      csvEscape(promptById.get(c.prompt_id)?.text ?? ""),
      csvEscape(mentions),
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Flat BI connector schema (§13). */
export function biBrandsFlat(store: DemoStore) {
  const { rows, meta } = brandsReportPayload(store);
  return {
    schema: "geo_bi_brands_v1",
    project_id: store.project.id,
    generated_at: meta.rollup_watermark,
    data: rows.map((r) => ({
      project_id: store.project.id,
      brand_id: r.brand_id,
      brand_name: r.brand_name,
      is_own: r.is_own,
      visibility: r.visibility,
      share_of_voice: r.share_of_voice,
      position: r.position,
      sentiment: r.sentiment,
      mention_count: r.mention_count,
    })),
  };
}

export const OVERVIEW_RANGES = ["7d", "30d", "90d"] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export type OverviewFilterInput = {
  range?: string | null;
  channel?: string | null;
};

export function parseOverviewFilters(input: OverviewFilterInput = {}): {
  range: OverviewRange;
  channel: string | null;
} {
  const range = OVERVIEW_RANGES.includes(input.range as OverviewRange)
    ? (input.range as OverviewRange)
    : "7d";
  const raw = input.channel?.trim();
  const channel = !raw || raw === "all" ? null : raw;
  return { range, channel };
}

function overviewRangeDays(range: OverviewRange): number {
  if (range === "90d") return 90;
  if (range === "30d") return 30;
  return 7;
}

function overviewWindow(
  chats: DemoStore["chats"],
  range: OverviewRange,
): { from: string; to: string } {
  const days = overviewRangeDays(range);
  const latest = chats.reduce((max, c) => {
    const day = c.run_date.slice(0, 10);
    return day > max ? day : max;
  }, "");
  const to = latest || new Date().toISOString().slice(0, 10);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  const from = new Date(toMs - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

function sliceOverviewStore(
  store: DemoStore,
  from: string,
  to: string,
  channel: string | null,
): DemoStore {
  const chats = store.chats.filter((c) => {
    const day = c.run_date.slice(0, 10);
    if (day < from || day > to) return false;
    if (channel && c.model_channel_id !== channel) return false;
    return true;
  });
  const chatIds = new Set(chats.map((c) => c.id));
  return {
    ...store,
    chats,
    mentions: store.mentions.filter((m) => chatIds.has(m.chat_id)),
    sources: store.sources.filter((s) => chatIds.has(s.chat_id)),
  };
}

export type OverviewReport = ReturnType<typeof overviewReportPayload>;

/**
 * Visibility Overview aggregate — score gauge, channel mix, country mix,
 * competitor rank, topic snapshot. Prefer this over client-side demos.
 */
export function overviewReportPayload(
  store: DemoStore,
  filters: OverviewFilterInput = {},
) {
  const parsed = parseOverviewFilters(filters);
  const { from, to } = overviewWindow(store.chats, parsed.range);
  const view = sliceOverviewStore(store, from, to, parsed.channel);
  const brands = brandsReportPayload(view);
  const own = brands.rows.find((r) => r.is_own) ?? brands.rows[0];
  const ranked = [...brands.rows].sort(compareBrandRank);
  const ownRank =
    own != null
      ? ranked.findIndex((r) => r.brand_id === own.brand_id) + 1
      : null;

  const eligibleChats = own?.visibility_total ?? 0;
  const scored = competitiveVisibilityScore({
    visibility: own?.visibility ?? 0,
    shareOfVoice: own?.share_of_voice ?? 0,
    position: own?.position ?? null,
    eligibleChats,
  });
  const band = scored.band;

  const byChannel = new Map<
    string,
    { chats: number; ok: number; mentioned: Set<string> }
  >();
  for (const c of view.chats) {
    const cur = byChannel.get(c.model_channel_id) ?? {
      chats: 0,
      ok: 0,
      mentioned: new Set<string>(),
    };
    cur.chats += 1;
    if (c.status === "ok" || c.status === "empty") cur.ok += 1;
    byChannel.set(c.model_channel_id, cur);
  }
  if (own) {
    for (const m of view.mentions) {
      if (m.brand_id !== own.brand_id) continue;
      const chat = view.chats.find((c) => c.id === m.chat_id);
      if (!chat) continue;
      const cur = byChannel.get(chat.model_channel_id);
      if (cur) cur.mentioned.add(chat.id);
    }
  }
  const channelRows = [...byChannel.entries()]
    .map(([channel_id, v]) => ({
      channel_id,
      label: channel_id.split("-")[0] ?? channel_id,
      chat_count: v.chats,
      mention_count: v.mentioned.size,
      visibility: v.ok === 0 ? 0 : v.mentioned.size / v.ok,
    }))
    .sort((a, b) => b.mention_count - a.mention_count);

  const mentionTotal = channelRows.reduce((s, r) => s + r.mention_count, 0);
  const channels = channelRows.map((r) => ({
    ...r,
    share: mentionTotal === 0 ? 0 : r.mention_count / mentionTotal,
  }));

  const byCountry = new Map<string, number>();
  for (const c of view.chats) {
    const code = (c.country_code || "XX").toUpperCase();
    byCountry.set(code, (byCountry.get(code) ?? 0) + 1);
  }
  const countryTotal = view.chats.length || 1;
  const countries = [...byCountry.entries()]
    .map(([code, count]) => ({
      code,
      count,
      share: count / countryTotal,
    }))
    .sort((a, b) => b.count - a.count);

  const topicPromptCount = new Map<string, number>();
  const promptsByTopic = new Map<string, string[]>();
  for (const p of store.prompts) {
    if (!p.topic_id) continue;
    topicPromptCount.set(
      p.topic_id,
      (topicPromptCount.get(p.topic_id) ?? 0) + 1,
    );
    const list = promptsByTopic.get(p.topic_id) ?? [];
    list.push(p.id);
    promptsByTopic.set(p.topic_id, list);
  }
  const ownBrandId = own?.brand_id;
  let topicVisibilityIsProxy = false;
  const topics = store.topics.slice(0, 8).map((t) => {
    const promptIds = new Set(promptsByTopic.get(t.id) ?? []);
    const topicChats = view.chats.filter(
      (c) =>
        promptIds.has(c.prompt_id) &&
        (c.status === "ok" || c.status === "empty"),
    );
    const eligible = topicChats.length;
    const topicChatIds = new Set(topicChats.map((c) => c.id));
    const mentionedChats = new Set<string>();
    if (ownBrandId && eligible > 0) {
      for (const m of view.mentions) {
        if (m.brand_id === ownBrandId && topicChatIds.has(m.chat_id)) {
          mentionedChats.add(m.chat_id);
        }
      }
    } else if (eligible === 0) {
      topicVisibilityIsProxy = topicVisibilityIsProxy || promptsByTopic.has(t.id);
    }
    const mentioned = mentionedChats.size;
    const visibility =
      eligible > 0 ? mentioned / eligible : own ? own.visibility : 0;
    if (eligible === 0 && (topicPromptCount.get(t.id) ?? 0) > 0) {
      topicVisibilityIsProxy = true;
    }
    return {
      id: t.id,
      name: t.name,
      prompt_count: topicPromptCount.get(t.id) ?? 0,
      visibility,
      mention_estimate: mentioned,
      chats_eligible: eligible,
    };
  });

  const chatDay = new Map(
    view.chats.map((c) => [c.id, c.run_date.slice(0, 10)] as const),
  );
  const byDay = new Map<
    string,
    {
      chats: number;
      mentions: number;
      citations: number;
      citedUrls: Set<string>;
    }
  >();
  for (const c of view.chats) {
    const day = c.run_date.slice(0, 10);
    const cur = byDay.get(day) ?? {
      chats: 0,
      mentions: 0,
      citations: 0,
      citedUrls: new Set<string>(),
    };
    cur.chats += 1;
    byDay.set(day, cur);
  }
  if (own) {
    for (const m of view.mentions) {
      if (m.brand_id !== own.brand_id) continue;
      const day = chatDay.get(m.chat_id);
      if (!day) continue;
      const cur = byDay.get(day);
      if (cur) cur.mentions += 1;
    }
  }
  for (const s of view.sources) {
    if (!s.cited) continue;
    const day = chatDay.get(s.chat_id);
    if (!day) continue;
    const cur = byDay.get(day);
    if (!cur) continue;
    cur.citations += 1;
    cur.citedUrls.add(s.url);
  }
  const series = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      chats: v.chats,
      mentions: v.mentions,
      citations: v.citations,
      cited_pages: v.citedUrls.size,
      visibility: v.chats === 0 ? 0 : v.mentions / v.chats,
    }));

  const domainMap = new Map<string, number>();
  for (const s of view.sources) {
    if (!s.cited) continue;
    domainMap.set(s.domain, (domainMap.get(s.domain) ?? 0) + 1);
  }
  const cited_domains = [...domainMap.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const liveSurfaces = view.chats.filter(
    (c) => c.surface_kind === "api" || c.surface_kind === "ui",
  ).length;
  const fixtureLike = view.chats.filter((c) =>
    (c.text ?? "").includes("fixture surface"),
  ).length;
  const channelIds = new Set(view.chats.map((c) => c.model_channel_id));
  const collectionMode =
    view.chats.length === 0
      ? "empty"
      : fixtureLike === 0
        ? "live"
        : fixtureLike === view.chats.length
          ? "fixture"
          : "mixed";
  const rangeLabel =
    parsed.range === "90d"
      ? "Last 90 days"
      : parsed.range === "30d"
        ? "Last 30 days"
        : "Last 7 days";
  const channelNote = parsed.channel ? `, ${parsed.channel} only` : "";
  const windowNote = `${rangeLabel} (${from} to ${to})${channelNote}.`;
  const sampleNote = `Figures are from ${view.chats.length} collected answer${
    view.chats.length === 1 ? "" : "s"
  } across ${channelIds.size} model${channelIds.size === 1 ? "" : "s"} in this project — not a multi-month industry index.`;
  const fixtureNote =
    collectionMode === "fixture" || collectionMode === "mixed"
      ? " Adapter fixtures are synthetic answers for local/dev collection. They will not match live LLM or Semrush-scale totals. Add provider keys (or Cursor/OpenRouter) and Analyze again for real answers."
      : " Country is the requested market on chats, not true localization.";

  return {
    project_id: store.project.id,
    domain: store.project.domain ?? null,
    brand: own
      ? {
          id: own.brand_id,
          name: own.brand_name,
          visibility: own.visibility,
          share_of_voice: own.share_of_voice,
          position: own.position,
          sentiment: own.sentiment,
          mention_count: own.mention_count,
          rank: ownRank,
          of: ranked.length,
        }
      : null,
    score: {
      value: scored.value,
      band,
      label:
        band === "high" ? "High" : band === "medium" ? "Medium" : "Low",
      insight: scoreInsight(band, scored.sampleThin, view.chats.length),
      sample_thin: scored.sampleThin,
      presence: own?.visibility ?? 0,
    },
    kpis: {
      mentions: own?.mention_count ?? 0,
      citations: view.sources.filter((s) => s.cited).length,
      cited_pages: new Set(
        view.sources.filter((s) => s.cited).map((s) => s.url),
      ).size,
      chats: view.chats.length,
    },
    filters: {
      range: parsed.range,
      channel: parsed.channel ?? "all",
      from,
      to,
    },
    channels,
    countries,
    competitors: ranked.slice(0, 6).map((r) => ({
      brand_id: r.brand_id,
      brand_name: r.brand_name,
      is_own: Boolean(r.is_own),
      visibility: r.visibility,
      share_of_voice: r.share_of_voice,
      mention_count: r.mention_count,
    })),
    topics,
    series,
    cited_domains,
    honesty: {
      series_is_collected: series.length >= 1 && view.chats.length > 0,
      country_is_requested_market: true,
      topic_visibility_is_proxy: topicVisibilityIsProxy,
      score_sample_thin: scored.sampleThin,
      collection_is_live: liveSurfaces > 0 && fixtureLike === 0,
      collection_mode: collectionMode,
      fixture_chats: fixtureLike,
      channel_count: channelIds.size,
      chats_collected: view.chats.length,
      range: parsed.range,
      channel: parsed.channel ?? "all",
      from,
      to,
      note: `${windowNote} ${sampleNote}${fixtureNote}`,
    },
  };
}

function scoreInsight(
  band: "high" | "medium" | "low",
  sampleThin: boolean,
  chats: number,
): string {
  if (chats === 0) {
    return "No collected answers yet. Run Analyze to score this brand.";
  }
  if (sampleThin) {
    return `Based on ${chats} collected answer${chats === 1 ? "" : "s"}. Showing up in a short list is not a high score until more prompts and models are collected.`;
  }
  if (band === "high") {
    return "Mentioned often and holds a meaningful share versus tracked brands.";
  }
  if (band === "medium") {
    return "Present in answers, but competitors still take more of the conversation.";
  }
  return "Rarely mentioned, or named only in lists dominated by other brands.";
}

