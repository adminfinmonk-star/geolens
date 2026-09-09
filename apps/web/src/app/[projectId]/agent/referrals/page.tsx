import { ReferralsClient } from "./referrals-client";

export default async function ReferralsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div>
      <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.75rem" }}>
        AI Referrals
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        GA4 assistant traffic — floor, not total
      </p>
      <ReferralsClient projectId={projectId} />
    </div>
  );
}
