import {
  computeBrandMetrics,
  computePerformanceMatrix,
  type MatrixAxis,
} from "@geo/core";
import { newId, type SharedView } from "./schema.js";
import type { DemoStore } from "./seed.js";

export function brandInsightsFromStore(
  store: DemoStore,
  brandId?: string,
  axes?: { rowAxis?: MatrixAxis; colAxis?: MatrixAxis },
) {
  const brand =
    store.brands.find((b) => b.id === brandId) ??
    store.brands.find((b) => b.is_own) ??
    store.brands[0]!;

  const chats = store.chats.map((c) => {
    const prompt = store.prompts.find((p) => p.id === c.prompt_id);
    return {
      chatId: c.id,
      status: c.status,
      channelId: c.model_channel_id,
      countryCode: c.country_code,
      topicId: prompt?.topic_id ?? "untagged",
      promptId: c.prompt_id,
    };
  });
  const mentions = store.mentions.map((m) => ({
    chatId: m.chat_id,
    brandId: m.brand_id,
    mentionCount: m.mention_count,
    position: m.position,
    sentiment: m.sentiment,
  }));

  const overall = computeBrandMetrics(
    chats.map((c) => ({ chatId: c.chatId, status: c.status })),
    mentions,
    [brand.id],
  )[0]!;

  const rowAxis = axes?.rowAxis ?? "topic";
  const colAxis = axes?.colAxis ?? "channel";
  const matrix = computePerformanceMatrix({
    chats,
    mentions,
    brandId: brand.id,
    rowAxis,
    colAxis,
  });

  const topicLabels = Object.fromEntries(
    store.topics.map((t) => [t.id, t.name]),
  );

  const labeled = {
    ...matrix,
    rowKeys: matrix.rowKeys.map((k) =>
      rowAxis === "topic" ? (topicLabels[k] ?? k) : k,
    ),
    cells: matrix.cells.map((c) => ({
      ...c,
      rowKey: rowAxis === "topic" ? (topicLabels[c.rowKey] ?? c.rowKey) : c.rowKey,
      colLabel: c.colKey,
    })),
  };

  // Strongest/weakest channel for the brand overall (all topics)
  const byChannel = new Map<string, { chats: typeof chats; mentionChatIds: Set<string> }>();
  for (const c of chats) {
    const cur = byChannel.get(c.channelId) ?? {
      chats: [],
      mentionChatIds: new Set<string>(),
    };
    cur.chats.push(c);
    byChannel.set(c.channelId, cur);
  }
  const channelScores = [...byChannel.entries()].map(([channelId, bucket]) => {
    const ids = new Set(bucket.chats.map((c) => c.chatId));
    const m = computeBrandMetrics(
      bucket.chats.map((c) => ({ chatId: c.chatId, status: c.status })),
      mentions.filter((x) => ids.has(x.chatId)),
      [brand.id],
    )[0]!;
    return { channelId, visibility: m.visibility };
  });
  channelScores.sort((a, b) => b.visibility - a.visibility);
  const sw = {
    strongest: channelScores[0]?.channelId ?? null,
    weakest: channelScores[channelScores.length - 1]?.channelId ?? null,
  };

  return {
    brand: { id: brand.id, name: brand.name, is_own: brand.is_own },
    kpis: {
      visibility: overall.visibility,
      share_of_voice: overall.shareOfVoice,
      position: overall.position,
      sentiment: overall.sentiment,
      strongest_channel: sw.strongest,
      weakest_channel: sw.weakest,
    },
    matrix: labeled,
  };
}

export function fanoutsFromStore(store: DemoStore) {
  const byQuery = new Map<
    string,
    { text: string; type: string; occurrences: number; channels: Set<string> }
  >();
  for (const f of store.fanouts) {
    const chat = store.chats.find((c) => c.id === f.chat_id);
    const key = `${f.type}|${f.text}`;
    const cur = byQuery.get(key) ?? {
      text: f.text,
      type: f.type,
      occurrences: 0,
      channels: new Set<string>(),
    };
    cur.occurrences += 1;
    if (chat) cur.channels.add(chat.model_channel_id);
    byQuery.set(key, cur);
  }
  const rows = [...byQuery.values()]
    .map((r) => ({
      text: r.text,
      type: r.type,
      occurrences: r.occurrences,
      channels: [...r.channels],
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  const terms = new Map<string, number>();
  for (const r of rows) {
    for (const w of r.text.toLowerCase().split(/\W+/).filter((x) => x.length > 3)) {
      terms.set(w, (terms.get(w) ?? 0) + r.occurrences);
    }
  }
  const commonTerms = [...terms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({ term, count }));

  return {
    distinct_queries: rows.length,
    total_occurrences: store.fanouts.length,
    rows: rows.slice(0, 200),
    common_terms: commonTerms,
  };
}

export function adsFromStore(store: DemoStore) {
  const byAdvertiser = new Map<
    string,
    { advertiser: string; times_seen: number; titles: Set<string> }
  >();
  for (const ad of store.ads) {
    const cur = byAdvertiser.get(ad.advertiser_name) ?? {
      advertiser: ad.advertiser_name,
      times_seen: 0,
      titles: new Set<string>(),
    };
    cur.times_seen += 1;
    cur.titles.add(ad.title);
    byAdvertiser.set(ad.advertiser_name, cur);
  }
  const chatsWithAds = new Set(store.ads.map((a) => a.chat_id));
  return {
    advertisers_in_market: byAdvertiser.size,
    prompts_with_ads: chatsWithAds.size,
    total_ads_seen: store.ads.length,
    rows: [...byAdvertiser.values()]
      .map((a) => ({
        advertiser: a.advertiser,
        times_seen: a.times_seen,
        creatives: [...a.titles],
      }))
      .sort((a, b) => b.times_seen - a.times_seen),
    note: "Ad tracking is richest on UI surfaces; simulator injects sparse ads for demo.",
  };
}

export function createSharedView(
  store: DemoStore,
  input: { name: string; widgets?: string[] },
): SharedView {
  const view: SharedView = {
    id: newId("vw"),
    project_id: store.project.id,
    name: input.name.trim() || "Shared overview",
    widgets: input.widgets ?? ["visibility", "sov", "position", "sentiment", "brands"],
    created_at: new Date().toISOString(),
  };
  store.sharedViews.push(view);
  return view;
}

export function getSharedView(store: DemoStore, viewId: string) {
  return store.sharedViews.find((v) => v.id === viewId) ?? null;
}
