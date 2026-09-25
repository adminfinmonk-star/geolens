"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

const LEGACY_GENERIC_PROVIDER_ERROR = /^Provider returned (?:GOOGLE|OPENROUTER|PPLX)_ERROR$/;

function diagnosticDetail(detail?: string) {
  if (!detail) return null;
  return LEGACY_GENERIC_PROVIDER_ERROR.test(detail)
    ? "Legacy attempt: detailed provider diagnostics were not captured."
    : detail;
}

type Detail = {
  chat: {
    id: string;
    run_date: string;
    status: string;
    country_code: string;
    model_channel_id: string;
    text: string;
    raw_uri?: string;
    surface_kind?: string;
    model_reported?: string;
    provider_request_id?: string;
    latency_ms?: number;
    error_code?: string;
    error_detail?: string;
    collected_at?: string;
  };
  prompt: { id: string; text: string } | null;
  mentions: Array<{
    brand_id: string;
    brand_name: string;
    is_own: boolean;
    mention_count: number;
    position: number;
    sentiment: number;
  }>;
  sources: Array<{
    url: string;
    domain: string;
    cited: boolean;
    citation_count: number;
    retrieval_rank: number;
  }>;
};

export default function ChatDetailPage() {
  const params = useParams<{ projectId: string; chatId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `${API}/v1/projects/${params.projectId}/chats/${params.chatId}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          setError("Chat not found");
          return;
        }
        setData(await res.json());
      } catch {
        setError(`API unreachable at ${API}`);
      }
    })();
  }, [params.projectId, params.chatId]);

  if (error) {
    return (
      <div className="geo-vis">
        <Link href={`/${params.projectId}/chats`} className="geo-btn geo-btn-ghost geo-btn-sm">
          Back to Chats
        </Link>
        <p className="ob-error">{error}</p>
      </div>
    );
  }

  if (!data) return <p className="geo-vis-note">Loading…</p>;

  const { chat, prompt, mentions, sources } = data;
  const errorDetail = diagnosticDetail(chat.error_detail);

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Chat detail</h1>
            <span className="geo-badge geo-badge-neutral">Atomic measurement</span>
          </div>
          <p className="geo-page-lede">
            {chat.run_date} / {chat.model_reported ?? chat.model_channel_id} / {chat.country_code} /{" "}
            {chat.status}
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${params.projectId}/chats`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Back to Chats
          </Link>
          <Link
            href={`/${params.projectId}/fanouts`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Fanouts
          </Link>
        </div>
      </header>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Mentions</p>
          <p className="geo-vis-kpi-value">{mentions.length}</p>
          <p className="geo-vis-kpi-meta">Brands in this answer</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Sources</p>
          <p className="geo-vis-kpi-value">{sources.length}</p>
          <p className="geo-vis-kpi-meta">
            {sources.filter((s) => s.cited).length} cited
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Model</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1rem" }}>
            {chat.model_reported ?? chat.model_channel_id}
          </p>
          <p className="geo-vis-kpi-meta">{chat.surface_kind ?? "Unknown surface"}</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Status</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {chat.status}
          </p>
          <p className="geo-vis-kpi-meta">{chat.error_code ?? chat.run_date}</p>
        </article>
      </div>

      <div className="geo-pr-layout">
        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Prompt
            </h2>
            <p style={{ margin: 0, fontWeight: 650, lineHeight: 1.45 }}>
              {prompt?.text ?? "Unavailable"}
            </p>
          </section>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Model response
            </h2>
            <div className="geo-chat-answer">{chat.text || "(empty)"}</div>
          </section>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Brand mentions
            </h2>
            {mentions.length === 0 ? (
              <p className="geo-vis-note">None</p>
            ) : (
              <div className="geo-comp-table-wrap">
                <table className="geo-comp-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Position</th>
                      <th>Mentions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentions
                      .slice()
                      .sort((a, b) => a.position - b.position)
                      .map((m) => (
                        <tr
                          key={m.brand_id}
                          data-own={m.is_own ? "true" : "false"}
                        >
                          <td>
                            <strong>{m.brand_name}</strong>
                            {m.is_own && (
                              <span className="geo-badge geo-badge-positive">
                                You
                              </span>
                            )}
                          </td>
                          <td>{m.position}</td>
                          <td>{m.mention_count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Collection diagnostics
            </h2>
            <p className="geo-vis-note">
              Surface: {chat.surface_kind ?? "unknown"}<br />
              Model: {chat.model_reported ?? "not reported"}<br />
              Latency: {chat.latency_ms != null ? `${chat.latency_ms} ms` : "not reported"}<br />
              Provider request: {chat.provider_request_id ?? "not reported"}<br />
              Error: {chat.error_code ?? "none"}
              {errorDetail ? <><br />Detail: {errorDetail}</> : null}
            </p>
          </section>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Sources &amp; citations
            </h2>
            {sources.length === 0 ? (
              <p className="geo-vis-note">None retrieved</p>
            ) : (
              <ul className="geo-gap-list">
                {sources
                  .slice()
                  .sort((a, b) => a.retrieval_rank - b.retrieval_rank)
                  .map((s) => (
                    <li key={`${s.url}-${s.retrieval_rank}`} className="geo-gap-card">
                      <span className="geo-badge geo-badge-neutral">
                        #{s.retrieval_rank}
                      </span>
                      <p>{s.domain}</p>
                      <small>
                        {s.cited ? `Cited ×${s.citation_count}` : "Retrieved"} ·{" "}
                        {s.url}
                      </small>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
