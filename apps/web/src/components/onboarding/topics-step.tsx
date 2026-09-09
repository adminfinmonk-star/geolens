"use client";

type Props = {
  topics: string[];
  topicMeta: Array<{ name: string; reason: string }>;
  onChange: (topics: string[]) => void;
};

export function TopicsStep({ topics, topicMeta, onChange }: Props) {
  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
        Select one or several options:
      </p>
      <div className="ob-choice-list" role="group" aria-label="Topics">
        {topics.map((t, i) => (
          <label key={`${t}-${i}`} className="ob-choice ob-choice-on">
            <input
              type="checkbox"
              checked
              onChange={() => onChange(topics.filter((_, j) => j !== i))}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <input
                style={{
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  color: "inherit",
                  fontWeight: 650,
                  fontSize: "0.95rem",
                }}
                value={t}
                onChange={(e) => {
                  const next = [...topics];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              {topicMeta.find((m) => m.name === t)?.reason && (
                <small
                  style={{
                    display: "block",
                    color: "var(--muted)",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {topicMeta.find((m) => m.name === t)?.reason}
                </small>
              )}
            </span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="ob-btn-muted"
        style={{ width: "auto", minHeight: 40, padding: "0.5rem 1rem" }}
        onClick={() => onChange([...topics, "New topic"])}
      >
        + Add topic
      </button>
    </div>
  );
}
