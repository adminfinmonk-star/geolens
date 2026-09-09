"use client";

import { apiBase } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

const API_BASE = apiBase();

type Row = {
  bot: string;
  platform: string;
  type: string;
  status: string;
  reason: string;
};

export function CrawlabilityClient({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [domain, setDomain] = useState("");
  const [blocked, setBlocked] = useState<{ bot: string }[]>([]);
  const [note, setNote] = useState("");
  const [testUrl, setTestUrl] = useState("/docs/getting-started");
  const [testRows, setTestRows] = useState<
    { bot: string; allowed: boolean; reason: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/agent/crawlability`, { credentials: "include" });
      if (!res.ok) {
        setError("Failed to load");
        return;
      }
      const body = (await res.json()) as {
        domain: string;
        rows: Row[];
        blocked_search_bots: { bot: string }[];
        categorization_note: string;
      };
      setDomain(body.domain);
      setRows(body.rows);
      setBlocked(body.blocked_search_bots);
      setNote(body.categorization_note);
      setError(null);
    } catch {
      setError(`API unreachable at ${API_BASE}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTester() {
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/agent/url-tester`, { credentials: "include", method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: testUrl }) });
    if (res.ok) {
      const body = (await res.json()) as {
        rows: { bot: string; allowed: boolean; reason: string }[];
      };
      setTestRows(body.rows);
    }
  }

  if (error) return <p style={{ color: "var(--muted)" }}>{error}</p>;

  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Domain: <strong style={{ color: "var(--ink)" }}>{domain}</strong> · zero
        setup — {note}
      </p>

      {blocked.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #d4a017",
            borderRadius: 8,
            background: "rgba(212,160,23,0.08)",
            fontSize: 14,
          }}
        >
          Blocked search bot(s): {blocked.map((b) => b.bot).join(", ")} — engines
          structurally cannot cite you. This feeds Actions R5.
        </div>
      )}

      <table
        style={{
          width: "100%",
          marginTop: 24,
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Bot</th>
            <th>Platform</th>
            <th>Type</th>
            <th>Status</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bot} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 4px", fontWeight: 600 }}>{r.bot}</td>
              <td>{r.platform}</td>
              <td>{r.type}</td>
              <td
                style={{
                  color:
                    r.status === "Blocked"
                      ? "#d4a017"
                      : r.status === "Partial"
                        ? "var(--muted)"
                        : "var(--accent)",
                }}
              >
                {r.status}
              </td>
              <td style={{ color: "var(--muted)" }}>{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 36, fontSize: "1.1rem" }}>URL Tester</h2>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          style={{
            flex: 1,
            background: "var(--bg-elevated)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "0.5rem 0.75rem",
            color: "var(--ink)",
          }}
        />
        <button
          type="button"
          onClick={runTester}
          style={{
            background: "var(--accent)",
            color: "#0b1210",
            border: "none",
            borderRadius: 6,
            padding: "0.5rem 1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Test
        </button>
      </div>
      {testRows.length > 0 && (
        <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 13 }}>
          {testRows.slice(0, 12).map((r) => (
            <li key={r.bot}>
              {r.bot}: {r.allowed ? "allowed" : "blocked"} ({r.reason})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
