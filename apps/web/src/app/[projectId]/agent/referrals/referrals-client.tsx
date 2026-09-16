"use client";

import { apiBase } from "@/lib/api";
import { DemoDataBadge, NoDataCallout } from "@/components/no-data-callout";
import { useEffect, useState } from "react";

const API_BASE = apiBase();

type Ref = {
  data_state: "live" | "empty" | "demo_fixture";
  empty_reason: string | null;
  kpis: {
    session_starts: number;
    conversions: number;
    conversion_rate: number;
    revenue: number;
    currency: string;
  };
  by_assistant: { assistant: string; sessions: number }[];
  honesty: {
    floor_not_total: string;
    organic_search: string;
    direct: string;
  };
  definitions: Record<string, string>;
};

export function ReferralsClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Ref | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/projects/${projectId}/agent/referrals`, { credentials: "include" });
        if (!res.ok) {
          setError("Failed to load");
          return;
        }
        setData(await res.json());
      } catch {
        setError(`API unreachable at ${API_BASE}`);
      }
    })();
  }, [projectId]);

  if (error) return <p style={{ color: "var(--muted)" }}>{error}</p>;
  if (!data) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  if (data.data_state === "empty") {
    return (
      <div>
        <NoDataCallout
          title="No assistant referral traffic imported"
          reason={data.empty_reason}
        />
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
          {data.honesty.floor_not_total}
        </p>
      </div>
    );
  }

  return (
    <div>
      {data.data_state === "demo_fixture" && (
        <p style={{ margin: "0 0 0.75rem" }}>
          <DemoDataBadge />
        </p>
      )}
      <div
        style={{
          marginTop: 16,
          padding: 14,
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "rgba(61,156,124,0.06)",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <strong>Coverage honesty:</strong> {data.honesty.floor_not_total}
        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>
          · {data.honesty.organic_search}
          <br />· {data.honesty.direct}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        {(
          [
            ["AI session starts", String(data.kpis.session_starts)],
            ["Conversions", String(data.kpis.conversions)],
            [
              "Conv. rate",
              `${(data.kpis.conversion_rate * 100).toFixed(1)}%`,
            ],
            [
              "Revenue",
              `${data.kpis.currency} ${data.kpis.revenue.toFixed(0)}`,
            ],
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
            <div style={{ fontWeight: 650, marginTop: 4, fontSize: "1.25rem" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 28, fontSize: "1.1rem" }}>By assistant</h2>
      <table
        style={{
          width: "100%",
          marginTop: 12,
          borderCollapse: "collapse",
          fontSize: 14,
        }}
      >
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Assistant</th>
            <th>Session starts</th>
          </tr>
        </thead>
        <tbody>
          {data.by_assistant.map((r) => (
            <tr key={r.assistant} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "10px 4px" }}>{r.assistant}</td>
              <td>{r.sessions}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 28, fontSize: "1.05rem" }}>Definitions</h2>
      <ul style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
        {Object.entries(data.definitions).map(([k, v]) => (
          <li key={k}>
            <strong style={{ color: "var(--ink)" }}>{k}</strong> — {v}
          </li>
        ))}
      </ul>
    </div>
  );
}
