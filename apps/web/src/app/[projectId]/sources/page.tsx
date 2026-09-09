import Link from "next/link";

const LINKS = [
  {
    href: "domains",
    title: "Domains",
    body: "Retrieval and citation metrics by domain.",
  },
  {
    href: "urls",
    title: "URLs",
    body: "Page-level sources engines retrieve and cite.",
  },
  {
    href: "gaps",
    title: "Gap analysis",
    body: "Cited domains where your brand is absent.",
  },
] as const;

export default async function SourcesIndex({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Sources</h1>
            <span className="geo-badge geo-badge-neutral">Hub</span>
          </div>
          <p className="geo-page-lede">
            Domains and URLs AI engines retrieve and cite while answering your
            prompts.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/sources/domains`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Open domains
          </Link>
        </div>
      </header>
      <div className="geo-vis-kpis">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={`/${projectId}/sources/${l.href}`}
            className="geo-vis-kpi"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <p className="geo-vis-kpi-label">{l.title}</p>
            <p className="geo-vis-kpi-meta" style={{ marginTop: "0.5rem" }}>
              {l.body}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
