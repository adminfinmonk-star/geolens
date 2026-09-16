import { apiFetch } from "@/lib/api-server";
import Link from "next/link";
import { ApiDownCallout } from "@/components/api-down-callout";
import { DemoDataBadge, NoDataCallout } from "@/components/no-data-callout";

type Fanouts = {
  data_state: "live" | "empty" | "demo_fixture";
  empty_reason: string | null;
  distinct_queries: number;
  total_occurrences: number;
  rows: {
    text: string;
    type: string;
    occurrences: number;
    channels: string[];
  }[];
  common_terms: { term: string; count: number }[];
};

async function fetchFanouts(projectId: string): Promise<Fanouts | null> {
  try {
    const res = await apiFetch(`/v1/projects/${projectId}/reports/fanouts`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function FanoutsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = await fetchFanouts(projectId);

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Fanouts</h1>
            <span className="geo-badge geo-badge-neutral">Follow-up queries</span>
            {data?.data_state === "demo_fixture" && <DemoDataBadge />}
          </div>
          <p className="geo-page-lede">
            Queries engines issue while answering your prompts.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/chats`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Chats
          </Link>
          <Link
            href={`/${projectId}/ads`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Ads
          </Link>
        </div>
      </header>

      {!data && <ApiDownCallout noun="fanouts" />}

      {data?.data_state === "empty" && (
        <NoDataCallout
          title="No fanout queries captured yet"
          reason={data.empty_reason}
        />
      )}

      {data && data.data_state !== "empty" && (
        <>
          <div className="geo-vis-kpis">
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Distinct queries</p>
              <p className="geo-vis-kpi-value">{data.distinct_queries}</p>
              <p className="geo-vis-kpi-meta">Unique fanout texts</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Occurrences</p>
              <p className="geo-vis-kpi-value">{data.total_occurrences}</p>
              <p className="geo-vis-kpi-meta">Across all engines</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Common terms</p>
              <p className="geo-vis-kpi-value">{data.common_terms.length}</p>
              <p className="geo-vis-kpi-meta">Top extracted tokens</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Rows</p>
              <p className="geo-vis-kpi-value">{data.rows.length}</p>
              <p className="geo-vis-kpi-meta">In fanouts report</p>
            </article>
          </div>

          <div className="geo-pr-layout">
            <section className="geo-panel geo-vis-panel">
              <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                Fanout queries
              </h2>
              <div className="geo-comp-table-wrap">
                <table className="geo-comp-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Type</th>
                      <th>Occurrences</th>
                      <th>Channels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={`${r.type}|${r.text}`}>
                        <td>
                          <strong>{r.text}</strong>
                        </td>
                        <td>
                          <span className="geo-badge geo-badge-neutral">
                            {r.type}
                          </span>
                        </td>
                        <td>{r.occurrences}</td>
                        <td>{r.channels.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <aside className="geo-pr-side">
              <section className="geo-panel geo-vis-panel">
                <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                  Common terms
                </h2>
                <div className="geo-pr-chips">
                  {data.common_terms.map((t) => (
                    <span key={t.term} className="geo-pr-chip">
                      {t.term} · {t.count}
                    </span>
                  ))}
                  {data.common_terms.length === 0 && (
                    <p className="geo-vis-note">No terms yet</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
