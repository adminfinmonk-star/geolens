"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

type DomainGap = {
  domain: string;
  classification: string;
  gap_score_normalized: number;
  retrieval_count: number;
  citation_rate: number;
  competitor_brands_mentioned: number;
  guidance: string;
};

type UrlGap = {
  url: string;
  domain: string;
  classification: string;
  gap_score_normalized: number;
  retrieval_count: number;
  citation_rate: number;
  competitor_brands_mentioned: number;
  guidance: string;
};

export default function GapsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [domains, setDomains] = useState<DomainGap[]>([]);
  const [urls, setUrls] = useState<UrlGap[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `${API}/v1/projects/${projectId}/reports/gaps`,
          { credentials: "include" },
        );
        if (!res.ok) {
          setError("Failed to load gaps");
          return;
        }
        const data = (await res.json()) as {
          domains: DomainGap[];
          urls: UrlGap[];
        };
        setDomains(data.domains);
        setUrls(data.urls.slice(0, 50));
      } catch {
        setError(`API unreachable at ${API}`);
      }
    })();
  }, [projectId]);

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Gap analysis</h1>
            <span className="geo-badge geo-badge-warm">Citation gaps</span>
          </div>
          <p className="geo-page-lede">
            Sources that name competitors and not you — sorted by gap score.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/sources/domains`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Domains
          </Link>
          <Link
            href={`/${projectId}/actions`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Create actions
          </Link>
        </div>
      </header>

      {error && <p className="ob-error">{error}</p>}

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Domain gaps</p>
          <p className="geo-vis-kpi-value">{domains.length}</p>
          <p className="geo-vis-kpi-meta">Competitor cited · you absent</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">URL gaps</p>
          <p className="geo-vis-kpi-value">{urls.length}</p>
          <p className="geo-vis-kpi-meta">Top 50 shown</p>
        </article>
      </div>

      <section className="geo-panel geo-vis-panel">
        <h2 className="geo-section-title" style={{ marginTop: 0 }}>
          Domain gaps
        </h2>
        <div className="geo-comp-table-wrap">
          <table className="geo-comp-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Type</th>
                <th>Gap</th>
                <th>Retrievals</th>
                <th>Competitors</th>
                <th>Guidance</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((r) => (
                <tr key={r.domain}>
                  <td>
                    <strong>{r.domain}</strong>
                  </td>
                  <td>{r.classification}</td>
                  <td>{r.gap_score_normalized.toFixed(0)}</td>
                  <td>{r.retrieval_count}</td>
                  <td>{r.competitor_brands_mentioned}</td>
                  <td>{r.guidance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="geo-panel geo-vis-panel" style={{ marginTop: "1rem" }}>
        <h2 className="geo-section-title" style={{ marginTop: 0 }}>
          URL gaps
        </h2>
        <div className="geo-comp-table-wrap">
          <table className="geo-comp-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Type</th>
                <th>Gap</th>
                <th>Retrievals</th>
                <th>Guidance</th>
              </tr>
            </thead>
            <tbody>
              {urls.map((r) => (
                <tr key={r.url}>
                  <td style={{ wordBreak: "break-all" }}>{r.url}</td>
                  <td>{r.classification}</td>
                  <td>{r.gap_score_normalized.toFixed(0)}</td>
                  <td>{r.retrieval_count}</td>
                  <td>{r.guidance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
