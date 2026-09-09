"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

type DomainRow = {
  domain: string;
  classification: string;
  retrieved_percentage: number;
  retrieval_rate: number;
  citation_rate: number;
  total_citations: number;
  citation_share: number;
  gap_score_normalized: number;
  own_brand_mentioned: boolean;
  bookmarked?: boolean;
  classification_overridden?: boolean;
};

const CLASSES = [
  "OWN",
  "COMPETITOR",
  "EDITORIAL",
  "UGC",
  "REFERENCE",
  "CORPORATE",
  "OTHER",
];

type ClassFilter = "all" | "OWN" | "COMPETITOR" | "other" | "cited";

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function DomainsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [showGaps, setShowGaps] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/v1/projects/${projectId}/reports/domains`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setError("Failed to load domains");
        return;
      }
      const data = (await res.json()) as { rows: DomainRow[] };
      setRows(data.rows);
    } catch {
      setError(`API unreachable at ${API}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    let list = rows;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.domain.toLowerCase().includes(q));
    if (bookmarkedOnly) list = list.filter((r) => r.bookmarked);
    if (classFilter === "OWN") {
      list = list.filter((r) => r.classification === "OWN");
    } else if (classFilter === "COMPETITOR") {
      list = list.filter((r) => r.classification === "COMPETITOR");
    } else if (classFilter === "other") {
      list = list.filter(
        (r) => r.classification !== "OWN" && r.classification !== "COMPETITOR",
      );
    } else if (classFilter === "cited") {
      list = list.filter((r) => r.total_citations > 0);
    }
    if (showGaps) {
      list = list
        .filter((r) => !r.own_brand_mentioned && r.gap_score_normalized > 0)
        .sort((a, b) => b.gap_score_normalized - a.gap_score_normalized);
    }
    return list;
  }, [rows, query, showGaps, bookmarkedOnly, classFilter]);

  async function setClass(domain: string, classification: string) {
    await fetch(
      `${API}/v1/projects/${projectId}/sources/domains/${encodeURIComponent(domain)}/classification`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification }),
      },
    );
    await load();
  }

  async function toggleBookmark(domain: string) {
    await fetch(`${API}/v1/projects/${projectId}/sources/bookmarks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: domain }),
    });
    await load();
  }

  const avgCite =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.citation_rate, 0) / rows.length
      : 0;
  const ownShare = rows
    .filter((r) => r.classification === "OWN")
    .reduce((s, r) => s + r.citation_share, 0);
  const gapCount = rows.filter(
    (r) => !r.own_brand_mentioned && r.gap_score_normalized > 0,
  ).length;
  const topCited = [...rows]
    .sort((a, b) => b.citation_share - a.citation_share)
    .slice(0, 5);

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Sources &amp; Citations</h1>
            <span className="geo-badge geo-badge-neutral">Domains</span>
          </div>
          <p className="geo-page-lede">
            Domains AI retrieves and cites when answering buyer questions.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/sources/gaps`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Gap analysis
          </Link>
          <Link
            href={`/${projectId}/sources/urls`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            URL detail
          </Link>
        </div>
      </header>

      {error && <p className="ob-error">{error}</p>}

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Domains retrieved</p>
          <p className="geo-vis-kpi-value">{rows.length}</p>
          <p className="geo-vis-kpi-meta">{visible.length} shown after filters</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Avg citation rate</p>
          <p className="geo-vis-kpi-value">{avgCite.toFixed(2)}</p>
          <p className="geo-vis-kpi-meta">Across all domains in report</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Own-domain share</p>
          <p className="geo-vis-kpi-value">{pct(ownShare)}</p>
          <p className="geo-vis-kpi-meta">Citation share classified OWN</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Gap domains</p>
          <p className="geo-vis-kpi-value">{gapCount}</p>
          <p className="geo-vis-kpi-meta">Cited without your brand</p>
        </article>
      </div>

      <div className="geo-pr-layout">
        <section className="geo-panel geo-vis-panel">
          <div className="geo-pr-toolbar">
            <input
              className="geo-input"
              placeholder="Search domains…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: 240, minHeight: 34 }}
            />
            <div className="geo-pr-chips" style={{ marginBottom: 0 }}>
              {(
                [
                  ["all", "All"],
                  ["OWN", "Own"],
                  ["COMPETITOR", "Competitor"],
                  ["other", "Other"],
                  ["cited", "Cited"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    classFilter === id
                      ? "geo-pr-chip geo-pr-chip-on"
                      : "geo-pr-chip"
                  }
                  onClick={() => setClassFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="geo-src-check">
              <input
                type="checkbox"
                checked={showGaps}
                onChange={(e) => setShowGaps(e.target.checked)}
              />
              Gaps only
            </label>
            <label className="geo-src-check">
              <input
                type="checkbox"
                checked={bookmarkedOnly}
                onChange={(e) => setBookmarkedOnly(e.target.checked)}
              />
              Bookmarked
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="geo-vis-note">No domains match these filters.</p>
          ) : (
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table">
                <thead>
                  <tr>
                    <th />
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Retrieved %</th>
                    <th>Citations</th>
                    <th>Citation share</th>
                    <th>Citation rate</th>
                    {showGaps && <th>Gap</th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr
                      key={r.domain}
                      data-own={r.classification === "OWN" ? "true" : "false"}
                    >
                      <td>
                        <button
                          type="button"
                          className="geo-btn geo-btn-ghost geo-btn-sm"
                          onClick={() => void toggleBookmark(r.domain)}
                          aria-pressed={r.bookmarked ? "true" : "false"}
                        >
                          {r.bookmarked ? "Pinned" : "Pin"}
                        </button>
                      </td>
                      <td>
                        <strong>{r.domain}</strong>
                      </td>
                      <td>
                        <select
                          className="geo-input geo-pr-select"
                          value={r.classification}
                          onChange={(e) =>
                            void setClass(r.domain, e.target.value)
                          }
                          aria-label={`Classify ${r.domain}`}
                        >
                          {CLASSES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                              {c === "OWN" ? " (You)" : ""}
                              {c === "COMPETITOR" ? " (Competitor)" : ""}
                            </option>
                          ))}
                        </select>
                        {r.classification_overridden ? " *" : ""}
                      </td>
                      <td>{pct(r.retrieved_percentage)}</td>
                      <td>{r.total_citations}</td>
                      <td>{pct(r.citation_share)}</td>
                      <td>{r.citation_rate.toFixed(2)}</td>
                      {showGaps && (
                        <td>{r.gap_score_normalized.toFixed(0)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Top cited domains
            </h2>
            <ul className="geo-pr-cov-list">
              {topCited.map((r) => (
                <li key={r.domain}>
                  <div className="geo-vis-bar-meta">
                    <span>{r.domain}</span>
                    <span className="mono">{pct(r.citation_share)}</span>
                  </div>
                  <div className="geo-vis-bar-track">
                    <span
                      style={{
                        width: `${Math.min(100, r.citation_share * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Related
            </h2>
            <div className="geo-vis-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <Link
                href={`/${projectId}/sources`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Sources overview
              </Link>
              <Link
                href={`/${projectId}/sources/gaps`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Citation gaps
              </Link>
              <Link
                href={`/${projectId}/actions`}
                className="geo-btn geo-btn-primary geo-btn-sm"
              >
                Create actions
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
