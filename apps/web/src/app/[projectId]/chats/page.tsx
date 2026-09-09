"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

type ChatRow = {
  id: string;
  run_date: string;
  status: string;
  country_code: string;
  model_channel_id: string;
  prompt_text: string | null;
  mention_count: number;
  text: string;
};

export default function ChatsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/v1/projects/${projectId}/chats?limit=100`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setError("Failed to load chats");
        return;
      }
      const data = (await res.json()) as { rows: ChatRow[]; total: number };
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      setError(`API unreachable at ${API}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.prompt_text ?? "").toLowerCase().includes(q) ||
        r.model_channel_id.toLowerCase().includes(q) ||
        r.country_code.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const mentions = rows.reduce((s, r) => s + (r.mention_count || 0), 0);
  const models = new Set(rows.map((r) => r.model_channel_id)).size;
  const countries = new Set(rows.map((r) => r.country_code)).size;

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Chats</h1>
            <span className="geo-badge geo-badge-neutral">
              Atomic measurements
            </span>
          </div>
          <p className="geo-page-lede">
            One prompt × channel × country × day — {total} total in project.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/prompts`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Prompt Tracking
          </Link>
          <Link
            href={`/${projectId}/fanouts`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Fanouts
          </Link>
        </div>
      </header>

      {error && <p className="ob-error">{error}</p>}

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Loaded chats</p>
          <p className="geo-vis-kpi-value">{rows.length}</p>
          <p className="geo-vis-kpi-meta">{total} total in project</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Mentions</p>
          <p className="geo-vis-kpi-value">{mentions}</p>
          <p className="geo-vis-kpi-meta">In loaded window</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Models</p>
          <p className="geo-vis-kpi-value">{models || "—"}</p>
          <p className="geo-vis-kpi-meta">Distinct channels</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Countries</p>
          <p className="geo-vis-kpi-value">{countries || "—"}</p>
          <p className="geo-vis-kpi-meta">In loaded window</p>
        </article>
      </div>

      <section className="geo-panel geo-vis-panel">
        <div className="geo-pr-toolbar">
          <input
            className="geo-input"
            placeholder="Search prompt, model, country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 320, minHeight: 34 }}
          />
        </div>
        <div className="geo-comp-table-wrap">
          <table className="geo-comp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Prompt</th>
                <th>Model</th>
                <th>Country</th>
                <th>Mentions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/${projectId}/chats/${r.id}`}>{r.run_date}</Link>
                  </td>
                  <td>
                    <Link href={`/${projectId}/chats/${r.id}`}>
                      <strong>{r.prompt_text ?? "—"}</strong>
                    </Link>
                  </td>
                  <td className="mono">{r.model_channel_id}</td>
                  <td>{r.country_code}</td>
                  <td>{r.mention_count}</td>
                  <td>
                    <span className="geo-badge geo-badge-neutral">{r.status}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <p className="geo-vis-note">No chats match.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
