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
