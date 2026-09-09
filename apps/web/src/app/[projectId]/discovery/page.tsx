"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

type Profile = {
  domain: string;
  name: string;
  industry: string;
  tagline: string;
  description?: string;
  products: string[];
  personas: string[];
  reviewed: boolean;
};

type TopicSug = { name: string; reason: string };
type PromptSug = {
  text: string;
  country_code: string;
  topic: string;
  branding: string;
  intent_type: string;
  persona: string;
  volume_score: number;
};
type Coverage = {
  key: string;
  dimension: string;
  accepted: number;
  suggested: number;
  status: string;
};

const STARTER = [
  "Best CRM for early-stage startups",
  "HubSpot alternatives for small sales teams",
  "CRM with native Slack sync",
];

function intentClass(intent: string) {
  const i = intent.toLowerCase();
  if (i.includes("commercial") || i.includes("transactional"))
    return "geo-badge geo-badge-positive";
  if (i.includes("compar")) return "geo-badge geo-badge-warm";
  return "geo-badge geo-badge-neutral";
}

function volumeLabel(n: number) {
  return `${Math.max(1, Math.min(5, Math.round(n)))}/5`;
}

export default function DiscoveryPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicMeta, setTopicMeta] = useState<TopicSug[]>([]);
  const [prompts, setPrompts] = useState<PromptSug[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [minVolume, setMinVolume] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API}/v1/projects/${projectId}/brand-profile`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Failed to load profile");
        return null;
      }
      const data = (await res.json()) as { profile: Profile };
      setProfile(data.profile);
      return data.profile;
    } catch {
      setError(`API unreachable at ${API}`);
      return null;
    }
  }, [projectId]);

  const generate = useCallback(
    async (p: Profile, topicList?: string[]) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        if (!p.reviewed) {
          await fetch(`${API}/v1/projects/${projectId}/brand-profile`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...p, reviewed: true }),
          });
          setProfile({ ...p, reviewed: true });
        }
        const gen = await fetch(
          `${API}/v1/projects/${projectId}/discovery/generate`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              countries: ["US", "GB"],
              topics: topicList?.length ? topicList : undefined,
              branded_share: 0.2,
            }),
          },
        );
        if (!gen.ok) {
          setError("Failed to generate prompts");
          return;
        }
        const data = (await gen.json()) as {
          topics?: TopicSug[];
          prompts: PromptSug[];
          coverage: Coverage[];
        };
        if (data.topics?.length) {
          setTopicMeta(data.topics);
          setTopics(data.topics.map((t) => t.name));
        }
        setPrompts(data.prompts ?? []);
        setCoverage(data.coverage ?? []);
        setSelected(new Set());
      } catch {
        setError(`API unreachable at ${API}`);
      } finally {
        setBusy(false);
        setLoaded(true);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void (async () => {
      const p = await loadProfile();
      if (p) await generate(p);
    })();
  }, [loadProfile, generate]);

  async function activatePrompts(chosen: PromptSug[]) {
    if (!chosen.length) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/v1/projects/${projectId}/discovery/activate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompts: chosen }),
        },
      );
      const data = (await res.json()) as { count: number };
      setMessage(`Activated ${data.count} prompts for tracking`);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function activateSelected() {
    await activatePrompts(prompts.filter((p) => selected.has(p.text)));
  }

  function toggle(text: string) {
    const next = new Set(selected);
    if (next.has(text)) next.delete(text);
    else next.add(text);
    setSelected(next);
  }

  const topicOptions = useMemo(() => {
    const fromMeta = topicMeta.map((t) => t.name);
    const fromPrompts = prompts.map((p) => p.topic);
    return [...new Set([...fromMeta, ...fromPrompts, ...topics])].filter(
      Boolean,
    );
  }, [topicMeta, prompts, topics]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (q && !p.text.toLowerCase().includes(q)) return false;
      if (topicFilter !== "all" && p.topic !== topicFilter) return false;
      if (intentFilter !== "all" && p.intent_type !== intentFilter) return false;
      if (brandFilter !== "all" && p.branding !== brandFilter) return false;
      if (p.volume_score < minVolume) return false;
      return true;
    });
  }, [prompts, query, topicFilter, intentFilter, brandFilter, minVolume]);

  const highVol = prompts.filter((p) => p.volume_score >= 4).length;
  const topicCoverage = coverage.filter((c) => c.dimension === "topic");
  const personaCoverage = coverage.filter((c) => c.dimension === "persona");

  if (error && !profile) {
    return <p className="ob-error">{error}</p>;
  }
  if (!profile || !loaded) {
    return <p className="geo-vis-note">Loading Prompt Research…</p>;
  }

  return (
    <div className="geo-vis geo-pr">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Prompt Research</h1>
            <span className="geo-badge geo-badge-positive">
              Discovery workspace
            </span>
          </div>
          <p className="geo-page-lede">
            Discover high-intent questions buyers ask AI — then activate them
            for tracking.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/prompts`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Open tracking
          </Link>
          <button
            type="button"
            className="geo-btn geo-btn-primary geo-btn-sm"
            disabled={busy || selected.size === 0}
            onClick={() => void activateSelected()}
          >
            Activate selected ({selected.size})
          </button>
        </div>
      </header>

      {error && <p className="ob-error">{error}</p>}
      {message && <p className="geo-pr-success">{message}</p>}

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Identified buyer prompts</p>
          <p className="geo-vis-kpi-value">{prompts.length || "—"}</p>
          <p className="geo-vis-kpi-meta">
            {profile.name} · {topicOptions.length || "—"} topic clusters
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">High-volume (4–5★)</p>
          <p className="geo-vis-kpi-value">{highVol}</p>
          <p className="geo-vis-kpi-meta">
            {prompts.length
              ? `${Math.round((highVol / prompts.length) * 100)}% of cluster`
              : "Generate to score volume"}
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Selected to activate</p>
          <p className="geo-vis-kpi-value">{selected.size}</p>
          <p className="geo-vis-kpi-meta">
            <Link href={`/${projectId}/prompts`}>View live tracking →</Link>
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Coverage rows</p>
          <p className="geo-vis-kpi-value">{coverage.length || "—"}</p>
          <p className="geo-vis-kpi-meta">
            Accepted vs suggested by dimension
          </p>
        </article>
      </div>

      <div className="geo-pr-layout">
        <section className="geo-panel geo-vis-panel geo-pr-main">
          <div className="geo-pr-toolbar">
            <input
              className="geo-input"
              placeholder="Search prompts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: 280, minHeight: 34 }}
            />
            <select
              className="geo-input geo-pr-select"
              value={String(minVolume)}
              onChange={(e) => setMinVolume(Number(e.target.value))}
              aria-label="Volume filter"
            >
              <option value="1">All volumes (1–5★)</option>
              <option value="3">Volume 3–5★</option>
              <option value="4">High volume 4–5★</option>
              <option value="5">Only 5★</option>
            </select>
            <select
              className="geo-input geo-pr-select"
              value={intentFilter}
              onChange={(e) => setIntentFilter(e.target.value)}
              aria-label="Intent filter"
            >
              <option value="all">All intents</option>
              <option value="informational">Informational</option>
              <option value="commercial">Commercial</option>
              <option value="transactional">Transactional</option>
            </select>
            <select
              className="geo-input geo-pr-select"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              aria-label="Branding filter"
            >
              <option value="all">All branding</option>
              <option value="branded">Branded</option>
              <option value="non-branded">Non-branded</option>
            </select>
            <button
              type="button"
              className="geo-btn geo-btn-primary geo-btn-sm"
              disabled={busy}
              onClick={() => void generate(profile, topics)}
            >
              {busy ? "Generating…" : "Generate prompts"}
            </button>
          </div>

          <div className="geo-pr-chips" role="tablist" aria-label="Topics">
            <button
              type="button"
              className={
                topicFilter === "all" ? "geo-pr-chip geo-pr-chip-on" : "geo-pr-chip"
              }
              onClick={() => setTopicFilter("all")}
            >
              All topics ({prompts.length})
            </button>
            {topicOptions.slice(0, 8).map((t) => {
              const count = prompts.filter((p) => p.topic === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  className={
                    topicFilter === t ? "geo-pr-chip geo-pr-chip-on" : "geo-pr-chip"
                  }
                  onClick={() => setTopicFilter(t)}
                >
                  {t} ({count})
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <p className="geo-vis-note">
              No prompts match these filters. Try Generate prompts or clear
              filters.
            </p>
          ) : (
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table geo-pr-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        aria-label="Select all visible"
                        checked={
                          filtered.length > 0 &&
                          filtered.every((p) => selected.has(p.text))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelected(
                              new Set([
                                ...selected,
                                ...filtered.map((p) => p.text),
                              ]),
                            );
                          } else {
                            const drop = new Set(filtered.map((p) => p.text));
                            setSelected(
                              new Set(
                                [...selected].filter((t) => !drop.has(t)),
                              ),
                            );
                          }
                        }}
                      />
                    </th>
                    <th>Prompt</th>
                    <th>Topic</th>
                    <th>Intent</th>
                    <th>Branding</th>
                    <th>Volume</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={`${p.text}-${p.country_code}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(p.text)}
                          onChange={() => toggle(p.text)}
                          aria-label={`Select ${p.text}`}
                        />
                      </td>
                      <td>
                        <strong>{p.text}</strong>
                        <small className="geo-pr-row-meta">
                          {p.country_code} · {p.persona}
                        </small>
                      </td>
                      <td>
                        <span className="geo-badge geo-badge-neutral">
                          {p.topic}
                        </span>
                      </td>
                      <td>
                        <span className={intentClass(p.intent_type)}>
                          {p.intent_type}
                        </span>
                      </td>
                      <td>{p.branding}</td>
                      <td>
                        <span
                          className="geo-pr-volume mono"
                          title={`Volume score ${p.volume_score}`}
                        >
                          {volumeLabel(p.volume_score)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="geo-btn geo-btn-ghost geo-btn-sm"
                          disabled={busy}
                          onClick={() => void activatePrompts([p])}
                        >
                          Activate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selected.size > 0 && (
            <div className="geo-pr-batch">
              <span>{selected.size} prompts selected</span>
              <div className="geo-vis-actions">
                <button
                  type="button"
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="geo-btn geo-btn-primary geo-btn-sm"
                  disabled={busy}
                  onClick={() => void activateSelected()}
                >
                  Activate selected
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Coverage overview
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Accepted vs suggested after discovery generate.
            </p>
            {topicCoverage.length === 0 ? (
              <p className="geo-vis-note">Generate prompts to see coverage.</p>
            ) : (
              <ul className="geo-pr-cov-list">
                {topicCoverage.slice(0, 8).map((c) => {
                  const total = Math.max(1, c.suggested);
                  const pct = Math.round((c.accepted / total) * 100);
                  return (
                    <li key={`${c.dimension}-${c.key}`}>
                      <div className="geo-vis-bar-meta">
                        <span>{c.key}</span>
                        <span className="mono">
                          {c.accepted}/{c.suggested}
                        </span>
                      </div>
                      <div className="geo-vis-bar-track">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {personaCoverage.length > 0 && (
            <section className="geo-panel geo-vis-panel">
              <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                By buyer persona
              </h2>
              <div className="geo-pr-persona-grid">
                {personaCoverage.slice(0, 4).map((c) => {
                  const total = Math.max(1, c.suggested);
                  const pct = Math.round((c.accepted / total) * 100);
                  return (
                    <article key={c.key} className="geo-pr-persona">
                      <strong>{c.key}</strong>
                      <span>{pct}%</span>
                      <div className="geo-vis-bar-track">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Suggested starters
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Demo seeds until more discovery history exists.
            </p>
            <ul className="geo-gap-list">
              {STARTER.map((text) => (
                <li key={text} className="geo-gap-card">
                  <p>{text}</p>
                  <button
                    type="button"
                    className="geo-btn geo-btn-ghost geo-btn-sm"
                    onClick={() => setQuery(text.slice(0, 24))}
                  >
                    Find similar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
