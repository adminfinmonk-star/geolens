"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiDownCallout } from "@/components/api-down-callout";

const API_BASE = apiBase();

type ActionRow = {
  id: string;
  rule_id: string;
  group: string;
  subtype: string;
  status: string;
  overview: string;
  opportunity_score: number;
  relative_opportunity_score: number;
  impact_band: string;
  evidence: unknown[];
};

function statusBadge(status: string) {
  if (status === "done") return "geo-badge geo-badge-positive";
  if (status === "in_progress") return "geo-badge geo-badge-warm";
  if (status === "declined") return "geo-badge geo-badge-neutral";
  return "geo-badge geo-badge-positive";
}

export function ActionsClient({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("all");
  const [group, setGroup] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (status !== "all") q.set("status", status);
      if (group) q.set("group", group);
      const res = await fetch(
        `${API_BASE}/v1/projects/${projectId}/actions?${q}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setUnreachable(true);
        setMsg(null);
        return;
      }
      const body = (await res.json()) as {
        rows: ActionRow[];
        counts: { SITE_AUDIT: number; OWNED: number; EARNED: number };
      };
      setRows(body.rows);
      setCounts({
        SITE_AUDIT: body.counts.SITE_AUDIT,
        OWNED: body.counts.OWNED,
        EARNED: body.counts.EARNED,
      });
      setUnreachable(false);
      setMsg(null);
    } catch {
      setUnreachable(true);
      setMsg(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, status, group]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setMsg("Generating…");
    try {
      const res = await fetch(
        `${API_BASE}/v1/projects/${projectId}/actions/generate`,
        {
          credentials: "include",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true }),
        },
      );
      const body = (await res.json()) as {
        count: number;
        regenerated: boolean;
        cooldown_ms: number;
      };
      if (!body.regenerated) {
        setMsg(`Cooldown: wait ${Math.ceil(body.cooldown_ms / 1000)}s`);
      } else {
        setMsg(`Generated ${body.count} actions`);
      }
      await load();
    } catch {
      setMsg("Generate failed");
    }
  }

  const kpis = useMemo(() => {
    const open = rows.filter((r) => r.status === "new").length;
    const progress = rows.filter((r) => r.status === "in_progress").length;
    const done = rows.filter((r) => r.status === "done").length;
    const high = rows.filter((r) => r.opportunity_score >= 0.7).length;
    return { open, progress, done, high };
  }, [rows]);

  return (
    <>
      {unreachable ? <ApiDownCallout noun="actions" /> : null}
      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Open (new)</p>
          <p className="geo-vis-kpi-value">{loading ? "—" : kpis.open}</p>
          <p className="geo-vis-kpi-meta">{rows.length} in current filter</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">High opportunity</p>
          <p className="geo-vis-kpi-value">{loading ? "—" : kpis.high}</p>
          <p className="geo-vis-kpi-meta">Score ≥ 0.70</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">In progress</p>
          <p className="geo-vis-kpi-value">{loading ? "—" : kpis.progress}</p>
          <p className="geo-vis-kpi-meta">Actively being worked</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Completed</p>
          <p className="geo-vis-kpi-value">{loading ? "—" : kpis.done}</p>
          <p className="geo-vis-kpi-meta">
            Site {counts.SITE_AUDIT ?? 0} · Owned {counts.OWNED ?? 0} · Earned{" "}
            {counts.EARNED ?? 0}
          </p>
        </article>
      </div>

      <section className="geo-panel geo-vis-panel">
        <div className="geo-pr-toolbar">
          <button
            type="button"
            className="geo-btn geo-btn-primary geo-btn-sm"
            onClick={() => void generate()}
          >
            Generate actions
          </button>
          <select
            className="geo-input geo-pr-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status filter"
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
            <option value="declined">Declined</option>
          </select>
          <select
            className="geo-input geo-pr-select"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            aria-label="Group filter"
          >
            <option value="">All groups</option>
            <option value="SITE_AUDIT">
              Site audit ({counts.SITE_AUDIT ?? 0})
            </option>
            <option value="OWNED">Owned ({counts.OWNED ?? 0})</option>
            <option value="EARNED">Earned ({counts.EARNED ?? 0})</option>
          </select>
          <Link
            href={`/${projectId}/impact`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Impact →
          </Link>
        </div>

        {msg && <p className="geo-vis-note">{msg}</p>}
        {loading && <p className="geo-vis-note">Loading…</p>}

        {!loading && (
          <div className="geo-comp-table-wrap">
            <table className="geo-comp-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Rule</th>
                  <th>Group</th>
                  <th>Opportunity</th>
                  <th>Status</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/${projectId}/actions/${r.id}`}>
                        <strong>{r.overview}</strong>
                      </Link>
                      <small className="geo-pr-row-meta">
                        {r.subtype} · {r.impact_band}
                      </small>
                    </td>
                    <td className="mono">{r.rule_id}</td>
                    <td>
                      <span className="geo-badge geo-badge-neutral">
                        {r.group}
                      </span>
                    </td>
                    <td>
                      <div className="geo-pt-vis">
                        <div className="geo-vis-bar-track">
                          <span
                            style={{
                              width: `${Math.min(100, r.opportunity_score * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="mono">
                          {r.opportunity_score.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={statusBadge(r.status)}>{r.status}</span>
                    </td>
                    <td>{r.evidence.length}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <p className="geo-vis-note">
                        No actions yet — click Generate actions.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
