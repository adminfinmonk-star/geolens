import { ActionDetailClient } from "./action-detail-client";

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; actionId: string }>;
}) {
  const { projectId, actionId } = await params;
  return <ActionDetailClient projectId={projectId} actionId={actionId} />;
}
