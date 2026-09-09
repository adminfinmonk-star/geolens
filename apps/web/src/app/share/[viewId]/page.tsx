import { apiFetch } from "@/lib/api-server";

type SharedPayload = {
  view: { id: string; name: string; widgets: string[] };
  read_only: boolean;
  project: { id: string; name: string };
  brands: {
    brand_id: string;
    brand_name: string;
    is_own?: boolean;
    visibility: number;
    share_of_voice: number;
    position: number | null;
    sentiment: number | null;
    mention_count: number;
  }[];
  meta: { chats: number; surface_kind: string };
};

async function fetchShared(viewId: string): Promise<SharedPayload | null> {
  try {
    const res = await apiFetch(`/v1/shared/${viewId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function SharedViewPage({
  params,
}: {
  params: Promise<{ viewId: string }>;
}) {
  const { viewId } = await params;
  const data = await fetchShared(viewId);

  if (!data) {
    return (
      <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Shared view not found</h1>
        <p style={{ color: "var(--muted)" }}>
          This link may have expired or the API is offline.
        </p>
      </main>
    );
  }

  const own = data.brands.find((b) => b.is_own) ?? data.brands[0];

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <p
        style={{
          color: "var(--muted)",
          fontSize: 12,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        Read-only share · {data.meta.surface_kind}
      </p>
      <h1 style={{ margin: "0.35rem 0 0.25rem", fontSize: "1.85rem" }}>
        {data.view.name}
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {data.project.name} · {data.meta.chats} chats · no login required
      </p>

      {own && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginTop: 28,
          }}
        >
          {[
            ["Visibility", pct(own.visibility)],
            ["Share of voice", pct(own.share_of_voice)],
            [
              "Avg position",
              own.position != null ? own.position.toFixed(2) : "—",
            ],
            [
              "Sentiment",
              own.sentiment != null ? own.sentiment.toFixed(0) : "—",
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "1rem",
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 650, marginTop: 6 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      <table
        style={{
          width: "100%",
          marginTop: 32,
          borderCollapse: "collapse",
          fontSize: 14,
        }}
      >
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Brand</th>
            <th>Visibility</th>
            <th>SoV</th>
            <th>Position</th>
            <th>Sentiment</th>
          </tr>
        </thead>
        <tbody>
          {data.brands.map((r) => (
            <tr key={r.brand_id} style={{ borderTop: "1px solid var(--line)" }}>
              <td
                style={{
                  padding: "10px 4px",
                  fontWeight: r.is_own ? 700 : 400,
                }}
              >
                {r.brand_name}
                {r.is_own ? " (you)" : ""}
              </td>
              <td>{pct(r.visibility)}</td>
              <td>{pct(r.share_of_voice)}</td>
              <td>{r.position?.toFixed(2) ?? "—"}</td>
              <td>{r.sentiment?.toFixed(0) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
