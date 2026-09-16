"use client";

import { useId, useState, type CSSProperties, type MouseEvent } from "react";

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

function fmtShort(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(Math.round(n));
}

function formatAxisDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function TrendChart({
  series,
  labels,
  ariaLabel = "Visibility trend",
  legendValue = "last",
}: {
  series: {
    label: string;
    points: number[];
    color: string;
    dashed?: boolean;
    total?: number;
  }[];
  labels?: string[];
  ariaLabel?: string;
  legendValue?: "last" | "sum";
}) {
  const clipId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = 220;
  const padL = 36;
  const padR = 16;
  const padT = 12;
  const padB = labels?.length ? 28 : 14;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(...series.flatMap((s) => s.points), 1);
  const count = Math.max(...series.map((s) => s.points.length), 1);

  function xAt(i: number, n: number) {
    if (n <= 1) return padL + innerW / 2;
    return padL + (i / (n - 1)) * innerW;
  }

  function yAt(v: number) {
    return padT + innerH - (v / max) * innerH;
  }

  function pathFor(points: number[]) {
    const pts = points.length === 1 ? [points[0]!, points[0]!] : points;
    return pts
      .map((p, i) => {
        const x = xAt(i, pts.length);
        const y = yAt(p);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function areaFor(points: number[]) {
    const pts = points.length === 1 ? [points[0]!, points[0]!] : points;
    const line = pathFor(pts);
    const x0 = xAt(0, pts.length);
    const x1 = xAt(pts.length - 1, pts.length);
    return `${line} L${x1.toFixed(1)},${(padT + innerH).toFixed(1)} L${x0.toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  }

  const yTicks = [0, 0.5, 1];
  const xTicks =
    labels && labels.length > 0
      ? Array.from(
          new Set(
            [0, Math.floor((labels.length - 1) / 2), labels.length - 1].filter(
              (i) => i >= 0 && i < labels.length,
            ),
          ),
        )
      : [];

  const active = hover ?? count - 1;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    const t = (loc.x - padL) / innerW;
    const i = Math.round(Math.max(0, Math.min(1, t)) * (count - 1));
    setHover(i);
  }

  const hoverLabel = labels?.[active];

  return (
    <div className="geo-trend">
      <ul className="geo-trend-legend">
        {series.map((s) => {
          const last = s.points[s.points.length - 1] ?? 0;
          const summed = s.points.reduce((a, b) => a + b, 0);
          const value =
            s.total ?? (legendValue === "sum" ? summed : last);
          return (
            <li
              key={s.label}
              data-dashed={s.dashed ? "true" : undefined}
              style={{ "--swatch": s.color } as CSSProperties}
            >
              <i aria-hidden />
              <span>{s.label}</span>
              <strong>{fmtShort(value)}</strong>
            </li>
          );
        })}
      </ul>
      <div className="geo-trend-frame">
        <svg
          className="geo-trend-svg"
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          role="img"
          aria-label={ariaLabel}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={padL} y={padT} width={innerW} height={innerH} />
            </clipPath>
          </defs>
          {yTicks.map((g) => {
            const y = yAt(g * max);
            return (
              <g key={g}>
                <line
                  x1={padL}
                  x2={w - padR}
                  y1={y}
                  y2={y}
                  stroke="var(--line)"
                  strokeDasharray={g === 0 ? undefined : "3 4"}
                  strokeWidth="1"
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="geo-trend-axis"
                >
                  {fmtShort(g * max)}
                </text>
              </g>
            );
          })}
          {xTicks.map((i) => (
            <text
              key={i}
              x={xAt(i, count)}
              y={h - 8}
              textAnchor={
                i === 0 ? "start" : i === count - 1 ? "end" : "middle"
              }
              className="geo-trend-axis"
            >
              {formatAxisDate(labels![i]!)}
            </text>
          ))}
          <g clipPath={`url(#${clipId})`}>
            {series[0] ? (
              <path
                d={areaFor(series[0].points)}
                fill={series[0].color}
                opacity="0.12"
              />
            ) : null}
            {series.map((s, idx) => (
              <path
                key={s.label}
                className={s.dashed ? "geo-chart-line is-dashed" : "geo-chart-line"}
                d={pathFor(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={idx === 0 ? 2.75 : s.dashed ? 2.35 : 2.15}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animationDelay: `${idx * 90}ms` }}
              />
            ))}
          </g>
          {hover != null ? (
            <line
              x1={xAt(active, count)}
              x2={xAt(active, count)}
              y1={padT}
              y2={padT + innerH}
              stroke="var(--ink)"
              strokeOpacity="0.22"
              strokeWidth="1"
            />
          ) : null}
          {series.map((s) => {
            const pts = s.points.length === 1 ? [s.points[0]!, s.points[0]!] : s.points;
            const n = pts.length;
            const i = Math.min(active, n - 1);
            const v = pts[i] ?? 0;
            return (
              <circle
                key={`${s.label}-dot`}
                cx={xAt(i, n)}
                cy={yAt(v)}
                r={hover == null && i !== n - 1 ? 0 : 4.5}
                fill={s.color}
                stroke="var(--bg-elevated)"
                strokeWidth="2"
              />
            );
          })}
        </svg>
        {hover != null && hoverLabel ? (
          <div
            className="geo-trend-tip"
            style={{
              left: `${((xAt(active, count) / w) * 100).toFixed(1)}%`,
            }}
          >
            <p>{formatAxisDate(hoverLabel)}</p>
            {series.map((s) => (
              <span
                key={s.label}
                style={{ "--swatch": s.color } as CSSProperties}
              >
                <i aria-hidden />
                {s.label} {fmtShort(s.points[active] ?? 0)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
