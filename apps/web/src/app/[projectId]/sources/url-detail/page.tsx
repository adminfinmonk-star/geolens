"use client";

import { apiBase } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

const API = apiBase();

type UrlRow = {
  url: string;
  domain: string;
  classification: string;
  retrieval_count: number;
  citation_count: number;
  citation_rate: number;
  gap_score_normalized: number;
  own_brand_mentioned: boolean;
  competitor_brands_mentioned: number;
};

export default function UrlDetailPage() {
  const params = useParams<{ projectId: string }>();
  const search = useSearchParams();
  const decoded = search.get("u") ?? "";
  const [row, setRow] = useState<UrlRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!decoded) {
      setError("Missing URL");
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `${API}/v1/projects/${params.projectId}/reports/urls`,
          { credentials: "include" },
        );
        if (!res.ok) {
          setError("Failed to load");
          return;
        }
        const data = (await res.json()) as { rows: UrlRow[] };
        setRow(data.rows.find((r) => r.url === decoded) ?? null);
      } catch {
        setError(`API unreachable at ${API}`);
      }
    })();
  }, [params.projectId, decoded]);

  return (
    <div>
      <Link
        href={`/${params.projectId}/sources/urls`}
        style={{ color: "var(--accent)" }}
      >
        ← URLs
      </Link>
      <h1 style={{ marginBottom: 8, wordBreak: "break-all", fontSize: "1.25rem" }}>
        {decoded || "URL detail"}
      </h1>
      {error && <p style={{ color: "#f07178" }}>{error}</p>}
      {!error && !row && decoded && (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      )}
      {row && (
        <>
          <p style={{ color: "var(--muted)" }}>
            {row.domain} · {row.classification}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 12,
              marginTop: 20,
            }}
          >
            {[
              ["Retrievals", String(row.retrieval_count)],
              ["Citations", String(row.citation_count)],
              ["Citation rate", row.citation_rate.toFixed(2)],
              ["Gap score", row.gap_score_normalized.toFixed(0)],
              ["Own brand", row.own_brand_mentioned ? "mentioned" : "absent"],
              ["Competitors", String(row.competitor_brands_mentioned)],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "0.85rem",
                  background: "var(--bg-elevated)",
                }}
              >
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 650, marginTop: 4 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
