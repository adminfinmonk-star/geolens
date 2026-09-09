import Link from "next/link";
import { ImpactClient } from "./impact-client";

export default async function ImpactPage({
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
            <h1>Impact</h1>
            <span className="geo-badge geo-badge-neutral">Not causal</span>
          </div>
          <p className="geo-page-lede">
            Visibility over time with action status markers — not causal
            attribution.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/actions`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Actions &amp; Fixes
          </Link>
        </div>
      </header>
      <ImpactClient projectId={projectId} />
    </div>
  );
}
