"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

type Suggestion = { name: string; mention_count: number; source: string };

type BrandRow = {
  brand_id: string;
  brand_name: string;
  is_own?: boolean;
  visibility: number;
  share_of_voice: number;
  position: number | null;
  mention_count: number;
};

const GAP_PROMPTS = [
  {
    impact: "High impact",
    text: "Best CRM for early-stage venture-backed startups",
    rival: "HubSpot",
  },
  {
    impact: "High impact",
    text: "Flexible CRM with Slack sync for agencies",
    rival: "Salesforce",
  },
  {
    impact: "Medium impact",
    text: "Modern CRM with custom objects for B2B SaaS",
    rival: "Pipedrive",
  },
  {
    impact: "Medium impact",
    text: "Lightweight CRM alternatives to HubSpot",
    rival: "Close",
  },
];

export default function CompetitorsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sugRes, brandRes] = await Promise.all([
        fetch(`${API}/v1/projects/${projectId}/competitors/suggestions`, {
          credentials: "include",
        }),
        fetch(`${API}/v1/projects/${projectId}/reports/brands`, {
          credentials: "include",
        }),
      ]);
      if (!sugRes.ok) {
        setError("Failed to load competitor suggestions");
      } else {
        const data = (await sugRes.json()) as { rows: Suggestion[] };
        setSuggestions(data.rows);
      }
      if (brandRes.ok) {
        const data = (await brandRes.json()) as { rows: BrandRow[] };
        setBrands(data.rows ?? []);
      }
    } catch {
      setError(`API unreachable at ${API}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept(name: string) {
    await fetch(
      `${API}/v1/projects/${projectId}/competitors/suggestions/${encodeURIComponent(name)}/accept`,
      { method: "POST", credentials: "include" },
    );
    await load();
  }

  async function reject(name: string) {
    await fetch(
      `${API}/v1/projects/${projectId}/competitors/suggestions/${encodeURIComponent(name)}/reject`,
      { method: "POST", credentials: "include" },
    );
    await load();
  }

  const ranked = useMemo(
    () => [...brands].sort((a, b) => b.visibility - a.visibility),
    [brands],
  );
  const own = ranked.find((r) => r.is_own) ?? ranked[0];
  const ownRank = own
    ? ranked.findIndex((r) => r.brand_id === own.brand_id) + 1
    : null;
  const rivals = ranked.filter((r) => !r.is_own);
  const filtered = ranked.filter((r) =>
    r.brand_name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const avgSov =
    ranked.length > 0
      ? ranked.reduce((s, r) => s + r.share_of_voice, 0) / ranked.length
      : 0;

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Competitor Research</h1>
            <span className="geo-badge geo-badge-neutral">Market gap intel</span>
          </div>
          <p className="geo-page-lede">
            Who AI recommends when buyers ask questions in your category — and
            where you&apos;re missing.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/prompts`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Track prompts
          </Link>
          <a href="#suggestions" className="geo-btn geo-btn-primary geo-btn-sm">
            + Add competitor
          </a>
        </div>
      </header>

      {error && <p className="ob-error">{error}</p>}

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Category rank</p>
          <p className="geo-vis-kpi-value">
            {ownRank != null ? `#${ownRank}` : "—"}
          </p>
          <p className="geo-vis-kpi-meta">
            {own ? own.brand_name : "Your brand"} · {rivals.length} rivals tracked
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Your share of voice</p>
          <p className="geo-vis-kpi-value">
            {own ? `${Math.round(own.share_of_voice * 100)}%` : "—"}
          </p>
          <p className="geo-vis-kpi-meta">
            Category avg {Math.round(avgSov * 100)}%
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Monitored rivals</p>
          <p className="geo-vis-kpi-value">{rivals.length}</p>
          <p className="geo-vis-kpi-meta">
            {rivals
              .slice(0, 3)
              .map((r) => r.brand_name)
              .join(", ") || "Add competitors to compare"}
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Gap prompts</p>
          <p className="geo-vis-kpi-value">{suggestions.length || 42}</p>
          <p className="geo-vis-kpi-meta">
            Competitor cited · you absent (sample until prompt gaps API)
          </p>
        </article>
      </div>

      <div className="geo-vis-grid-main">
        <section className="geo-panel geo-vis-panel">
          <div className="geo-vis-panel-head">
            <h2 className="geo-section-title" style={{ margin: 0 }}>
              Competitor table
            </h2>
            <input
              className="geo-input"
              style={{ maxWidth: 220, minHeight: 34 }}
              placeholder="Search brands…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {filtered.length === 0 ? (
            <p className="geo-vis-note">No brand rankings yet. Run a collection.</p>
          ) : (
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Visibility</th>
                    <th>Share of voice</th>
                    <th>Avg position</th>
                    <th>Mentions</th>
                    <th>Gap vs you</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const gap =
                      own && !r.is_own
                        ? Math.round((r.visibility - own.visibility) * 100)
                        : 0;
                    return (
                      <tr
                        key={r.brand_id}
                        data-own={r.is_own ? "true" : "false"}
                      >
                        <td>
                          <strong>{r.brand_name}</strong>
                          {r.is_own && (
                            <span className="geo-badge geo-badge-positive">
                              You
                            </span>
                          )}
                        </td>
                        <td>{Math.round(r.visibility * 100)}%</td>
                        <td>{Math.round(r.share_of_voice * 100)}%</td>
                        <td>
                          {r.position != null ? r.position.toFixed(1) : "—"}
                        </td>
                        <td>{r.mention_count ?? "—"}</td>
                        <td>
                          {r.is_own
                            ? "—"
                            : gap > 0
                              ? `+${gap} pts`
                              : `${gap} pts`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="geo-panel geo-vis-panel">
          <div className="geo-vis-panel-head">
            <h2 className="geo-section-title" style={{ margin: 0 }}>
              Opportunity gaps
            </h2>
            <span className="geo-badge geo-badge-warm">
              {suggestions.length || GAP_PROMPTS.length} missed
            </span>
          </div>
          <ul className="geo-gap-list">
            {GAP_PROMPTS.map((g) => (
              <li key={g.text} className="geo-gap-card">
                <span
                  className={
                    g.impact.startsWith("High")
                      ? "geo-badge geo-badge-warm"
                      : "geo-badge geo-badge-neutral"
                  }
                >
                  {g.impact}
                </span>
                <p>{g.text}</p>
                <small>Cited competitor: {g.rival}</small>
                <Link
                  href={`/${projectId}/prompts`}
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                >
                  + Add to tracking
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section id="suggestions" className="geo-panel geo-vis-panel">
        <h2 className="geo-section-title">Suggested competitors to track</h2>
        <p className="geo-vis-note" style={{ marginTop: 0 }}>
          Brands mentioned in chats that you are not tracking yet.
        </p>
        {suggestions.length === 0 ? (
          <p className="geo-vis-note">No suggestions right now.</p>
        ) : (
          <div className="geo-comp-table-wrap">
            <table className="geo-comp-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Mentions</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {suggestions.map((r) => (
                  <tr key={r.name}>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{r.mention_count}</td>
                    <td>{r.source}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="geo-btn geo-btn-primary geo-btn-sm"
                          onClick={() => void accept(r.name)}
                        >
                          Track
                        </button>
                        <button
                          type="button"
                          className="geo-btn geo-btn-ghost geo-btn-sm"
                          onClick={() => void reject(r.name)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
