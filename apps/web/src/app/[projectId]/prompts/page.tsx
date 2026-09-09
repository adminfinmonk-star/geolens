"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

type Prompt = {
  id: string;
  text: string;
  country_code: string;
  status: string;
};

type StatusFilter = "all" | "active" | "paused" | "archived";

function demoVisibility(id: string, status: string): number {
  if (status === "paused" || status === "archived") return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return 35 + (h % 55);
}

function demoPosition(id: string, status: string): number | null {
  if (status !== "active") return null;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) % 100;
  return 1 + (h % 40) / 10;
}

function statusBadge(status: string) {
  if (status === "active") return "geo-badge geo-badge-positive";
  if (status === "paused") return "geo-badge geo-badge-warm";
  return "geo-badge geo-badge-neutral";
}

export default function PromptsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [rows, setRows] = useState<Prompt[]>([]);
  const [text, setText] = useState("");
  const [country, setCountry] = useState("US");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/v1/projects/${projectId}/prompts`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Failed to load prompts");
        return;
      }
      const data = (await res.json()) as { rows: Prompt[] };
      setRows(data.rows);
    } catch {
      setError(`API unreachable at ${API}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API}/v1/projects/${projectId}/prompts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, country_code: country }),
    });
    if (!res.ok) {
      setError("Could not create prompt");
      return;
    }
    setText("");
    setShowAdd(false);
    await load();
  }

  async function setStatus(id: string, status: string) {
    await fetch(`${API}/v1/projects/${projectId}/prompts/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function saveText(id: string, next: string) {
    await fetch(`${API}/v1/projects/${projectId}/prompts/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: next }),
    });
    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !p.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, statusFilter]);

  const active = rows.filter((p) => p.status === "active");
  const avgVis =
    active.length > 0
      ? Math.round(
          active.reduce((s, p) => s + demoVisibility(p.id, p.status), 0) /
            active.length,
        )
      : 0;
  const avgPos =
    active.length > 0
      ? (
          active.reduce(
            (s, p) => s + (demoPosition(p.id, p.status) ?? 0),
            0,
          ) / active.length
        ).toFixed(1)
      : "—";

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Prompt Tracking</h1>
            <span className="geo-badge geo-badge-positive">Live radar</span>
          </div>
          <p className="geo-page-lede">
            Prompts you monitor across ChatGPT, Perplexity, Gemini, and AI
            Overviews.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/discovery`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Prompt Research
          </Link>
          <button
            type="button"
            className="geo-btn geo-btn-primary geo-btn-sm"
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? "Cancel" : "+ Add tracked prompt"}
          </button>
        </div>
      </header>

      {error && <p className="ob-error">{error}</p>}

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Tracked prompts</p>
          <p className="geo-vis-kpi-value">{rows.length}</p>
          <p className="geo-vis-kpi-meta">
            {active.length} active ·{" "}
            {rows.filter((p) => p.status === "paused").length} paused
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Visibility hit rate</p>
          <p className="geo-vis-kpi-value">{active.length ? `${avgVis}%` : "—"}</p>
          <p className="geo-vis-kpi-meta">
            Illustrative until per-prompt metrics API
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Avg recommendation pos</p>
          <p className="geo-vis-kpi-value">
            {avgPos === "—" ? "—" : `#${avgPos}`}
          </p>
          <p className="geo-vis-kpi-meta">Across active tracked prompts</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Countries covered</p>
          <p className="geo-vis-kpi-value">
            {new Set(rows.map((r) => r.country_code)).size || "—"}
          </p>
          <p className="geo-vis-kpi-meta">From your prompt list</p>
        </article>
      </div>

      {showAdd && (
        <form onSubmit={onCreate} className="geo-panel geo-vis-panel geo-pt-add">
          <h2 className="geo-section-title" style={{ marginTop: 0 }}>
            Add tracked prompt
          </h2>
          <textarea
            className="geo-input"
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. best CRM for a 20-person agency"
            rows={3}
          />
          <div className="geo-pt-add-row">
            <select
              className="geo-input geo-pr-select"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="Country"
            >
              {["US", "GB", "DE", "IN", "AU"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" className="geo-btn geo-btn-primary geo-btn-sm">
              Add prompt
            </button>
          </div>
        </form>
      )}

      <section className="geo-panel geo-vis-panel">
        <div className="geo-pr-toolbar">
          <input
            className="geo-input"
            placeholder="Search tracked prompts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 280, minHeight: 34 }}
          />
          <div className="geo-pr-chips" style={{ marginBottom: 0 }}>
            {(
              [
                ["all", "All"],
                ["active", "Active / visible"],
                ["paused", "Paused"],
                ["archived", "Archived"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={
                  statusFilter === id
                    ? "geo-pr-chip geo-pr-chip-on"
                    : "geo-pr-chip"
                }
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="geo-vis-note">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="geo-pt-empty">
            <p className="geo-vis-note" style={{ margin: 0 }}>
              No prompts match. Discover more in Prompt Research, or add one
              above.
            </p>
            <Link
              href={`/${projectId}/discovery`}
              className="geo-btn geo-btn-primary geo-btn-sm"
            >
              Open Prompt Research
            </Link>
          </div>
        ) : (
          <div className="geo-comp-table-wrap">
            <table className="geo-comp-table geo-pr-table">
              <thead>
                <tr>
                  <th>Tracked prompt</th>
                  <th>Market</th>
                  <th>Visibility</th>
                  <th>Avg pos</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <PromptRow
                    key={p.id}
                    prompt={p}
                    projectId={projectId}
                    visibility={demoVisibility(p.id, p.status)}
                    position={demoPosition(p.id, p.status)}
                    onArchive={() => void setStatus(p.id, "archived")}
                    onActivate={() => void setStatus(p.id, "active")}
                    onPause={() => void setStatus(p.id, "paused")}
                    onSave={(t) => void saveText(p.id, t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="geo-pt-cta geo-panel">
        <div>
          <strong>Need more coverage?</strong>
          <p className="geo-vis-note" style={{ margin: "0.25rem 0 0" }}>
            Discover high-intent buyer questions, then activate them here for
            daily tracking.
          </p>
        </div>
        <Link
          href={`/${projectId}/discovery`}
          className="geo-btn geo-btn-primary geo-btn-sm"
        >
          Open Prompt Research
        </Link>
      </aside>
    </div>
  );
}

function PromptRow({
  prompt,
  projectId,
  visibility,
  position,
  onArchive,
  onActivate,
  onPause,
  onSave,
}: {
  prompt: Prompt;
  projectId: string;
  visibility: number;
  position: number | null;
  onArchive: () => void;
  onActivate: () => void;
  onPause: () => void;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prompt.text);
  const gap = prompt.status === "active" && visibility < 20;

  return (
    <tr data-gap={gap ? "true" : "false"}>
      <td>
        {editing ? (
          <div className="geo-pt-edit">
            <textarea
              className="geo-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
            />
            <div className="geo-vis-actions">
              <button
                type="button"
                className="geo-btn geo-btn-primary geo-btn-sm"
                onClick={() => {
                  onSave(draft);
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="geo-btn geo-btn-ghost geo-btn-sm"
                onClick={() => {
                  setDraft(prompt.text);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <strong>{prompt.text}</strong>
            <small className="geo-pr-row-meta">{prompt.id}</small>
          </>
        )}
      </td>
      <td>{prompt.country_code}</td>
      <td>
        <div className="geo-pt-vis">
          <div className="geo-vis-bar-track">
            <span style={{ width: `${visibility}%` }} />
          </div>
          <span className="mono">{visibility}%</span>
        </div>
      </td>
      <td>{position != null ? position.toFixed(1) : "—"}</td>
      <td>
        <span className={statusBadge(prompt.status)}>{prompt.status}</span>
      </td>
      <td>
        <div className="geo-pt-actions">
          <Link
            href={`/${projectId}/chats`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Chats
          </Link>
          {!editing && (
            <button
              type="button"
              className="geo-btn geo-btn-ghost geo-btn-sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
          {prompt.status !== "active" && (
            <button
              type="button"
              className="geo-btn geo-btn-ghost geo-btn-sm"
              onClick={onActivate}
            >
              Activate
            </button>
          )}
          {prompt.status === "active" && (
            <button
              type="button"
              className="geo-btn geo-btn-ghost geo-btn-sm"
              onClick={onPause}
            >
              Pause
            </button>
          )}
          {prompt.status !== "archived" && (
            <button
              type="button"
              className="geo-btn geo-btn-ghost geo-btn-sm"
              onClick={onArchive}
            >
              Archive
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
