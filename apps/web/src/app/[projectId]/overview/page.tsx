import { apiFetch } from "@/lib/api-server";
import Link from "next/link";
import { RankBars, TrendChart } from "@/components/charts";
import { ApiDownCallout } from "@/components/api-down-callout";
import { ExportOverviewButton } from "./export-button";
import { ShareOverviewButton } from "./share-button";

type Overview = {
  brand: {
    id: string;
    name: string;
    visibility: number;
    share_of_voice: number;
    position: number | null;
    sentiment: number | null;
    mention_count: number;
    rank: number | null;
    of: number;
  } | null;
  score: {
    value: number;
    band: string;
    label: string;
    insight: string;
    sample_thin?: boolean;
    presence?: number;
  };
  kpis: {
    mentions: number;
    citations: number;
    cited_pages: number;
    chats: number;
  };
  channels: {
    channel_id: string;
    label: string;
    chat_count: number;
    mention_count: number;
    visibility: number;
    share: number;
  }[];
  countries: { code: string; count: number; share: number }[];
  competitors: {
    brand_id: string;
    brand_name: string;
    is_own: boolean;
    visibility: number;
    share_of_voice?: number;
    mention_count: number;
  }[];
  topics: {
    id: string;
    name: string;
    prompt_count: number;
    visibility: number;
    mention_estimate: number;
    chats_eligible?: number;
  }[];
  series: {
    date: string;
    chats: number;
    mentions: number;
    citations?: number;
    cited_pages?: number;
    visibility: number;
  }[];
  cited_domains: { domain: string; count: number }[];
  domain?: string | null;
  filters?: {
    range: string;
    channel: string;
    from: string;
    to: string;
  };
  honesty: {
    series_is_collected: boolean;
    country_is_requested_market: boolean;
    topic_visibility_is_proxy: boolean;
    score_sample_thin?: boolean;
    collection_is_live?: boolean;
    collection_mode?: "empty" | "live" | "fixture" | "mixed";
    fixture_chats?: number;
    channel_count?: number;
    chats_collected?: number;
    from?: string;
    to?: string;
    note: string;
  };
};

type ActionRow = { id: string; overview: string; status: string };

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function channelLabel(id: string, fallback: string) {
  if (id.startsWith("openai") || id.includes("chatgpt")) return "ChatGPT";
  if (id.startsWith("perplexity")) return "Perplexity";
  if (id.includes("overview") || id.includes("ai-overview"))
    return "AI Overviews";
  if (id.startsWith("google") || id.includes("gemini")) return "Gemini";
  if (id.startsWith("anthropic") || id.includes("claude")) return "Claude";
  if (id.startsWith("sim")) return "Simulator";
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

function parseRange(raw: string | undefined): "7d" | "30d" | "90d" {
  if (raw === "30d" || raw === "90d") return raw;
  return "7d";
}

function seriesDelta(
  series: Overview["series"],
  key: "mentions" | "visibility" | "citations" | "cited_pages",
): number | null {
  if (series.length < 2) return null;
  const first = series[0]![key] ?? 0;
  const last = series[series.length - 1]![key] ?? 0;
  if (key === "visibility") {
    return Math.round((last - first) * 100);
  }
  if (first <= 0) return null;
  return Math.round(((last - first) / first) * 100);
}

function channelColor(id: string) {
  if (id.startsWith("openai") || id.includes("chatgpt")) return "var(--positive)";
  if (id.startsWith("perplexity")) return "var(--chart-1)";
  if (id.includes("overview") || id.includes("ai-overview"))
    return "var(--chart-4)";
  if (id.includes("ai-mode")) return "var(--chart-5)";
  if (id.startsWith("google") || id.includes("gemini")) return "var(--chart-2)";
  if (id.startsWith("anthropic") || id.includes("claude")) return "var(--chart-3)";
  if (id.includes("copilot")) return "var(--signal)";
  if (id.startsWith("sim")) return "var(--muted)";
  return "var(--accent)";
}

function DeltaChip({
  value,
  suffix = "%",
}: {
  value: number | null;
  suffix?: string;
}) {
  if (value == null) return null;
  const cls =
    value > 0
      ? "geo-badge geo-badge-positive"
      : value < 0
        ? "geo-badge geo-badge-warm"
        : "geo-badge geo-badge-neutral";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={cls}>
      {sign}
      {value}
      {suffix}
    </span>
  );
}

function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="geo-empty geo-empty-compact">
      <p className="geo-empty-title">{title}</p>
      <p className="geo-empty-body">{body}</p>
    </div>
  );
}

const COUNTRY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--muted-2)",
];

function VisibilityGauge({
  value,
  label,
  band,
}: {
  value: number;
  label: string;
  band: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 54;
  const c = 2 * Math.PI * r;
  const half = c / 2;
  const filled = (clamped / 100) * half;
  return (
    <div className="geo-gauge" data-band={band}>
      <svg viewBox="0 0 140 88" className="geo-gauge-svg" aria-hidden>
        <path
          className="geo-gauge-track"
          d="M 16 78 A 54 54 0 0 1 124 78"
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          className="geo-gauge-fill"
          d="M 16 78 A 54 54 0 0 1 124 78"
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${half}`}
        />
      </svg>
      <div className="geo-gauge-readout">
        <strong>
          {clamped}
          <span>/100</span>
        </strong>
        <em>{label}</em>
      </div>
    </div>
  );
}

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; channel?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const range = parseRange(query.range);
  const channel =
    query.channel && query.channel !== "all" ? query.channel : "";
  const qs = new URLSearchParams({ range });
  if (channel) qs.set("channel", channel);

  const [overview, actions, projectPayload] = await Promise.all([
    fetchJson<Overview>(
      `/v1/projects/${projectId}/reports/overview?${qs.toString()}`,
    ),
    fetchJson<{ rows: ActionRow[] }>(
      `/v1/projects/${projectId}/actions?status=new`,
    ),
    fetchJson<{ project?: { domain?: string } }>(
      `/v1/projects/${projectId}`,
    ),
  ]);
  const projectDomain =
    overview?.domain ?? projectPayload?.project?.domain ?? "";

  const brand = overview?.brand;
  const rawSeries = overview?.series ?? [];
  const chartSeries =
    rawSeries.length >= 1
      ? [
          {
            label: "Mentions",
            color: "var(--chart-1)",
            points: rawSeries.map((s) => s.mentions),
            total: overview?.kpis.mentions,
          },
          {
            label: "Citations",
            color: "var(--chart-2)",
            points: rawSeries.map((s) => s.citations ?? 0),
            total: overview?.kpis.citations,
          },
          {
            label: "Cited pages",
            color: "var(--chart-4)",
            points: rawSeries.map((s) => s.cited_pages ?? 0),
            dashed: true,
            total: overview?.kpis.cited_pages,
          },
        ]
      : [];
  const chartLabels = rawSeries.map((s) => s.date);

  const fixtureSample =
    overview?.honesty.collection_mode === "fixture" ||
    overview?.honesty.collection_mode === "mixed" ||
    (overview?.honesty.fixture_chats ?? 0) > 0;
  const showCollectionCallout = Boolean(
    overview &&
      (overview.honesty.score_sample_thin ||
        (fixtureSample && overview.kpis.chats < 16)),
  );
  const indexBadge = !overview
    ? null
    : overview.honesty.collection_is_live
      ? { label: "Live collection", className: "geo-badge geo-badge-positive" }
      : fixtureSample
        ? { label: "Fixture sample", className: "geo-badge geo-badge-warm" }
        : overview.kpis.chats > 0
          ? { label: "Collected sample", className: "geo-badge geo-badge-neutral" }
          : { label: "Awaiting collect", className: "geo-badge geo-badge-warm" };

  const mentionDelta = overview
    ? seriesDelta(overview.series, "mentions")
    : null;
  const citationDelta = overview
    ? seriesDelta(overview.series, "citations")
    : null;
  const citedDelta = overview
    ? seriesDelta(overview.series, "cited_pages")
    : null;
  const visDelta = overview
    ? seriesDelta(overview.series, "visibility")
    : null;

  const topCountries = (overview?.countries ?? []).slice(0, 4);
  const otherShare = (overview?.countries ?? [])
    .slice(4)
    .reduce((s, c) => s + c.share, 0);
  const countryRows =
    otherShare > 0
      ? [
          ...topCountries,
          {
            code: "Other",
            count: (overview?.countries ?? [])
              .slice(4)
              .reduce((s, c) => s + c.count, 0),
            share: otherShare,
          },
        ]
      : topCountries;

  const windowFrom = overview?.filters?.from ?? overview?.honesty.from;
  const windowTo = overview?.filters?.to ?? overview?.honesty.to;
  const ledeRank =
    brand?.rank != null
      ? ` Rank ${brand.rank}/${brand.of} among tracked brands.`
      : "";

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Visibility Overview</h1>
            {indexBadge ? (
              <span className={indexBadge.className}>{indexBadge.label}</span>
            ) : null}
          </div>
          <p className="geo-page-lede">
            How often AI platforms mention {brand ? brand.name : "your brand"}
            {projectDomain ? ` (${projectDomain})` : ""}.{ledeRank}
          </p>
        </div>
        <div className="geo-vis-actions">
          <ExportOverviewButton projectId={projectId} />
          <ShareOverviewButton projectId={projectId} />
          <Link
            href={`/${projectId}/prompts`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Run analysis
          </Link>
        </div>
      </header>

      {!overview && <ApiDownCallout noun="overview" />}

      {overview && showCollectionCallout ? (
        <div
          role="status"
          className="geo-callout geo-callout-warning"
          style={{ marginBottom: "var(--space-4)" }}
        >
          <span>{overview.honesty.note}</span>
        </div>
      ) : null}

      {overview && (
        <>
          <div className="geo-vis-kpis">
            <article className="geo-vis-kpi">
              <div className="geo-vis-kpi-head">
                <p className="geo-vis-kpi-label">Mentions</p>
                <DeltaChip value={mentionDelta} />
              </div>
              <p className="geo-vis-kpi-value">{fmt(overview.kpis.mentions)}</p>
              <p className="geo-vis-kpi-meta">
                Across {overview.kpis.chats} chats
              </p>
            </article>
            <article className="geo-vis-kpi">
              <div className="geo-vis-kpi-head">
                <p className="geo-vis-kpi-label">Citations</p>
                <DeltaChip value={citationDelta} />
              </div>
              <p className="geo-vis-kpi-value">
                {fmt(overview.kpis.citations)}
              </p>
              <p className="geo-vis-kpi-meta">Cited source rows</p>
            </article>
            <article className="geo-vis-kpi">
              <div className="geo-vis-kpi-head">
                <p className="geo-vis-kpi-label">Cited pages</p>
                <DeltaChip value={citedDelta} />
              </div>
              <p className="geo-vis-kpi-value">
                {fmt(overview.kpis.cited_pages)}
              </p>
              <p className="geo-vis-kpi-meta">Unique URLs</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Share of voice</p>
              <p className="geo-vis-kpi-value">
                {brand ? pct(brand.share_of_voice) : "—"}
              </p>
              <p className="geo-vis-kpi-meta">
                Sentiment{" "}
                {brand?.sentiment != null
                  ? Math.round(brand.sentiment)
                  : "—"}
              </p>
            </article>
          </div>

          <div className="geo-vis-grid-main">
            <section className="geo-panel geo-vis-panel geo-vis-score-card">
              <div className="geo-vis-panel-head">
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  AI Visibility Score
                </h2>
                {overview.score.sample_thin ||
                overview.honesty.score_sample_thin ? (
                  <span className="geo-badge geo-badge-warm">Limited sample</span>
                ) : visDelta != null ? (
                  <DeltaChip value={visDelta} suffix=" pts" />
                ) : (
                  <span
                    className={`geo-badge ${
                      overview.score.band === "high"
                        ? "geo-badge-positive"
                        : overview.score.band === "medium"
                          ? "geo-badge-neutral"
                          : "geo-badge-warm"
                    }`}
                  >
                    {overview.score.label}
                  </span>
                )}
              </div>
              <VisibilityGauge
                value={overview.score.value}
                label={overview.score.label}
                band={overview.score.band}
              />
              <p className="geo-vis-insight">{overview.score.insight}</p>
              {brand && (
                <div className="geo-vis-score-meta">
                  <span>
                    Position{" "}
                    <strong>
                      {brand.position != null
                        ? brand.position.toFixed(1)
                        : "—"}
                    </strong>
                  </span>
                  <span>
                    SoV <strong>{pct(brand.share_of_voice)}</strong>
                  </span>
                  <span>
                    Rank{" "}
                    <strong>
                      {brand.rank}/{brand.of}
                    </strong>
                  </span>
                </div>
              )}
            </section>

            <section className="geo-panel geo-vis-panel">
              <div className="geo-vis-panel-head">
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  Metrics trend
                </h2>
                <span
                  className={`geo-badge ${
                    overview.honesty.series_is_collected
                      ? "geo-badge-positive"
                      : "geo-badge-neutral"
                  }`}
                >
                  {overview.honesty.series_is_collected
                    ? "Collected"
                    : "Sparse history"}
                </span>
              </div>
              {chartSeries.length > 0 ? (
                <>
                  <TrendChart
                    series={chartSeries}
                    labels={chartLabels}
                    legendValue="sum"
                    ariaLabel="Mentions, citations, and cited pages over the selected range"
                  />
                  <p className="geo-vis-note">
                    {overview.series.length} day
                    {overview.series.length === 1 ? "" : "s"}
                    {windowFrom && windowTo
                      ? ` (${windowFrom} to ${windowTo})`
                      : ""}{" "}
                    from collected chats for {projectDomain || "this project"}.
                  </p>
                </>
              ) : (
                <EmptyBlock
                  title="No collected trend yet"
                  body="Enter a domain in the top bar and click Analyze to collect real AI answers for this brand."
                />
              )}
            </section>
          </div>

          <div className="geo-vis-grid-bottom">
            <section className="geo-panel geo-vis-panel">
              <div className="geo-vis-panel-head">
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  Distribution by LLM
                </h2>
                <span className="geo-badge geo-badge-neutral">Mentions</span>
              </div>
              {overview.channels.length > 0 ? (
                <ul className="geo-vis-bars">
                  {overview.channels.slice(0, 6).map((ch) => (
                    <li key={ch.channel_id}>
                      <div className="geo-vis-bar-meta">
                        <span className="geo-vis-bar-label">
                          <i
                            style={{ background: channelColor(ch.channel_id) }}
                            aria-hidden
                          />
                          {channelLabel(ch.channel_id, ch.label)}
                        </span>
                        <span className="mono">
                          {pct(ch.share, 1)} · {fmt(ch.mention_count)}
                        </span>
                      </div>
                      <div className="geo-vis-bar-track">
                        <span
                          style={{
                            width: `${Math.max(2, ch.share * 100)}%`,
                            background: channelColor(ch.channel_id),
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyBlock
                  title="No LLM mentions yet"
                  body="Run Analyze from the top bar to collect answers across models."
                />
              )}
            </section>

            <section className="geo-panel geo-vis-panel">
              <div className="geo-vis-panel-head">
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  Mentions by country
                </h2>
                <span className="geo-badge geo-badge-neutral">
                  Requested market
                </span>
              </div>
              {countryRows.length > 0 ? (
                <>
                  <div className="geo-vis-country-bar" aria-hidden>
                    {countryRows.map((c, i) => (
                      <span
                        key={c.code}
                        style={{
                          width: `${Math.max(1, c.share * 100)}%`,
                          background: COUNTRY_COLORS[i % COUNTRY_COLORS.length],
                        }}
                      />
                    ))}
                  </div>
                  <ul className="geo-vis-country-list">
                    {countryRows.map((c, i) => (
                      <li key={c.code}>
                        <i
                          style={{
                            background:
                              COUNTRY_COLORS[i % COUNTRY_COLORS.length],
                          }}
                        />
                        <span>{c.code}</span>
                        <strong>
                          {pct(c.share, 1)} · {fmt(c.count)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  <p className="geo-vis-note">{overview.honesty.note}</p>
                </>
              ) : (
                <EmptyBlock
                  title="No country mix yet"
                  body="Analyze a domain in the top bar to collect chats with a requested market."
                />
              )}
            </section>
          </div>

          <div className="geo-vis-grid-bottom">
            <section className="geo-panel geo-vis-panel">
              <div className="geo-vis-panel-head">
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  Who AI recommends
                </h2>
                <span className="geo-badge geo-badge-neutral">
                  Share of voice
                </span>
              </div>
              {overview.competitors.length > 0 ? (
                <RankBars
                  rows={overview.competitors.map((r) => ({
                    name: r.brand_name,
                    pct: (r.share_of_voice ?? r.visibility) * 100,
                    highlight: r.is_own,
                  }))}
                />
              ) : (
                <EmptyBlock
                  title="No competitor rankings yet"
                  body="Add competitors, then Analyze to see who AI recommends."
                />
              )}
            </section>

            <section className="geo-panel geo-vis-panel">
              <div className="geo-vis-panel-head">
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  Topics &amp; sources
                </h2>
                <Link
                  href={`/${projectId}/topics`}
                  className="geo-link-quiet"
                >
                  Manage
                </Link>
              </div>
              {overview.topics.length > 0 ? (
                <div className="geo-comp-table-wrap">
                  <table className="geo-comp-table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Prompts</th>
                        <th>Visibility</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {overview.topics.slice(0, 5).map((t) => (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.name}</strong>
                            {overview.honesty.topic_visibility_is_proxy && (
                              <small className="geo-pr-row-meta">
                                Proxy score
                              </small>
                            )}
                          </td>
                          <td>{t.prompt_count}</td>
                          <td>
                            {t.chats_eligible != null && t.chats_eligible < 8
                              ? t.chats_eligible === 0
                                ? "—"
                                : `${t.mention_estimate}/${t.chats_eligible}`
                              : pct(t.visibility)}
                          </td>
                          <td>
                            <Link
                              href={`/${projectId}/prompts`}
                              className="geo-btn geo-btn-ghost geo-btn-sm"
                            >
                              Monitor
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyBlock
                  title="No topics yet"
                  body="Add topics in Topics and tags, then Analyze to score them."
                />
              )}
              {overview.cited_domains.length > 0 ? (
                <p className="geo-vis-note">
                  Top cited:{" "}
                  {overview.cited_domains
                    .slice(0, 3)
                    .map((d) => d.domain)
                    .join(" · ")}
                </p>
              ) : null}
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
              {(actions?.rows?.length ?? 0) > 0 ? (
                <ul className="geo-list-plain">
                  {(actions?.rows ?? []).slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <Link href={`/${projectId}/actions/${a.id}`}>
                        <span style={{ fontWeight: 500 }}>{a.overview}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyBlock
                  title="No open actions"
                  body="Generate actions from the Actions page after you have collected chats."
                />
              )}
            </section>

            <section className="geo-panel geo-vis-panel">
              <h2 className="geo-section-title">
                Next steps
                <Link
                  href={`/${projectId}/competitors`}
                  className="geo-link-quiet"
                >
                  Competitors
                </Link>
              </h2>
              <div
                className="geo-vis-actions"
                style={{ flexDirection: "column", alignItems: "stretch" }}
              >
                <Link
                  href={`/${projectId}/discovery`}
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                >
                  Prompt Research
                </Link>
                <Link
                  href={`/${projectId}/sources/domains`}
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                >
                  Sources &amp; Citations
                </Link>
                <Link
                  href={`/${projectId}/perception`}
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                >
                  Perception &amp; Sentiment
                </Link>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
