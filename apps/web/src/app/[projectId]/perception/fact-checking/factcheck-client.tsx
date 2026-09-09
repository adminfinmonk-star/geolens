"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = apiBase();

type Fc = {
  honesty: string;
  contradicted: {
    verdict: string;
    claim: { statement: string; category: string; chat_id: string };
    fact?: { statement: string };
    fact_statement_at_verdict: string;
  }[];
  by_fact: {
    fact: { statement: string };
    verdicts: number;
    contradicted: number;
    never_comes_up: boolean;
  }[];
  by_category: {
    category: string;
    claims: number;
    chats: number;
    contradicted_share: number;
  }[];
  claims_total: number;
};

export function FactcheckClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Fc | null>(null);
  const [tab, setTab] = useState<"contradicted" | "by_fact" | "by_category">(
    "contradicted",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/v1/projects/${projectId}/perception/factcheck`,
          { credentials: "include" },
        );
        if (!res.ok) {
          setError("Failed to load");
          return;
        }
        setData(await res.json());
      } catch {
        setError(`API unreachable at ${API_BASE}`);
      }
    })();
  }, [projectId]);

  if (error) return <p className="ob-error">{error}</p>;
  if (!data) return <p className="geo-vis-note">Loading fact checks…</p>;

  const contradicted = data.contradicted.length;
  const facts = data.by_fact.length;
  const supportedish = Math.max(0, data.claims_total - contradicted);

  return (
    <>
      <p className="geo-vis-note" style={{ marginTop: 0 }}>
        {data.honesty}
      </p>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Claims reviewed</p>
          <p className="geo-vis-kpi-value">{data.claims_total}</p>
          <p className="geo-vis-kpi-meta">Extracted from AI chats</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Contradictions</p>
          <p className="geo-vis-kpi-value">{contradicted}</p>
          <p className="geo-vis-kpi-meta">Conflicts with asserted facts</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Non-contradicted</p>
          <p className="geo-vis-kpi-value">{supportedish}</p>
          <p className="geo-vis-kpi-meta">Supported or unverified pool</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Asserted facts</p>
          <p className="geo-vis-kpi-value">{facts}</p>
          <p className="geo-vis-kpi-meta">{data.by_category.length} categories</p>
        </article>
      </div>

      <div className="geo-pr-chips" role="tablist" aria-label="Fact-check views">
        {(
          [
            ["contradicted", "Contradicted"],
            ["by_fact", "By fact"],
            ["by_category", "By category"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "geo-pr-chip geo-pr-chip-on" : "geo-pr-chip"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "contradicted" && (
        <ul className="geo-gap-list">
          {data.contradicted.map((c, i) => (
            <li key={i} className="geo-gap-card geo-panel">
              <div className="geo-vis-actions" style={{ justifyContent: "flex-start" }}>
                <span className="geo-badge geo-badge-warm">Contradicted</span>
                <span className="geo-badge geo-badge-neutral">
                  {c.claim.category}
                </span>
              </div>
              <p>{c.claim.statement}</p>
              <small>Your fact · {c.fact_statement_at_verdict}</small>
              {c.claim.chat_id && (
                <Link
                  href={`/${projectId}/chats/${c.claim.chat_id}`}
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                >
                  Open chat
                </Link>
              )}
            </li>
          ))}
          {data.contradicted.length === 0 && (
            <li className="geo-vis-note">
              No contradicted claims yet ({data.claims_total} claims extracted).
            </li>
          )}
        </ul>
      )}

      {tab === "by_fact" && (
        <div className="geo-comp-table-wrap">
          <table className="geo-comp-table">
            <thead>
              <tr>
                <th>Asserted fact</th>
                <th>Verdicts</th>
                <th>Contradicted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.by_fact.map((r, i) => (
                <tr key={i}>
                  <td>
                    <strong>{r.fact.statement}</strong>
                  </td>
                  <td>{r.verdicts}</td>
                  <td>{r.contradicted}</td>
                  <td>
                    <span
                      className={
                        r.never_comes_up
                          ? "geo-badge geo-badge-neutral"
                          : "geo-badge geo-badge-positive"
                      }
                    >
                      {r.never_comes_up ? "Never comes up" : "Checked"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "by_category" && (
        <ul className="geo-perc-attrs">
          {data.by_category.map((r) => (
            <li key={r.category} className="geo-panel geo-vis-panel">
              <div className="geo-vis-bar-meta">
                <strong style={{ textTransform: "capitalize" }}>
                  {r.category}
                </strong>
                <span className="mono">
                  {(r.contradicted_share * 100).toFixed(0)}% contradicted
                </span>
              </div>
              <div className="geo-vis-bar-track">
                <span
                  style={{
                    width: `${Math.min(100, r.contradicted_share * 100)}%`,
                    background: "var(--warm)",
                  }}
                />
              </div>
              <small className="geo-pr-row-meta">
                {r.claims} claims · {r.chats} chats
              </small>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
