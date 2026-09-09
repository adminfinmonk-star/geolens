"use client";

import { apiBase } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/components/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/shell";

const API = apiBase();

type BrandRow = {
  brand_id: string;
  brand_name: string;
  is_own: boolean;
  visibility?: number;
  share_of_voice?: number;
};

export default function OnboardingResultsPage() {
  const router = useRouter();
  const { loading, projectId, project, profile, selectedPrompts } =
    useOnboarding();
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [metaNote, setMetaNote] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      try {
        const res = await fetch(
          `${API}/v1/projects/${projectId}/reports/brands`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          rows?: BrandRow[];
          meta?: { surface_kinds?: string[]; geo_note?: string };
        };
        setRows(data.rows?.slice(0, 6) ?? []);
        const surfaces = data.meta?.surface_kinds?.join(", ") || "api / simulator";
        setMetaNote(
          `Sample visibility from current project data (${surfaces}). Collection uses provider APIs or fixtures — not Peec-style UI scraping.`,
        );
      } catch {
        setMetaNote(
          "Sample results will populate after collection runs. Mode: API / simulator.",
        );
      }
    })();
  }, [projectId]);

  if (loading) {
    return (
      <OnboardingShell title="Loading…" stepHint="Sample results">
        <p style={{ color: "var(--muted)" }}>Loading sample results…</p>
      </OnboardingShell>
    );
  }

  const brand = profile?.name || project?.name || "Your brand";

  return (
    <OnboardingShell
      stepHint="Sample results"
      title="Here's a first look"
      subtitle={`Early visibility for ${brand}. Activate a plan next to keep collecting.`}
      previewKind="analysis"
      domainLabel={project?.domain || brand}
    >
      {metaNote && (
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          {metaNote}
        </p>
      )}
      <div className="ob-results-grid">
        <div className="ob-result-block">
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            Brand visibility teaser
          </div>
          {rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14 }}>
              No chats yet — activated {selectedPrompts.size || "your"} prompts
              will fill this table after the next collect cycle.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ padding: "4px 0" }}>Brand</th>
                  <th>Visibility</th>
                  <th>SoV</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.brand_id}
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <td style={{ padding: "8px 0", fontWeight: r.is_own ? 700 : 500 }}>
                      {r.brand_name}
                      {r.is_own ? " (you)" : ""}
                    </td>
                    <td>
                      {r.visibility != null
                        ? `${Math.round(r.visibility * 100)}%`
                        : "—"}
                    </td>
                    <td>
                      {r.share_of_voice != null
                        ? `${Math.round(r.share_of_voice * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="ob-btn-stack" style={{ marginTop: "1.25rem" }}>
        <button
          type="button"
          className="ob-btn-black"
          onClick={() => router.push("/onboarding/plan")}
        >
          Get started
        </button>
        <button
          type="button"
          className="ob-btn-muted"
          onClick={() => router.push("/onboarding/prompts")}
        >
          Back
        </button>
      </div>
    </OnboardingShell>
  );
}
