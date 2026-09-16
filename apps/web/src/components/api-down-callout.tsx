export function ApiDownCallout({ noun = "this page" }: { noun?: string }) {
  return (
    <div
      role="alert"
      className="geo-callout geo-callout-warning"
      style={{ marginBottom: "var(--space-4)" }}
    >
      <span>
        Couldn&apos;t load {noun}. Start the API with{" "}
        <code>pnpm --filter @geo/api dev</code>, then refresh.
      </span>
    </div>
  );
}
