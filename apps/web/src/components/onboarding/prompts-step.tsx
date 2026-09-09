"use client";

export type PromptSug = {
  text: string;
  country_code: string;
  topic: string;
  branding: string;
  intent_type: string;
  persona: string;
  volume_score: number;
};

type Props = {
  prompts: PromptSug[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
};

export function PromptsStep({ prompts, selected, onChange }: Props) {
  function toggle(text: string) {
    const next = new Set(selected);
    if (next.has(text)) next.delete(text);
    else next.add(text);
    onChange(next);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Select one or several options · {selected.size} selected
        </p>
        <button
          type="button"
          className="ob-btn-muted"
          style={{
            width: "auto",
            minHeight: 32,
            padding: "0.25rem 0.75rem",
            fontSize: 12,
          }}
          onClick={() => onChange(new Set(prompts.map((p) => p.text)))}
        >
          Select all
        </button>
      </div>
      <div className="ob-choice-list" role="group" aria-label="Prompts">
        {prompts.map((p) => {
          const on = selected.has(p.text);
          return (
            <label
              key={`${p.text}-${p.country_code}`}
              className={on ? "ob-choice ob-choice-on" : "ob-choice"}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(p.text)}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontWeight: 650, display: "block" }}>
                  {p.text}
                </strong>
                <small
                  style={{
                    color: "var(--muted)",
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {p.country_code} · {p.topic} · {p.intent_type}
                </small>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
