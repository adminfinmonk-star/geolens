"use client";

import { apiBase } from "@/lib/api";
import { useEffect, useState } from "react";

const API_BASE = apiBase();

type Summary = {
  engine_note: string;
  position_note: string;
  empty_state: string;
  catalog_count: number;
  all_count: number;
  top_products: {
    name: string;
    brand_name: string;
    visibility: number;
    win_rate: number;
    avg_position: number;
    price_drift: number | null;
    source: string;
  }[];
  price_drift: {
    name: string;
    catalog_price: number | null;
    mentioned_price_avg: number | null;
    price_drift: number | null;
  }[];
  shopping_queries: { text: string; occurrences: number; mode: string }[];
};

type ProductRow = {
  id: string;
  name: string;
  brand_name: string;
  source: string;
  catalog_price: number | null;
  visibility: number;
  win_rate: number;
  avg_position: number | null;
  appearances: number;
  mentioned_price_avg: number | null;
  price_drift: number | null;
};

export function ShoppingClient({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [source, setSource] = useState<"all" | "catalog">("all");
  const [csv, setCsv] = useState(
    "title,brand,price,currency,category\nAcme CRM Starter,Acme,19,USD,CRM > Starter\n",
  );
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(src: "all" | "catalog" = source) {
    try {
      const [s, p] = await Promise.all([
        fetch(`${API_BASE}/v1/projects/${projectId}/shopping/summary`, { credentials: "include" }),
        fetch(`${API_BASE}/v1/projects/${projectId}/shopping/products?source=${src}`, { credentials: "include" }),
      ]);
      if (!s.ok) {
        setError("Failed to load shopping");
        return;
      }
      setSummary(await s.json());
      if (p.ok) {
        const body = (await p.json()) as { rows: ProductRow[] };
        setProducts(body.rows);
      }
    } catch {
      setError(`API unreachable at ${API_BASE}`);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function upload() {
    setUploadMsg(null);
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/shopping/catalog`, { credentials: "include", method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }) });
    const body = (await res.json()) as {
      added?: number;
      matched_appearances?: number;
      price_drift_visible?: boolean;
      error?: string;
    };
    if (!res.ok) {
      setUploadMsg(body.error ?? "Upload failed");
      return;
    }
    setUploadMsg(
      `Added ${body.added} · backfilled ${body.matched_appearances} chats · price drift ${body.price_drift_visible ? "visible" : "none"}`,
    );
    await load(source);
  }

  if (error) return <p style={{ color: "var(--muted)" }}>{error}</p>;
  if (!summary) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
        {summary.engine_note}
      </p>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
        {summary.position_note}
      </p>
      <p style={{ fontSize: 13, marginTop: 8 }}>{summary.empty_state}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        <Stat label="Catalog products" value={String(summary.catalog_count)} />
        <Stat label="All products" value={String(summary.all_count)} />
        <Stat
          label="Price drift rows"
          value={String(summary.price_drift.length)}
        />
      </div>

      <h2 style={{ marginTop: 28, fontSize: "1.1rem" }}>Price drift</h2>
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Mentioned price vs catalog — assistants quoting stale prices is common
        and costly.
      </p>
      <table
        style={{
          width: "100%",
          marginTop: 8,
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Product</th>
            <th>Catalog</th>
            <th>Mentioned avg</th>
            <th>Drift</th>
          </tr>
        </thead>
        <tbody>
          {summary.price_drift.map((d) => (
            <tr key={d.name} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 4px", fontWeight: 600 }}>{d.name}</td>
              <td>{d.catalog_price ?? "—"}</td>
              <td>{d.mentioned_price_avg?.toFixed(2) ?? "—"}</td>
              <td style={{ color: "#d4a017" }}>
                {d.price_drift != null
                  ? `${d.price_drift > 0 ? "+" : ""}${d.price_drift.toFixed(2)}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 28, fontSize: "1.1rem" }}>Top products</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {summary.top_products.map((p) => (
          <li
            key={p.name}
            style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}
          >
            <strong>{p.name}</strong>{" "}
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              {p.brand_name} · {p.source}
            </span>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              vis {(p.visibility * 100).toFixed(0)}% · win{" "}
              {(p.win_rate * 100).toFixed(0)}% · avg pos{" "}
              {p.avg_position.toFixed(1)}
            </div>
          </li>
        ))}
      </ul>

      <h2 style={{ marginTop: 28, fontSize: "1.1rem" }}>Products</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["all", "catalog"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSource(s);
              void load(s);
            }}
            style={{
              background: source === s ? "var(--accent)" : "transparent",
              color: source === s ? "#0b1210" : "var(--muted)",
              border: source === s ? "none" : "1px solid var(--line)",
              borderRadius: 6,
              padding: "0.35rem 0.7rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All products" : "My catalog"}
          </button>
        ))}
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Product</th>
            <th>Vis</th>
            <th>Win</th>
            <th>Pos</th>
            <th>Catalog</th>
            <th>Mentioned</th>
            <th>Drift</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 4px" }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 11 }}>
                  {p.brand_name} · {p.source}
                </div>
              </td>
              <td>{(p.visibility * 100).toFixed(0)}%</td>
              <td>{(p.win_rate * 100).toFixed(0)}%</td>
              <td>{p.avg_position?.toFixed(1) ?? "—"}</td>
              <td>{p.catalog_price ?? "—"}</td>
              <td>{p.mentioned_price_avg?.toFixed(1) ?? "—"}</td>
              <td>
                {p.price_drift != null ? p.price_drift.toFixed(1) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 28, fontSize: "1.1rem" }}>
        Upload catalog (CSV)
      </h2>
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Additive upload · required columns title, brand · 30-day backfill on
        match
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={4}
        style={{
          width: "100%",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          background: "var(--bg-elevated)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: 8,
        }}
      />
      <button
        type="button"
        onClick={() => void upload()}
        style={{
          marginTop: 8,
          background: "var(--accent)",
          color: "#0b1210",
          border: "none",
          borderRadius: 6,
          padding: "0.45rem 0.85rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Upload & backfill
      </button>
      {uploadMsg && (
        <p style={{ fontSize: 13, marginTop: 8 }}>{uploadMsg}</p>
      )}

      <h2 style={{ marginTop: 28, fontSize: "1.1rem" }}>Shopping demand</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {summary.shopping_queries.map((q) => (
          <li
            key={q.text}
            style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}
          >
            {q.text}{" "}
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              {q.occurrences}× · {q.mode}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "0.85rem 1rem",
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 650, marginTop: 4, fontSize: 18 }}>{value}</div>
    </div>
  );
}
