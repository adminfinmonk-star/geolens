import Link from "next/link";
import { ActionsClient } from "./actions-client";

export default async function ActionsPage({
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
            <h1>Actions &amp; Fixes</h1>
            <span className="geo-badge geo-badge-neutral">Opportunity queue</span>
          </div>
          <p className="geo-page-lede">
            Ranked recommendations grounded in evidence (R1–R10).
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/impact`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Impact
          </Link>
          <Link
            href={`/${projectId}/insights`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Brand Performance
          </Link>
        </div>
      </header>
      <ActionsClient projectId={projectId} />
    </div>
  );
}
