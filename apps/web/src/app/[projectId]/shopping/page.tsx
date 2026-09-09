import { ShoppingClient } from "./shopping-client";

export default async function ShoppingPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div>
      <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.75rem" }}>Shopping</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        SKU visibility, win rate, price drift, and catalog ingest
      </p>
      <ShoppingClient projectId={projectId} />
    </div>
  );
}
