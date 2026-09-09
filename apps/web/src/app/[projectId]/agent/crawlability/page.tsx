import { CrawlabilityClient } from "./crawlability-client";

export default async function CrawlabilityPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div>
      <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.75rem" }}>
        Crawlability
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        robots.txt vs AI bots — no integration required
      </p>
      <CrawlabilityClient projectId={projectId} />
    </div>
  );
}
