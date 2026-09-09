"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOnboarding } from "@/components/onboarding/context";
import { PromptsStep } from "@/components/onboarding/prompts-step";
import { OnboardingShell } from "@/components/onboarding/shell";

export default function OnboardingPromptsPage() {
  const router = useRouter();
  const {
    loading,
    error,
    prompts,
    selectedPrompts,
    setSelectedPrompts,
    activateSelected,
    generateDiscovery,
    topics,
    project,
  } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && prompts.length === 0 && topics.length > 0) {
      void generateDiscovery({ topics }).catch(() => undefined);
    }
  }, [loading, prompts.length, topics, generateDiscovery]);

  async function onContinue() {
    setBusy(true);
    setLocalError(null);
    try {
      if (selectedPrompts.size === 0) {
        setLocalError("Select at least one prompt to activate.");
        setBusy(false);
        return;
      }
      const count = await activateSelected();
      setMessage(`Activated ${count} prompts`);
      router.push("/onboarding/results");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Activate failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <OnboardingShell
        title="Loading…"
        stepHint="Let's customize your experience"
        previewKind="stats"
      >
        <p style={{ color: "var(--muted)" }}>Loading prompts…</p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      stepHint="Let's customize your experience"
      title="Which prompts should we monitor?"
      subtitle="Activate prompts GeoLens will collect across AI channels."
      previewKind="stats"
      domainLabel={project?.domain}
    >
      {(error || localError) && (
        <p className="ob-error">{localError ?? error}</p>
      )}
      {message && (
        <p style={{ color: "var(--positive)", fontSize: 13 }}>{message}</p>
      )}
      <PromptsStep
        prompts={prompts}
        selected={selectedPrompts}
        onChange={setSelectedPrompts}
      />
      <div className="ob-actions">
        <button
          type="button"
          className="ob-btn-muted"
          onClick={() => router.push("/onboarding/topics")}
        >
          Back
        </button>
        <button
          type="button"
          className="ob-btn-black"
          disabled={busy}
          onClick={() => void onContinue()}
        >
          {busy ? "Activating…" : "Continue"}
        </button>
      </div>
    </OnboardingShell>
  );
}
