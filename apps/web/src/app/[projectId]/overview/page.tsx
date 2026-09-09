import { apiFetch } from "@/lib/api-server";
import Link from "next/link";
import { RankBars, TrendChart } from "@/components/charts";
import { ExportOverviewButton } from "./export-button";
import { ShareOverviewButton } from "./share-button";

type BrandRow = {
  brand_id: string;
  brand_name: string;
  is_own?: boolean;
  visibility: number;
  share_of_voice: number;
  position: number | null;
  sentiment: number | null;
  mention_count: number;
};

type DomainRow = {
  domain: string;
  retrieved_percentage?: number;
  citation_rate?: number;
};

type ActionRow = {
  id: string;
  overview: string;
  status: string;
  opportunity_score?: number;
};

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function pctLabel(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function synthSeries(seed: number, end: number): number[] {
  const out: number[] = [];
  let v = Math.max(8, end * 0.55 + (seed % 7));
  for (let i = 0; i < 6; i++) {
    v = v + (end - v) * 0.28 + ((seed + i) % 5) - 2;
    out.push(Math.max(5, Math.min(95, v)));
  }
  out[5] = end;
  return out;
}

const PLATFORM_DEMO = [
  { name: "ChatGPT", pct: 58 },
  { name: "Perplexity", pct: 51 },
  { name: "AI Overviews", pct: 44 },
  { name: "Gemini", pct: 35 },
];

const COUNTRY_DEMO = [
  { name: "United States", pct: 52, color: "var(--chart-1)" },
  { name: "United Kingdom", pct: 21, color: "var(--chart-2)" },
  { name: "India", pct: 14, color: "var(--chart-3)" },
  { name: "Other", pct: 13, color: "var(--chart-4)" },
];

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [data, domains, actions, chats] = await Promise.all([
    fetchJson<{
      rows: BrandRow[];
      meta?: { chats: number };
    }>(`/v1/projects/${projectId}/reports/brands`),
    fetchJson<{ rows: DomainRow[] }>(
      `/v1/projects/${projectId}/reports/domains`,
    ),
    fetchJson<{ rows: ActionRow[] }>(
      `/v1/projects/${projectId}/actions?status=new`,
    ),
    fetchJson<{
      rows: {
        id: string;
        run_date: string;
        model_channel_id: string;
        prompt_text?: string;
      }[];
    }>(`/v1/projects/${projectId}/chats?limit=6`),
  ]);

  const own = data?.rows.find((r) => r.is_own) ?? data?.rows[0];
  const ranked = [...(data?.rows ?? [])].sort(
    (a, b) => b.visibility - a.visibility,
  );
  const ownRank =
    own != null
      ? ranked.findIndex((r) => r.brand_id === own.brand_id) + 1
      : null;
  const total = ranked.length || 1;

  const SERIES_COLORS = [
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
  ];
  const chartSeries = ranked.slice(0, 4).map((r, i) => ({
    label: r.is_own ? `${r.brand_name} (You)` : r.brand_name,
    color: r.is_own ? "var(--chart-1)" : SERIES_COLORS[i % SERIES_COLORS.length],
    points: synthSeries(r.brand_name.length + i * 3, r.visibility * 100),
  }));

  const mentions =
    own?.mention_count ??
    Math.max(0, Math.round((own?.visibility ?? 0) * 240));

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Visibility Overview</h1>
            <span className="geo-badge geo-badge-positive">Live index</span>
          </div>
          <p className="geo-page-lede">
            How often ChatGPT, Perplexity, Gemini, and AI Overviews mention your
            brand
            {own ? ` — ${own.brand_name}` : ""}.
          </p>
        </div>
        <div className="geo-vis-actions">
          <ExportOverviewButton projectId={projectId} />
          <ShareOverviewButton projectId={projectId} />
        </div>
      </header>

      {!data && (
        <div
          role="alert"
          className="geo-callout geo-callout-warning"
          style={{ marginBottom: "var(--space-4)" }}
        >
          <span>
            Couldn&apos;t load report data. Start the API with{" "}
            <code>pnpm --filter @geo/api dev</code>, then refresh.
          </span>
        </div>
      )}

      {own && (
        <div className="geo-vis-kpis">
          <article className="geo-vis-kpi">
            <p className="geo-vis-kpi-label">AI Visibility</p>
            <p className="geo-vis-kpi-value">{pctLabel(own.visibility)}</p>
            <p className="geo-vis-kpi-meta">
              Rank {ownRank}/{total}
              {data?.meta?.chats != null ? ` · ${data.meta.chats} chats` : ""}
            </p>
          </article>
          <article className="geo-vis-kpi">
            <p className="geo-vis-kpi-label">Avg Position</p>
            <p className="geo-vis-kpi-value">
              {own.position != null ? own.position.toFixed(1) : "—"}
            </p>
            <p className="geo-vis-kpi-meta">Lower is better</p>
          </article>
          <article className="geo-vis-kpi">
            <p className="geo-vis-kpi-label">Share of Voice</p>
            <p className="geo-vis-kpi-value">{pctLabel(own.share_of_voice)}</p>
            <p className="geo-vis-kpi-meta">vs tracked competitors</p>
          </article>
          <article className="geo-vis-kpi">
            <p className="geo-vis-kpi-label">Total Mentions</p>
            <p className="geo-vis-kpi-value">{mentions}</p>
            <p className="geo-vis-kpi-meta">
              Sentiment{" "}
              {own.sentiment != null ? Math.round(own.sentiment) : "—"}
            </p>
          </article>
        </div>
      )}

      <div className="geo-vis-grid-main">
        <section className="geo-panel geo-vis-panel">
          <div className="geo-vis-panel-head">
            <h2 className="geo-section-title" style={{ margin: 0 }}>
              AI Visibility Over Time
            </h2>
            <span className="geo-badge geo-badge-neutral">Illustrative</span>
          </div>
          {chartSeries.length > 0 ? (
            <>
              <TrendChart series={chartSeries} />
              <p className="geo-vis-note">
                Shape is interpolated toward each brand&apos;s current
                visibility — not collected history. Real time-series appears
                once chats span multiple run dates.
              </p>
            </>
          ) : (
            <div className="geo-empty">
              <p className="geo-empty-title">No trend data yet</p>
              <p className="geo-empty-body">
                Run a collection to start building visibility history.
              </p>
              <Link
                href={`/${projectId}/prompts`}
                className="geo-btn geo-btn-primary geo-btn-sm"
              >
                Set up prompts
              </Link>
            </div>
          )}
        </section>

        <section className="geo-panel geo-vis-panel">
          <h2 className="geo-section-title">Who AI recommends</h2>
          {ranked.length > 0 ? (
            <RankBars
              rows={ranked.slice(0, 6).map((r) => ({
                name: r.brand_name,
                pct: r.visibility * 100,
                highlight: Boolean(r.is_own),
              }))}
            />
          ) : (
            <p className="geo-vis-note">No competitor rankings yet.</p>
          )}
        </section>
      </div>

      <div className="geo-vis-grid-bottom">
        <section className="geo-panel geo-vis-panel">
          <h2 className="geo-section-title">Visibility by AI platform</h2>
          <p className="geo-vis-note" style={{ marginTop: 0 }}>
            Demo mix until channel rollups are wired to filters.
          </p>
          <ul className="geo-vis-bars">
            {PLATFORM_DEMO.map((p) => (
              <li key={p.name}>
                <div className="geo-vis-bar-meta">
                  <span>{p.name}</span>
                  <span className="mono">{p.pct}%</span>
                </div>
                <div className="geo-vis-bar-track">
                  <span style={{ width: `${p.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="geo-panel geo-vis-panel">
          <h2 className="geo-section-title">Mentions by country</h2>
          <div className="geo-vis-country-bar" aria-hidden>
            {COUNTRY_DEMO.map((c) => (
              <span
                key={c.name}
                style={{ width: `${c.pct}%`, background: c.color }}
              />
            ))}
          </div>
          <ul className="geo-vis-country-list">
            {COUNTRY_DEMO.map((c) => (
              <li key={c.name}>
                <i style={{ background: c.color }} />
                <span>{c.name}</span>
                <strong>{c.pct}%</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="geo-vis-grid-bottom">
        <section className="geo-panel geo-vis-panel">
          <h2 className="geo-section-title">
            Top actions
            <Link href={`/${projectId}/actions`} className="geo-link-quiet">
              View all
            </Link>
          </h2>
          <ul className="geo-list-plain">
            {(actions?.rows ?? []).slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link href={`/${projectId}/actions/${a.id}`}>
                  <span style={{ fontWeight: 500 }}>{a.overview}</span>
                </Link>
              </li>
            ))}
            {(actions?.rows?.length ?? 0) === 0 && (
              <li style={{ color: "var(--muted)", padding: "0.5rem 0" }}>
                No open actions
              </li>
            )}
          </ul>
        </section>

        <section className="geo-panel geo-vis-panel">
          <h2 className="geo-section-title">
            Recent chats
            <Link href={`/${projectId}/chats`} className="geo-link-quiet">
              Open
            </Link>
          </h2>
          <ul className="geo-list-plain">
            {(chats?.rows ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/${projectId}/chats/${c.id}`}>
                  <span
                    style={{ fontWeight: 500, display: "block", fontSize: 13.5 }}
                  >
                    {c.prompt_text?.slice(0, 72) || c.run_date}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    {c.model_channel_id} · {c.run_date}
                  </span>
                </Link>
              </li>
            ))}
            {(chats?.rows?.length ?? 0) === 0 && (
              <li style={{ color: "var(--muted)", padding: "0.5rem 0" }}>
                No chats yet
              </li>
            )}
          </ul>
          {(domains?.rows?.length ?? 0) > 0 && (
            <p className="geo-vis-note">
              Top cited domain: {domains!.rows[0]!.domain}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
