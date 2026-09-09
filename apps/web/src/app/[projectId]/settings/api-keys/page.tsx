import { ApiKeysClient } from "./api-keys-client";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ApiKeysClient projectId={projectId} />;
}
