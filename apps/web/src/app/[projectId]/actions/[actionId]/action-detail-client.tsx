"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API_BASE = apiBase();

type ActionDetail = {
  id: string;
  rule_id: string;
  group: string;
  subtype: string;
  status: string;
  overview: string;
  why_this_matters: string;
  competitor_evidence: string;
  brief: string;
  steps: { id: string; text: string; done: boolean }[];
  expected_outcome: string;
  evidence: {
    kind: string;
    label: string;
    detail?: string;
    url?: string;
    metric?: number;
  }[];
  opportunity_score: number;
  relative_opportunity_score: number;
  impact_band: string;
  scope: { topic?: string; your_page?: string };
};

export function ActionDetailClient({
  projectId,
  actionId,
}: {
  projectId: string;
  actionId: string;
}) {
  const [action, setAction] = useState<ActionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/v1/projects/${projectId}/actions/${actionId}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setError("Action not found");
        return;
      }
      const body = (await res.json()) as { action: ActionDetail };
      setAction(body.action);
      setError(null);
    } catch {
      setError(`API unreachable at ${API_BASE}`);
    }
  }, [projectId, actionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(
    verb: "accept" | "decline" | "complete" | "cancel",
  ) {
    const res = await fetch(
      `${API_BASE}/v1/projects/${projectId}/actions/${actionId}/transition`,
      {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verb }),
      },
    );
    if (res.ok) await load();
  }

  async function toggleStep(stepId: string) {
    await fetch(
      `${API_BASE}/v1/projects/${projectId}/actions/${actionId}/steps/${stepId}/toggle`,
      { credentials: "include", method: "POST" },
    );
    await load();
  }

  if (error) return <p className="ob-error">{error}</p>;
  if (!action) return <p className="geo-vis-note">Loading…</p>;

  const doneSteps = action.steps.filter((s) => s.done).length;

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1 style={{ fontSize: "1.45rem", maxWidth: "40rem" }}>
              {action.overview}
            </h1>
            <span className="geo-badge geo-badge-warm">
              Score {action.opportunity_score.toFixed(2)}
            </span>
          </div>
          <p className="geo-page-lede">
            {action.rule_id} · {action.group} · {action.impact_band} ·{" "}
            {action.status}
            {action.scope.topic ? ` · ${action.scope.topic}` : ""}
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/actions`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Back to Actions
          </Link>
          <Link
            href={`/${projectId}/impact`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Impact
          </Link>
        </div>
      </header>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Opportunity</p>
          <p className="geo-vis-kpi-value">
            {action.opportunity_score.toFixed(2)}
          </p>
          <div className="geo-vis-bar-track" style={{ marginTop: 8 }}>
            <span
              style={{
                width: `${Math.min(100, action.opportunity_score * 100)}%`,
              }}
            />
          </div>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Status</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {action.status}
          </p>
          <p className="geo-vis-kpi-meta">{action.subtype}</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Steps done</p>
          <p className="geo-vis-kpi-value">
            {doneSteps}/{action.steps.length}
          </p>
          <p className="geo-vis-kpi-meta">Checklist progress</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Evidence</p>
          <p className="geo-vis-kpi-value">{action.evidence.length}</p>
          <p className="geo-vis-kpi-meta">Grounded rows</p>
        </article>
      </div>

      <div className="geo-vis-actions" style={{ marginBottom: "1rem" }}>
        {action.status === "new" && (
          <>
            <button
              type="button"
              className="geo-btn geo-btn-primary geo-btn-sm"
              onClick={() => void transition("accept")}
            >
              Accept
            </button>
            <button
              type="button"
              className="geo-btn geo-btn-ghost geo-btn-sm"
              onClick={() => void transition("decline")}
            >
              Decline
            </button>
          </>
        )}
        {action.status === "in_progress" && (
          <>
            <button
              type="button"
              className="geo-btn geo-btn-primary geo-btn-sm"
              onClick={() => void transition("complete")}
            >
              Mark done
            </button>
            <button
              type="button"
              className="geo-btn geo-btn-ghost geo-btn-sm"
              onClick={() => void transition("cancel")}
            >
              Cancel → New
            </button>
          </>
        )}
      </div>

      <div className="geo-pr-layout">
        <div style={{ display: "grid", gap: "1rem" }}>
          {(
            [
              ["Why this matters", action.why_this_matters],
              ["Competitor evidence", action.competitor_evidence],
              ["The brief", action.brief],
              ["Expected outcome", action.expected_outcome],
            ] as const
          ).map(([title, body]) => (
            <section key={title} className="geo-panel geo-vis-panel">
              <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                {title}
              </h2>
              <p style={{ margin: 0, lineHeight: 1.55 }}>{body}</p>
            </section>
          ))}

          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Implementation checklist
            </h2>
            <ul className="geo-gap-list">
              {action.steps.map((s) => (
                <li key={s.id} className="geo-gap-card">
                  <label
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() => void toggleStep(s.id)}
                    />
                    <span
                      style={{
                        textDecoration: s.done ? "line-through" : "none",
                        color: s.done ? "var(--muted)" : "var(--ink-strong)",
                        fontWeight: 600,
                      }}
                    >
                      {s.text}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Evidence rows
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Tied to specific rows — not generic SEO advice.
            </p>
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Label</th>
                    <th>Metric</th>
                  </tr>
                </thead>
                <tbody>
                  {action.evidence.map((e, i) => (
                    <tr key={i}>
                      <td>{e.kind}</td>
                      <td>
                        {e.url ? (
                          <a href={e.url}>{e.label}</a>
                        ) : (
                          e.label
                        )}
                        {e.detail && (
                          <small className="geo-pr-row-meta">{e.detail}</small>
                        )}
                      </td>
                      <td>{e.metric ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
