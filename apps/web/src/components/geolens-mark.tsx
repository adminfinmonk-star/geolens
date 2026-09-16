/** GeoLens brand mark — lens + globe meridian. */
export function GeoLensMark({
  className,
  title = "GeoLens",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Soft plate */}
      <rect width="32" height="32" rx="9" fill="currentColor" opacity="0.12" />
      {/* Outer lens ring */}
      <circle
        cx="16"
        cy="16"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Globe meridian */}
      <ellipse
        cx="16"
        cy="16"
        rx="4.2"
        ry="10"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
      {/* Equator */}
      <path
        d="M6.5 16h19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Focus spark */}
      <circle cx="16" cy="16" r="2.1" fill="currentColor" />
    </svg>
  );
}
