"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOnboarding } from "@/components/onboarding/context";
import { TopicsStep } from "@/components/onboarding/topics-step";
import { OnboardingShell } from "@/components/onboarding/shell";

export default function OnboardingTopicsPage() {
  const router = useRouter();
  const {
    loading,
    error,
    topics,
    topicMeta,
    setTopics,
    generateDiscovery,
    project,
  } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onContinue() {
    setBusy(true);
    setLocalError(null);
    try {
      const cleaned = topics.map((t) => t.trim()).filter(Boolean);
      if (cleaned.length === 0) {
        setLocalError("Select or add at least one topic.");
        setBusy(false);
        return;
      }
      setTopics(cleaned);
      await generateDiscovery({ topics: cleaned });
      router.push("/onboarding/prompts");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <OnboardingShell
        title="Loading…"
        stepHint="Let's customize your experience"
        previewKind="focus"
      >
        <p style={{ color: "var(--muted)" }}>Loading topics…</p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      stepHint="Let's customize your experience"
      title="Which topics should we track?"
      subtitle="Select one or several topic clusters. These drive prompt suggestions."
      previewKind="focus"
      domainLabel={project?.domain}
    >
      {(error || localError) && (
        <p className="ob-error">{localError ?? error}</p>
      )}
      <TopicsStep topics={topics} topicMeta={topicMeta} onChange={setTopics} />
      <div className="ob-actions">
        <button
          type="button"
          className="ob-btn-muted"
          onClick={() => router.push("/onboarding/profile")}
        >
          Back
        </button>
        <button
          type="button"
          className="ob-btn-black"
          disabled={busy}
          onClick={() => void onContinue()}
        >
          {busy ? "Generating prompts…" : "Continue"}
        </button>
      </div>
    </OnboardingShell>
  );
}
