"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = apiBase();

type Impact = {
  series: { date: string; visibility: number; chat_count: number }[];
  markers: {
    at: string;
    date: string;
    kind: "in_progress" | "done";
    action_id: string;
    overview: string;
    color: string;
  }[];
  note: string;
};

export function ImpactClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Impact | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/projects/${projectId}/impact`, { credentials: "include" });
        if (!res.ok) {
          setError("Failed to load impact");
          return;
        }
        setData(await res.json());
      } catch {
        setError(`API unreachable at ${API_BASE}`);
      }
    })();
  }, [projectId]);

  if (error) return <p className="ob-error">{error}</p>;
  if (!data) return <p className="geo-vis-note">Loading…</p>;

  const maxV = Math.max(...data.series.map((s) => s.visibility), 0.01);
  const spark = data.series.filter(
    (_, i) => i % 3 === 0 || i === data.series.length - 1,
  );
  const w = 640;
  const h = 160;
  const points = spark
    .map((s, i) => {
      const x = (i / Math.max(1, spark.length - 1)) * (w - 20) + 10;
      const y = h - 20 - (s.visibility / maxV) * (h - 40);
      return `${x},${y}`;
    })
    .join(" ");

  const selectedMarker = data.markers.find((m) => m.action_id === selected);

  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: 13, maxWidth: 560 }}>
        {data.note}
      </p>

      <div
        style={{
          marginTop: 20,
          background: "var(--bg-elevated)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: 16,
          overflowX: "auto",
        }}
      >
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>
          Own-brand visibility over time
        </div>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            points={points}
          />
          {data.markers.map((m) => {
            const idx = spark.findIndex((s) => s.date >= m.date);
            const i = idx < 0 ? spark.length - 1 : idx;
            const x = (i / Math.max(1, spark.length - 1)) * (w - 20) + 10;
            return (
              <g key={`${m.action_id}-${m.at}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={10}
                  y2={h - 10}
                  stroke={m.color === "green" ? "#3d9c7c" : "#d4a017"}
                  strokeWidth={selected === m.action_id ? 2.5 : 1.5}
                  strokeDasharray="4 3"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(m.action_id)}
                />
                <circle
                  cx={x}
                  cy={18}
                  r={5}
                  fill={m.color === "green" ? "#3d9c7c" : "#d4a017"}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(m.action_id)}
                />
              </g>
            );
          })}
        </svg>
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 12,
            color: "var(--muted)",
            marginTop: 8,
          }}
        >
          <span>
            <span style={{ color: "#d4a017" }}>●</span> In progress
          </span>
          <span>
            <span style={{ color: "#3d9c7c" }}>●</span> Done
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 28,
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>Action tracker</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.markers.map((m) => (
              <li
                key={`${m.action_id}-${m.at}`}
                style={{
                  borderTop: "1px solid var(--line)",
                  padding: "10px 0",
                  cursor: "pointer",
                  background:
                    selected === m.action_id
                      ? "rgba(61,156,124,0.08)"
                      : "transparent",
                }}
                onClick={() => setSelected(m.action_id)}
              >
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {m.date} · {m.kind}
                </div>
                <div style={{ fontWeight: 600 }}>{m.overview}</div>
              </li>
            ))}
            {data.markers.length === 0 && (
              <li style={{ color: "var(--muted)" }}>
                Accept or complete an action to place markers.
              </li>
            )}
          </ul>
        </div>
        <div>
          <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>Selected</h2>
          {selectedMarker ? (
            <div>
              <p style={{ fontWeight: 650 }}>{selectedMarker.overview}</p>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                {selectedMarker.kind} on {selectedMarker.date}
              </p>
              <Link
                href={`/${projectId}/actions/${selectedMarker.action_id}`}
                style={{ color: "var(--accent)" }}
              >
                Open action detail →
              </Link>
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>
              Click a marker or tracker row.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
