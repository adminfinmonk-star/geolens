import { BrandsClient } from "./brands-client";

export default async function BrandsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <BrandsClient projectId={projectId} />;
}
