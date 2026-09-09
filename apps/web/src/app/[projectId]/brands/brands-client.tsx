"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = apiBase();

type Brand = {
  id: string;
  name: string;
  is_own: boolean;
  aliases: string[];
  patterns: string[];
};

type Filter = "all" | "own" | "competitor";

export function BrandsClient({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/brands`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Failed to load brands");
        return;
      }
      const body = (await res.json()) as { rows: Brand[] };
      setRows(body.rows);
      setError(null);
    } catch {
      setError(`API unreachable at ${API_BASE}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownCount = rows.filter((b) => b.is_own).length;
  const competitorCount = rows.filter((b) => !b.is_own).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((b) => {
      if (filter === "own" && !b.is_own) return false;
      if (filter === "competitor" && b.is_own) return false;
      if (!needle) return true;
      return (
        b.name.toLowerCase().includes(needle) ||
        b.aliases.some((a) => a.toLowerCase().includes(needle))
      );
    });
  }, [rows, q, filter]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/brands`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          aliases: aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not create brand");
        return;
      }
      setName("");
      setAliases("");
      setShowAdd(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function save(brand: Brand) {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/v1/projects/${projectId}/brands/${brand.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brand.name,
          is_own: brand.is_own,
          aliases: brand.aliases,
          patterns: brand.patterns,
        }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this brand?")) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/v1/projects/${projectId}/brands/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function patchLocal(id: string, patch: Partial<Brand>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) {
          if (patch.is_own === true) return { ...r, is_own: false };
          return r;
        }
        return { ...r, ...patch };
      }),
    );
  }

  if (error && rows.length === 0) {
    return <p className="ob-error">{error}</p>;
  }

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Brands</h1>
            <span className="geo-badge geo-badge-neutral">Multi-entity</span>
          </div>
          <p className="geo-page-lede">
            Own brand and competitors you monitor for AI visibility — aliases
            and patterns drive mention matching.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/competitors`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Competitor Research
          </Link>
          <button
            type="button"
            className="geo-btn geo-btn-primary geo-btn-sm"
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? "Close" : "Add brand"}
          </button>
        </div>
      </header>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Own brands</p>
          <p className="geo-vis-kpi-value">{ownCount}</p>
          <p className="geo-vis-kpi-meta">Primary entity flags</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Tracked competitors</p>
          <p className="geo-vis-kpi-value">{competitorCount}</p>
          <p className="geo-vis-kpi-meta">Monitored rivals</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Entities</p>
          <p className="geo-vis-kpi-value">{rows.length}</p>
          <p className="geo-vis-kpi-meta">Total brand rows</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">With aliases</p>
          <p className="geo-vis-kpi-value">
            {rows.filter((b) => b.aliases.length > 0).length}
          </p>
          <p className="geo-vis-kpi-meta">Matching coverage</p>
        </article>
      </div>

      {error && <p className="ob-error">{error}</p>}

      {showAdd && (
        <section
          className="geo-panel geo-vis-panel"
          style={{ marginBottom: "1rem", display: "grid", gap: 10 }}
        >
          <h2 className="geo-section-title" style={{ marginTop: 0 }}>
            Add brand
          </h2>
          <label className="geo-field">
            <span className="geo-field-label">Brand name</span>
            <input
              className="geo-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </label>
          <label className="geo-field">
            <span className="geo-field-label">Aliases (comma-separated)</span>
            <input
              className="geo-input"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="Acme, ACME Inc"
            />
          </label>
          <div className="geo-vis-actions">
            <button
              type="button"
              className="geo-btn geo-btn-primary geo-btn-sm"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              Create entity
            </button>
          </div>
        </section>
      )}

      <div className="geo-pr-layout">
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="geo-vis-actions" style={{ flexWrap: "wrap" }}>
            <input
              className="geo-input"
              style={{ flex: "1 1 220px", maxWidth: 360 }}
              placeholder="Filter by brand or alias…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {(
              [
                ["all", "All"],
                ["own", "Own"],
                ["competitor", "Competitor"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`geo-btn geo-btn-sm ${
                  filter === id ? "geo-btn-primary" : "geo-btn-ghost"
                }`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="geo-panel geo-vis-panel" style={{ padding: 0 }}>
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Role</th>
                    <th>Aliases</th>
                    <th>Patterns</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <input
                          className="geo-input"
                          style={{ minWidth: 140 }}
                          value={b.name}
                          onChange={(e) =>
                            patchLocal(b.id, { name: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <label
                          style={{
                            display: "inline-flex",
                            gap: 6,
                            alignItems: "center",
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={b.is_own}
                            onChange={(e) =>
                              patchLocal(b.id, { is_own: e.target.checked })
                            }
                          />
                          {b.is_own ? (
                            <span className="geo-badge geo-badge-neutral">
                              Own
                            </span>
                          ) : (
                            <span className="geo-badge geo-badge-warm">
                              Competitor
                            </span>
                          )}
                        </label>
                      </td>
                      <td>
                        <input
                          className="geo-input"
                          value={b.aliases.join(", ")}
                          onChange={(e) =>
                            patchLocal(b.id, {
                              aliases: e.target.value
                                .split(",")
                                .map((a) => a.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Aliases…"
                        />
                      </td>
                      <td>
                        <input
                          className="geo-input"
                          value={b.patterns.join(", ")}
                          onChange={(e) =>
                            patchLocal(b.id, {
                              patterns: e.target.value
                                .split(",")
                                .map((a) => a.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Regex…"
                        />
                      </td>
                      <td>
                        <div className="geo-vis-actions">
                          <button
                            type="button"
                            className="geo-btn geo-btn-ghost geo-btn-sm"
                            disabled={busy}
                            onClick={() => void save(b)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="geo-btn geo-btn-ghost geo-btn-sm"
                            disabled={busy}
                            onClick={() => void remove(b.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <p className="geo-vis-note" style={{ margin: "0.75rem" }}>
                          No brands match this filter.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Why track rivals
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Mentions of competitors in AI answers reveal substitution risk and
              gap prompts. Aliases keep matching honest when models shorten
              brand names.
            </p>
            <Link
              href={`/${projectId}/competitors`}
              className="geo-btn geo-btn-ghost geo-btn-sm"
            >
              Open gap intel
            </Link>
          </section>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Related settings
            </h2>
            <div
              className="geo-vis-actions"
              style={{ flexDirection: "column", alignItems: "stretch" }}
            >
              <Link
                href={`/${projectId}/profile`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Brand profile
              </Link>
              <Link
                href={`/${projectId}/topics`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Topics &amp; tags
              </Link>
              <Link
                href={`/${projectId}/settings/api-keys`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                API keys
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
