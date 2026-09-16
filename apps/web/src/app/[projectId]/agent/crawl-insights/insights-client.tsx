"use client";

import { apiBase } from "@/lib/api";
import { DemoDataBadge, NoDataCallout } from "@/components/no-data-callout";
import { useCallback, useEffect, useState } from "react";

const API_BASE = apiBase();

type Dash = {
  data_state: "live" | "empty" | "demo_fixture";
  empty_reason: string | null;
  kpis: {
    total_bot_visits: number;
    active_bots: number;
    failure_rate: number;
    top_folder: string | null;
    top_url: string | null;
  };
  visited_urls: {
    url: string;
    bot_visits: number;
    platforms: string[];
    status_codes: Record<string, number>;
    retrievals: number;
    citation_rate: number;
    topics: string[];
    crawled_never_cited: boolean;
  }[];
  crawled_never_cited: { url: string }[];
  integrations: {
    id: string;
    kind: string;
    status: string;
    label: string;
    warning?: string;
  }[];
  prompt_columns_note: string;
};

export function CrawlInsightsClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Dash | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/agent/crawl-insights`, { credentials: "include" });
      if (!res.ok) {
        setError("Failed to load");
        return;
      }
      setData(await res.json());
      setError(null);
    } catch {
      setError(`API unreachable at ${API_BASE}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectCf() {
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/agent/crawl-insights/cloudflare`, { credentials: "include", method: "POST" });
    const body = (await res.json()) as { warning?: string };
    setMsg(body.warning ?? "Cloudflare connected");
    await load();
  }

  async function uploadLogFile(file: File) {
    const text = await file.text();
    const res = await fetch(
      `${API_BASE}/v1/projects/${projectId}/agent/crawl-insights/upload`,
      {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    const body = (await res.json()) as {
      accepted?: unknown[];
      errors?: unknown[];
    };
    if (!res.ok) {
      setMsg("Upload failed — check the log format.");
      return;
    }
    setMsg(
      `Ingested ${body.accepted?.length ?? 0} bot request(s)${
        body.errors?.length ? ` · ${body.errors.length} row(s) skipped` : ""
      }`,
    );
    await load();
  }

  if (error) return <p style={{ color: "var(--muted)" }}>{error}</p>;
  if (!data) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  const isEmpty = data.data_state === "empty";

  return (
    <div>
      {data.data_state === "demo_fixture" && (
        <p style={{ margin: "0.75rem 0 0" }}>
          <DemoDataBadge />
        </p>
      )}

      {isEmpty && (
        <div style={{ marginTop: 16 }}>
          <NoDataCallout
            title="No AI bot crawl activity yet"
            reason={data.empty_reason}
          />
        </div>
      )}

      {!isEmpty && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        {(
          [
            ["Bot visits", String(data.kpis.total_bot_visits)],
            ["Active bots", String(data.kpis.active_bots)],
            [
              "Failure rate",
              `${(data.kpis.failure_rate * 100).toFixed(0)}%`,
            ],
            ["Top folder", data.kpis.top_folder ?? "—"],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "0.85rem",
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
            <div style={{ fontWeight: 650, marginTop: 4, fontSize: 15 }}>
              {value}
            </div>
          </div>
        ))}
      </div>
      )}

      <h2 style={{ marginTop: 28, fontSize: "1.1rem" }}>Ingestion paths</h2>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Bot activity can arrive by webhook, access-log upload, or a Cloudflare
        Worker.
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {data.integrations.map((i) => (
          <li
            key={i.id}
            style={{
              borderTop: "1px solid var(--line)",
              padding: "10px 0",
              fontSize: 14,
            }}
          >
            <strong>{i.label}</strong> — {i.status}
            {i.warning && (
              <div style={{ color: "#d4a017", fontSize: 12, marginTop: 4 }}>
                {i.warning}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <button type="button" onClick={connectCf} style={btnStyle}>
          Connect Cloudflare
        </button>
        <label style={{ ...btnStyleMuted, display: "inline-block" }}>
          Upload access log
          <input
            type="file"
            accept=".csv,.log,.txt,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadLogFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {msg && (
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
          {msg}
        </p>
      )}

      <h2 style={{ marginTop: 32, fontSize: "1.1rem" }}>Visited URLs</h2>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        {data.prompt_columns_note}
      </p>
      {data.visited_urls.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          No URLs recorded yet.
        </p>
      )}
      {data.crawled_never_cited.length > 0 && (
        <p style={{ color: "#d4a017", fontSize: 13 }}>
          {data.crawled_never_cited.length} URL(s) crawled but never cited —
          content/extractability issue, not reachability.
        </p>
      )}
      <table
        style={{
          width: "100%",
          marginTop: 12,
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>URL</th>
            <th>Visits</th>
            <th>Platforms</th>
            <th>Retrievals</th>
            <th>Cite rate</th>
            <th>Diagnose</th>
          </tr>
        </thead>
        <tbody>
          {data.visited_urls.map((u) => (
            <tr key={u.url} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 4px", maxWidth: 280 }}>
                {u.url.replace(/^https?:\/\//, "")}
              </td>
              <td>{u.bot_visits}</td>
              <td>{u.platforms.join(", ")}</td>
              <td>{u.retrievals}</td>
              <td>{(u.citation_rate * 100).toFixed(0)}%</td>
              <td style={{ color: u.crawled_never_cited ? "#d4a017" : "var(--muted)" }}>
                {u.crawled_never_cited ? "crawled, never cited" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const btnStyle = {
  background: "var(--accent)",
  color: "#0b1210",
  border: "none",
  borderRadius: 6,
  padding: "0.45rem 0.85rem",
  fontWeight: 600,
  cursor: "pointer",
} as const;

const btnStyleMuted = {
  ...btnStyle,
  background: "transparent",
  color: "var(--muted)",
  border: "1px solid var(--line)",
} as const;
