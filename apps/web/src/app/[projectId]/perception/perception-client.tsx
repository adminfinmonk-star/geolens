"use client";

import { apiBase } from "@/lib/api";
import { useEffect, useState } from "react";

const API_BASE = apiBase();

type Market = {
  snapshot_note: string;
  cards_note: string;
  run?: { finished_at: string; next_run_at: string; industry: string };
  summary: {
    headline: string;
    most_associated: { label: string; score: number } | null;
    best_vs_competitors: {
      label: string;
      own_rank: number;
      brands_carrying: number;
    } | null;
    biggest_gap: {
      label: string;
      statement: string;
      market_rank: number | null;
    } | null;
    strongest_competitor: { brand: string; mean_prominence: number } | null;
  };
  attributes: {
    label: string;
    association: number;
    market_prominence: number;
    market_rank: number | null;
    brands_carrying: number;
  }[];
};

type Objection = {
  label: string;
  score: number;
  member_count: number;
  phrasings: string[];
};

export function PerceptionClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Market | null>(null);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [m, o] = await Promise.all([
          fetch(`${API_BASE}/v1/projects/${projectId}/perception/market`, {
            credentials: "include",
          }),
          fetch(`${API_BASE}/v1/projects/${projectId}/perception/objections`, {
            credentials: "include",
          }),
        ]);
        if (!m.ok) {
          setError("Failed to load perception");
          return;
        }
        setData(await m.json());
        if (o.ok) {
          const body = (await o.json()) as { rows: Objection[] };
          setObjections(body.rows);
        }
      } catch {
        setError(`API unreachable at ${API_BASE}`);
      }
    })();
  }, [projectId]);

  if (error) return <p className="ob-error">{error}</p>;
  if (!data) return <p className="geo-vis-note">Loading…</p>;

  const gap = data.summary.biggest_gap;
  const topAttrs = [...data.attributes]
    .sort((a, b) => b.association - a.association)
    .slice(0, 6);

  return (
    <>
      <p className="geo-vis-note" style={{ marginTop: 0 }}>
        {data.snapshot_note}
        {data.run
          ? ` · Last run ${new Date(data.run.finished_at).toLocaleString()} · next ${new Date(data.run.next_run_at).toLocaleDateString()} · ${data.run.industry}`
          : ""}
      </p>

      <p className="geo-perc-headline">{data.summary.headline}</p>
      <p className="geo-vis-note">{data.cards_note}</p>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Most associated</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.2rem" }}>
            {data.summary.most_associated?.label ?? "—"}
          </p>
          <p className="geo-vis-kpi-meta">
            {data.summary.most_associated
              ? `Score ${data.summary.most_associated.score.toFixed(0)}`
              : "No association yet"}
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Best vs competitors</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.2rem" }}>
            {data.summary.best_vs_competitors?.label ?? "—"}
          </p>
          <p className="geo-vis-kpi-meta">
            {data.summary.best_vs_competitors
              ? `#${data.summary.best_vs_competitors.own_rank} of ${data.summary.best_vs_competitors.brands_carrying}`
              : "—"}
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Biggest gap</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.2rem" }}>
            {gap?.label ?? "—"}
          </p>
          <p className="geo-vis-kpi-meta">{gap?.statement ?? "No gap flagged"}</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Risk themes</p>
          <p className="geo-vis-kpi-value">{objections.length}</p>
          <p className="geo-vis-kpi-meta">
            Strongest rival:{" "}
            {data.summary.strongest_competitor?.brand ?? "—"}
          </p>
        </article>
      </div>

      <div className="geo-pr-layout">
        <section className="geo-panel geo-vis-panel">
          <div className="geo-vis-panel-head">
            <h2 className="geo-section-title" style={{ margin: 0 }}>
              Attribute association
            </h2>
          </div>
          <ul className="geo-perc-attrs">
            {topAttrs.map((a) => (
              <li key={a.label}>
                <div className="geo-vis-bar-meta">
                  <span>{a.label}</span>
                  <span className="mono">{a.association.toFixed(0)}</span>
                </div>
                <div className="geo-vis-bar-track">
                  <span
                    style={{
                      width: `${Math.min(100, a.association)}%`,
                    }}
                  />
                </div>
                <small className="geo-pr-row-meta">
                  Market {a.market_prominence.toFixed(0)}
                  {a.market_rank != null ? ` · your rank #${a.market_rank}` : ""}
                </small>
              </li>
            ))}
          </ul>

          <div className="geo-comp-table-wrap" style={{ marginTop: "1rem" }}>
            <table className="geo-comp-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>Association</th>
                  <th>Market prominence</th>
                  <th>Your rank</th>
                </tr>
              </thead>
              <tbody>
                {data.attributes.map((a) => (
                  <tr key={a.label}>
                    <td>
                      <strong>{a.label}</strong>
                    </td>
                    <td>{a.association.toFixed(0)}</td>
                    <td>{a.market_prominence.toFixed(0)}</td>
                    <td>
                      {a.market_rank == null ? "—" : `#${a.market_rank}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Objections &amp; risk themes
            </h2>
            {objections.length === 0 ? (
              <p className="geo-vis-note">No objections clustered yet.</p>
            ) : (
              <ul className="geo-gap-list">
                {objections.map((o) => (
                  <li key={o.label} className="geo-gap-card">
                    <span className="geo-badge geo-badge-warm">
                      score {o.score}
                    </span>
                    <p>{o.label}</p>
                    <small>
                      {o.member_count} phrasings · {o.phrasings.join(" · ")}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
