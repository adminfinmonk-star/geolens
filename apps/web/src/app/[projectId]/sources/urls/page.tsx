"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
  bookmarked?: boolean;
};

export default function UrlsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [rows, setRows] = useState<UrlRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/v1/projects/${projectId}/reports/urls`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Failed to load URLs");
        return;
      }
      const data = (await res.json()) as { rows: UrlRow[] };
      setRows(data.rows.slice(0, 200));
    } catch {
      setError(`API unreachable at ${API}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleBookmark(url: string) {
    await fetch(`${API}/v1/projects/${projectId}/sources/bookmarks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: url }),
    });
    await load();
  }

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>URLs</h1>
            <span className="geo-badge geo-badge-neutral">Page sources</span>
          </div>
          <p className="geo-page-lede">
            Page-level retrieval and citation metrics.
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
            href={`/${projectId}/sources/gaps`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Gaps
          </Link>
        </div>
      </header>

      {error && <p className="ob-error">{error}</p>}

      <section className="geo-panel geo-vis-panel">
        <div className="geo-comp-table-wrap">
          <table className="geo-comp-table">
            <thead>
              <tr>
                <th />
                <th>URL</th>
                <th>Type</th>
                <th>Retrievals</th>
                <th>Citations</th>
                <th>Citation rate</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.url}>
                  <td>
                    <button
                      type="button"
                      className="geo-btn geo-btn-ghost geo-btn-sm"
                      onClick={() => void toggleBookmark(r.url)}
                    >
                      {r.bookmarked ? "Pinned" : "Pin"}
                    </button>
                  </td>
                  <td>
                    <Link
                      href={`/${projectId}/sources/url-detail?u=${encodeURIComponent(r.url)}`}
                      style={{ wordBreak: "break-all" }}
                    >
                      <strong>{r.url}</strong>
                    </Link>
                    <small className="geo-pr-row-meta">{r.domain}</small>
                  </td>
                  <td>{r.classification}</td>
                  <td>{r.retrieval_count}</td>
                  <td>{r.citation_count}</td>
                  <td>{r.citation_rate.toFixed(2)}</td>
                  <td>{r.gap_score_normalized.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
