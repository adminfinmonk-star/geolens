import { CrawlInsightsClient } from "./insights-client";

export default async function CrawlInsightsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div>
      <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.75rem" }}>
        Crawl Insights
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        AI bot access logs joined to prompt-tracking retrievals
      </p>
      <CrawlInsightsClient projectId={projectId} />
    </div>
  );
}
