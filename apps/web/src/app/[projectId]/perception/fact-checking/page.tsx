import Link from "next/link";
import { FactcheckClient } from "./factcheck-client";

export default async function FactCheckingPage({
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
            <h1>Fact-checking</h1>
            <span className="geo-badge geo-badge-warm">Claims audit</span>
          </div>
          <p className="geo-page-lede">
            Claims from AI chats judged against your asserted facts — spot
            contradictions fast.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/perception`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Perception
          </Link>
          <Link
            href={`/${projectId}/chats`}
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Open chats
          </Link>
        </div>
      </header>
      <FactcheckClient projectId={projectId} />
    </div>
  );
}
