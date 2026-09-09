"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API = apiBase();

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
};

function relativeTime(iso?: string) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ApiKeysClient({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [name, setName] = useState("default");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/v1/projects/${projectId}/api-keys`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError(`Load failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { rows: KeyRow[] };
      setRows(body.rows);
      setError(null);
    } catch {
      setError(`API unreachable at ${API}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = rows.filter((r) => !r.revoked_at);
  const revoked = rows.filter((r) => r.revoked_at);
  const lastUsed = useMemo(() => {
    const times = rows
      .map((r) => r.last_used_at)
      .filter(Boolean)
      .map((s) => new Date(s as string).getTime())
      .filter((n) => !Number.isNaN(n));
    if (!times.length) return undefined;
    return new Date(Math.max(...times)).toISOString();
  }, [rows]);
  const scopeCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of active) for (const s of r.scopes) set.add(s);
    return set.size;
  }, [active]);

  async function create() {
    const res = await fetch(`${API}/v1/projects/${projectId}/api-keys`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const body = (await res.json()) as { api_key: string };
    setPlaintext(body.api_key);
    setCopied(false);
    await load();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key permanently?")) return;
    await fetch(`${API}/v1/projects/${projectId}/api-keys/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  }

  async function copyKey() {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (error && rows.length === 0) {
    return <p className="ob-error">{error}</p>;
  }

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>API keys</h1>
            <span className="geo-badge geo-badge-neutral">Workspace access</span>
          </div>
          <p className="geo-page-lede">
            Machine access for exports, webhooks, and automations. Keys are
            hashed at rest and shown once — prefer{" "}
            <code>x-api-key</code> on <code>/customer/v1/*</code>.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/billing`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Billing
          </Link>
          <Link
            href={`/${projectId}/settings/sso`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            SSO
          </Link>
        </div>
      </header>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Active keys</p>
          <p className="geo-vis-kpi-value">{active.length}</p>
          <p className="geo-vis-kpi-meta">Production credentials</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Revoked</p>
          <p className="geo-vis-kpi-value">{revoked.length}</p>
          <p className="geo-vis-kpi-meta">Historical</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Last used</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {relativeTime(lastUsed)}
          </p>
          <p className="geo-vis-kpi-meta">Across active keys</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Scopes in use</p>
          <p className="geo-vis-kpi-value">{scopeCount}</p>
          <p className="geo-vis-kpi-meta">Least-privilege set</p>
        </article>
      </div>

      {error && <p className="ob-error">{error}</p>}

      <div className="geo-pr-layout">
        <div style={{ display: "grid", gap: "1rem" }}>
          <section
            className="geo-panel geo-vis-panel"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "end",
            }}
          >
            <label className="geo-field" style={{ flex: "1 1 200px" }}>
              <span className="geo-field-label">Key name</span>
              <input
                className="geo-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ci-export"
              />
            </label>
            <button
              type="button"
              className="geo-btn geo-btn-primary geo-btn-sm"
              disabled={!name.trim()}
              onClick={() => void create()}
            >
              Create key
            </button>
          </section>

          {plaintext && (
            <section
              className="geo-panel geo-vis-panel"
              style={{
                borderColor: "var(--accent)",
                background: "var(--accent-soft)",
              }}
            >
              <div className="geo-vis-title-row" style={{ marginBottom: 8 }}>
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  One-time reveal
                </h2>
                <span className="geo-badge geo-badge-neutral">Copy now</span>
              </div>
              <p className="geo-vis-note" style={{ marginTop: 0 }}>
                This plaintext key will not be shown again. Store it in your
                secret manager.
              </p>
              <code
                style={{
                  display: "block",
                  wordBreak: "break-all",
                  fontSize: 13,
                  marginBottom: 10,
                }}
              >
                {plaintext}
              </code>
              <div className="geo-vis-actions">
                <button
                  type="button"
                  className="geo-btn geo-btn-primary geo-btn-sm"
                  onClick={() => void copyKey()}
                >
                  {copied ? "Copied" : "Copy token"}
                </button>
                <button
                  type="button"
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                  onClick={() => setPlaintext(null)}
                >
                  Dismiss
                </button>
              </div>
            </section>
          )}

          <section className="geo-panel geo-vis-panel" style={{ padding: 0 }}>
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Scopes</th>
                    <th>Created</th>
                    <th>Last used</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td>
                        <code>{r.key_prefix}…</code>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          {r.scopes.length
                            ? r.scopes.map((s) => (
                                <span
                                  key={s}
                                  className="geo-badge geo-badge-neutral"
                                >
                                  {s}
                                </span>
                              ))
                            : "—"}
                        </div>
                      </td>
                      <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>{relativeTime(r.last_used_at)}</td>
                      <td>
                        {r.revoked_at ? (
                          <span className="geo-badge geo-badge-warm">
                            Revoked
                          </span>
                        ) : (
                          <span className="geo-badge geo-badge-neutral">
                            Active
                          </span>
                        )}
                      </td>
                      <td>
                        {!r.revoked_at && (
                          <button
                            type="button"
                            className="geo-btn geo-btn-ghost geo-btn-sm"
                            onClick={() => void revoke(r.id)}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <p className="geo-vis-note" style={{ margin: "0.75rem" }}>
                          No API keys yet — create one above.
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
              Security notes
            </h2>
            <ul className="geo-gap-list" style={{ margin: 0 }}>
              <li className="geo-vis-note">Never commit keys to git or tickets.</li>
              <li className="geo-vis-note">
                Rotate immediately if a token may have leaked.
              </li>
              <li className="geo-vis-note">
                Prefer least-privilege scopes for each integration.
              </li>
              <li className="geo-vis-note">
                Revoked keys stay listed for audit history.
              </li>
            </ul>
          </section>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Sample request
            </h2>
            <pre
              className="geo-chat-answer"
              style={{
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 12,
                background: "var(--bg-soft)",
                padding: "0.75rem",
                borderRadius: "var(--radius-sm, 8px)",
                overflow: "auto",
              }}
            >{`curl -H "x-api-key: YOUR_KEY" \\
  ${API}/customer/v1/reports/brands`}</pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
