import { SsoSettingsClient } from "./sso-client";

export default async function SsoSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <SsoSettingsClient projectId={projectId} />;
}
