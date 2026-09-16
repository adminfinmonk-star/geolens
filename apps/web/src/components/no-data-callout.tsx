/**
 * Honest empty state. Surfaces that have collected nothing say so plainly
 * instead of rendering fabricated sample rows.
 */
export function NoDataCallout({
  title,
  reason,
  action,
}: {
  title: string;
  reason?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="geo-callout" style={{ marginBottom: "var(--space-4)" }}>
      <div>
        <strong>{title}</strong>
        {reason ? (
          <p className="geo-vis-note" style={{ margin: "0.35rem 0 0" }}>
            {reason}
          </p>
        ) : null}
        {action ? <div style={{ marginTop: "0.6rem" }}>{action}</div> : null}
      </div>
    </div>
  );
}

/** Shown when a surface is intentionally rendering the synthetic demo dataset. */
export function DemoDataBadge() {
  return (
    <span className="geo-badge geo-badge-warm" title="Synthetic demo dataset — not collected from live engines">
      Demo data
    </span>
  );
}
