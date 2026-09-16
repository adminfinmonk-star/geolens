import { apiFetch } from "@/lib/api-server";
import Link from "next/link";
import { ApiDownCallout } from "@/components/api-down-callout";
import { DemoDataBadge, NoDataCallout } from "@/components/no-data-callout";

type Ads = {
  data_state: "live" | "empty" | "demo_fixture";
  empty_reason: string | null;
  advertisers_in_market: number;
  prompts_with_ads: number;
  total_ads_seen: number;
  rows: {
    advertiser: string;
    times_seen: number;
    creatives: string[];
  }[];
  note: string;
};

async function fetchAds(projectId: string): Promise<Ads | null> {
  try {
    const res = await apiFetch(`/v1/projects/${projectId}/reports/ads`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AdsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = await fetchAds(projectId);

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Ads</h1>
            <span className="geo-badge geo-badge-neutral">Sponsored placements</span>
            {data?.data_state === "demo_fixture" && <DemoDataBadge />}
          </div>
          <p className="geo-page-lede">
            Sponsored placements observed in AI answers.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/fanouts`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Fanouts
          </Link>
          <Link
            href={`/${projectId}/chats`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Chats
          </Link>
        </div>
      </header>

      {!data && <ApiDownCallout noun="ads" />}

      {data?.data_state === "empty" && (
        <NoDataCallout
          title="No sponsored placements observed yet"
          reason={data.empty_reason}
        />
      )}

      {data && data.data_state !== "empty" && (
        <>
          <p className="geo-vis-note" style={{ marginTop: 0 }}>
            {data.note}
          </p>
          <div className="geo-vis-kpis">
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Advertisers in market</p>
              <p className="geo-vis-kpi-value">{data.advertisers_in_market}</p>
              <p className="geo-vis-kpi-meta">Distinct advertisers seen</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Chats with ads</p>
              <p className="geo-vis-kpi-value">{data.prompts_with_ads}</p>
              <p className="geo-vis-kpi-meta">Prompts that showed ads</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Total ads seen</p>
              <p className="geo-vis-kpi-value">{data.total_ads_seen}</p>
              <p className="geo-vis-kpi-meta">Across collection window</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Rows</p>
              <p className="geo-vis-kpi-value">{data.rows.length}</p>
              <p className="geo-vis-kpi-meta">Advertiser rollup</p>
            </article>
          </div>

          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Advertisers
            </h2>
            <div className="geo-comp-table-wrap">
              <table className="geo-comp-table">
                <thead>
                  <tr>
                    <th>Advertiser</th>
                    <th>Times seen</th>
                    <th>Creatives</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.advertiser}>
                      <td>
                        <strong>{r.advertiser}</strong>
                      </td>
                      <td>{r.times_seen}</td>
                      <td>{r.creatives.slice(0, 3).join(" · ") || "—"}</td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <p className="geo-vis-note">
                          No advertisers recorded in this window.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
