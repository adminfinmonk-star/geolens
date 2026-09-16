import { apiFetch } from "@/lib/api-server";
import Link from "next/link";
import { ApiDownCallout } from "@/components/api-down-callout";

type Insights = {
  brand: { id: string; name: string; is_own: boolean };
  kpis: {
    visibility: number;
    share_of_voice: number;
    position: number | null;
    sentiment: number | null;
    strongest_channel: string | null;
    weakest_channel: string | null;
  };
  matrix: {
    rowAxis: string;
    colAxis: string;
    rowKeys: string[];
    colKeys: string[];
    cells: {
      rowKey: string;
      colKey: string;
      visibility: number;
      share_of_voice: number;
      position: number | null;
      sentiment: number | null;
    }[];
  };
};

async function fetchInsights(projectId: string): Promise<Insights | null> {
  try {
    const res = await apiFetch(
      `/v1/projects/${projectId}/insights/brand?row_axis=topic&col_axis=channel`,
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

/** Teal→warm heat for light theme (not purple). */
function heat(v: number) {
  const t = Math.max(0, Math.min(1, v));
  if (t < 0.35) {
    return `color-mix(in srgb, var(--warm-soft) ${40 + t * 80}%, var(--bg-elevated))`;
  }
  return `color-mix(in srgb, var(--accent-soft) ${35 + t * 65}%, var(--bg-elevated))`;
}

function opportunityScore(data: Insights): number {
  const vis = data.kpis.visibility;
  const gap = Math.max(0, 0.55 - vis);
  return Math.round(40 + gap * 100 + (data.kpis.weakest_channel ? 12 : 0));
}

export default async function BrandInsightsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = await fetchInsights(projectId);

  const weakCells =
    data?.matrix.cells
      .slice()
      .sort((a, b) => a.visibility - b.visibility)
      .slice(0, 4) ?? [];
  const strongCells =
    data?.matrix.cells
      .slice()
      .sort((a, b) => b.visibility - a.visibility)
      .slice(0, 4) ?? [];

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Brand Performance</h1>
            <span className="geo-badge geo-badge-neutral">Insights matrix</span>
          </div>
          <p className="geo-page-lede">
            Where you win and lose across topics, models, and markets
            {data ? ` — focus: ${data.brand.name}` : ""}.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/actions`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            View actions
          </Link>
          <Link
            href={`/${projectId}/perception`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Perception
          </Link>
        </div>
      </header>

      {!data && <ApiDownCallout noun="brand performance" />}

      {data && (
        <>
          <div className="geo-vis-kpis">
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Overall visibility</p>
              <p className="geo-vis-kpi-value">{pct(data.kpis.visibility)}</p>
              <p className="geo-vis-kpi-meta">
                SoV {pct(data.kpis.share_of_voice)}
              </p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Strongest channel</p>
              <p className="geo-vis-kpi-value" style={{ fontSize: "1.25rem" }}>
                {data.kpis.strongest_channel ?? "—"}
              </p>
              <p className="geo-vis-kpi-meta">Highest visibility engine</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Weakest channel</p>
              <p className="geo-vis-kpi-value" style={{ fontSize: "1.25rem" }}>
                {data.kpis.weakest_channel ?? "—"}
              </p>
              <p className="geo-vis-kpi-meta">Priority gap to close</p>
            </article>
            <article className="geo-vis-kpi">
              <p className="geo-vis-kpi-label">Opportunity score</p>
              <p className="geo-vis-kpi-value">{opportunityScore(data)}</p>
              <p className="geo-vis-kpi-meta">
                Derived from visibility gap (beta)
              </p>
            </article>
          </div>

          <div className="geo-pr-layout">
            <section className="geo-panel geo-vis-panel">
              <div className="geo-vis-panel-head">
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  Performance matrix
                </h2>
                <span className="geo-badge geo-badge-neutral">
                  {data.matrix.rowAxis} × {data.matrix.colAxis}
                </span>
              </div>
              <p className="geo-vis-note" style={{ marginTop: 0 }}>
                Heat = visibility. Hover a cell for SoV and position.
              </p>
              <div className="geo-comp-table-wrap">
                <table className="geo-comp-table geo-bp-matrix">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      {data.matrix.colKeys.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.matrix.rowKeys.map((row) => (
                      <tr key={row}>
                        <td>
                          <strong>{row}</strong>
                        </td>
                        {data.matrix.colKeys.map((col) => {
                          const cell = data.matrix.cells.find(
                            (c) => c.rowKey === row && c.colKey === col,
                          );
                          const v = cell?.visibility ?? 0;
                          return (
                            <td
                              key={col}
                              className="geo-bp-cell"
                              title={`SoV ${pct(cell?.share_of_voice ?? 0)} · pos ${cell?.position?.toFixed(1) ?? "—"}`}
                              style={{ background: heat(v) }}
                            >
                              {pct(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="geo-pr-side">
              <section className="geo-panel geo-vis-panel">
                <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                  Winning cells
                </h2>
                <ul className="geo-gap-list">
                  {strongCells.map((c) => (
                    <li
                      key={`w-${c.rowKey}-${c.colKey}`}
                      className="geo-gap-card"
                    >
                      <span className="geo-badge geo-badge-positive">
                        {pct(c.visibility)}
                      </span>
                      <p>
                        {c.rowKey} · {c.colKey}
                      </p>
                      <small>
                        SoV {pct(c.share_of_voice)}
                        {c.position != null
                          ? ` · pos ${c.position.toFixed(1)}`
                          : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="geo-panel geo-vis-panel">
                <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                  Losing cells
                </h2>
                <ul className="geo-gap-list">
                  {weakCells.map((c) => (
                    <li
                      key={`l-${c.rowKey}-${c.colKey}`}
                      className="geo-gap-card"
                    >
                      <span className="geo-badge geo-badge-warm">
                        {pct(c.visibility)}
                      </span>
                      <p>
                        {c.rowKey} · {c.colKey}
                      </p>
                      <Link
                        href={`/${projectId}/actions`}
                        className="geo-btn geo-btn-ghost geo-btn-sm"
                      >
                        Create action
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
