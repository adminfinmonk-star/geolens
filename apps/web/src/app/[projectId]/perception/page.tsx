import Link from "next/link";
import { PerceptionClient } from "./perception-client";

export default async function PerceptionPage({
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
            <h1>Perception &amp; Sentiment</h1>
            <span className="geo-badge geo-badge-neutral">Market attributes</span>
          </div>
          <p className="geo-page-lede">
            How AI describes your brand — tone, attributes, and risk themes.
            Independent of tracked prompts.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/insights`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Brand Performance
          </Link>
          <Link
            href={`/${projectId}/perception/fact-checking`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Fact-checking
          </Link>
        </div>
      </header>
      <PerceptionClient projectId={projectId} />
    </div>
  );
}
