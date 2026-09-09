import { AppShellClient } from "../../components/app-shell";

export default function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  return <Shell params={params}>{children}</Shell>;
}

async function Shell({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <AppShellClient projectId={projectId}>{children}</AppShellClient>;
}
