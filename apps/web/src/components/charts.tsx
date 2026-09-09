export function RankBars({
  rows,
}: {
  rows: { name: string; pct: number; highlight?: boolean }[];
}) {
  const max = Math.max(...rows.map((r) => r.pct), 1);
  return (
    <div className="geo-stagger" style={{ display: "grid", gap: 12 }}>
      {rows.map((r, i) => (
        <div
          key={r.name}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(96px, 130px) 1fr 44px",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              fontWeight: r.highlight ? 650 : 500,
              color: r.highlight ? "var(--accent-ink)" : "var(--ink)",
            }}
          >
            {r.name}
          </span>
          <div className="geo-bar">
            <span
              style={{
                width: `${(r.pct / max) * 100}%`,
                background: r.highlight ? "var(--chart-1)" : "var(--muted-2)",
                animationDelay: `${i * 70}ms`,
              }}
            />
          </div>
          <span
            style={{
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              color: "var(--muted)",
              fontWeight: 500,
            }}
          >
            {Math.round(r.pct)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({
  series,
}: {
  series: { label: string; points: number[]; color: string }[];
}) {
  const w = 560;
  const h = 180;
  const pad = 12;
  const max = Math.max(...series.flatMap((s) => s.points), 1);

  function pathFor(points: number[]) {
    return points
      .map((p, i) => {
        const x = pad + (i / (points.length - 1)) * (w - pad * 2);
        const y = h - pad - (p / max) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={180}
      role="img"
      aria-label="Visibility trend"
      style={{ display: "block" }}
    >
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={pad}
          x2={w - pad}
          y1={h - pad - g * (h - pad * 2)}
          y2={h - pad - g * (h - pad * 2)}
          stroke="var(--line)"
          strokeWidth="1"
        />
      ))}
      {series.map((s, idx) => (
        <path
          key={s.label}
          className="geo-chart-line"
          d={pathFor(s.points)}
          fill="none"
          stroke={s.color}
          strokeWidth={idx === 0 ? 2.75 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animationDelay: `${idx * 120}ms` }}
        />
      ))}
    </svg>
  );
}
