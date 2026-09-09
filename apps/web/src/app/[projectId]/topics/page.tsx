"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

type Topic = { id: string; name: string };
type Tag = { id: string; name: string; group?: string; is_system: boolean };

export default function TopicsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [csv, setCsv] = useState(
    "text,country,topic\nbest CRM for nonprofits,US,Category alternatives",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/v1/projects/${projectId}/topics`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Failed to load topics");
        return;
      }
      const data = (await res.json()) as { rows: Topic[]; tags: Tag[] };
      setTopics(data.rows);
      setTags(data.tags);
      setError(null);
    } catch {
      setError(`API unreachable at ${API}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTopics = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return topics;
    return topics.filter((t) => t.name.toLowerCase().includes(needle));
  }, [topics, q]);

  const filteredTags = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        (t.group ?? "").toLowerCase().includes(needle),
    );
  }, [tags, q]);

  const systemTags = tags.filter((t) => t.is_system).length;

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${API}/v1/projects/${projectId}/topics`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    await load();
  }

  async function importCsv() {
    const res = await fetch(`${API}/v1/projects/${projectId}/prompts/import`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = (await res.json()) as { count: number };
    setMsg(`Imported ${data.count} prompts`);
  }

  if (error && topics.length === 0) {
    return <p className="ob-error">{error}</p>;
  }

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Topics &amp; tags</h1>
            <span className="geo-badge geo-badge-neutral">Prompt taxonomy</span>
          </div>
          <p className="geo-page-lede">
            Organize prompts and discovery themes for filtering and reporting.
            System tags cover branding and intent classification.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/discovery`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Prompt Research
          </Link>
          <Link
            href={`/${projectId}/prompts`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Prompt Tracking
          </Link>
        </div>
      </header>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Topics</p>
          <p className="geo-vis-kpi-value">{topics.length}</p>
          <p className="geo-vis-kpi-meta">Workspace themes</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Tags</p>
          <p className="geo-vis-kpi-value">{tags.length}</p>
          <p className="geo-vis-kpi-meta">Including system</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">System tags</p>
          <p className="geo-vis-kpi-value">{systemTags}</p>
          <p className="geo-vis-kpi-meta">Built-in classifiers</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Custom tags</p>
          <p className="geo-vis-kpi-value">{tags.length - systemTags}</p>
          <p className="geo-vis-kpi-meta">Workspace-defined</p>
        </article>
      </div>

      {error && <p className="ob-error">{error}</p>}
      {msg && <p className="geo-pr-success">{msg}</p>}

      <div className="geo-pr-layout">
        <div style={{ display: "grid", gap: "1rem" }}>
          <form
            onSubmit={(e) => void addTopic(e)}
            className="geo-panel geo-vis-panel"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "end",
            }}
          >
            <label className="geo-field" style={{ flex: "1 1 220px" }}>
              <span className="geo-field-label">New topic</span>
              <input
                className="geo-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Category alternatives"
                required
              />
            </label>
            <button type="submit" className="geo-btn geo-btn-primary geo-btn-sm">
              Add topic
            </button>
            <label className="geo-field" style={{ flex: "1 1 180px" }}>
              <span className="geo-field-label">Filter</span>
              <input
                className="geo-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search topics or tags…"
              />
            </label>
          </form>

          <section className="geo-panel geo-vis-panel" style={{ padding: 0 }}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                Topics
              </h2>
            </div>
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Id</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTopics.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.name}</strong>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{t.id}</code>
                      </td>
                    </tr>
                  ))}
                  {filteredTopics.length === 0 && (
                    <tr>
                      <td colSpan={2}>
                        <p className="geo-vis-note" style={{ margin: "0.75rem" }}>
                          No topics yet — add one above.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="geo-panel geo-vis-panel" style={{ padding: 0 }}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                Tags
              </h2>
            </div>
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Group</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTags.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.group ?? "—"}</td>
                      <td>
                        {t.is_system ? (
                          <span className="geo-badge geo-badge-neutral">
                            System
                          </span>
                        ) : (
                          <span className="geo-badge geo-badge-warm">Custom</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredTags.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <p className="geo-vis-note" style={{ margin: "0.75rem" }}>
                          No tags match this filter.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            className="geo-panel geo-vis-panel"
            style={{ display: "grid", gap: 10 }}
          >
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Bulk CSV import
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Columns: <code>text,country,topic</code> — creates prompts and
              links topics when present.
            </p>
            <textarea
              className="geo-input"
              rows={5}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12 }}
            />
            <div className="geo-vis-actions">
              <button
                type="button"
                className="geo-btn geo-btn-primary geo-btn-sm"
                onClick={() => void importCsv()}
              >
                Import prompts
              </button>
            </div>
          </section>
        </div>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              How topics feed research
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Topics group prompts in Prompt Research and Tracking filters.
              Tags classify branding and intent so reports stay comparable.
            </p>
            <Link
              href={`/${projectId}/discovery`}
              className="geo-btn geo-btn-ghost geo-btn-sm"
            >
              Open Prompt Research
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
                href={`/${projectId}/brands`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Brands
              </Link>
              <Link
                href={`/${projectId}/channels`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Channels
              </Link>
              <Link
                href={`/${projectId}/profile`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Brand profile
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
