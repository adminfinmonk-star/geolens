"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/components/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/shell";

const ROLES = [
  "Business owner / Entrepreneur",
  "Team member / Specialist",
  "Student / Intern",
  "Consultant / Freelancer",
  "Executive / Manager",
  "Other",
];

const EXPERIENCE = [
  "I need guidance for AI visibility",
  "I can work independently on most tasks",
  "I am a marketing / SEO expert",
  "Not sure yet",
];

const FOCUSES = [
  "AI visibility",
  "SEO optimization",
  "Content creation",
  "Competitor and market analysis",
  "PR",
  "Paid ads management",
  "Local marketing",
  "Not sure",
];

type Phase = "role" | "experience" | "focus" | "details";

export default function OnboardingProfilePage() {
  const router = useRouter();
  const { loading, error, profile, project, saveProfile, generateDiscovery } =
    useOnboarding();
  const [phase, setPhase] = useState<Phase>("role");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [focuses, setFocuses] = useState<string[]>(["AI visibility"]);
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDescription(profile.description || profile.tagline || "");
    setIndustry(profile.industry || "");
    const tags = profile.identityTags ?? [];
    const maybeRole = tags.find((t) => ROLES.includes(t));
    const maybeExp = tags.find((t) => EXPERIENCE.includes(t));
    if (maybeRole) setRole(maybeRole);
    if (maybeExp) setExperience(maybeExp);
    const focusTags = tags.filter((t) => FOCUSES.includes(t));
    if (focusTags.length) setFocuses(focusTags);
  }, [profile]);

  function toggleFocus(value: string) {
    setFocuses((prev) =>
      prev.includes(value)
        ? prev.filter((x) => x !== value)
        : [...prev, value],
    );
  }

  async function finish() {
    setBusy(true);
    setLocalError(null);
    try {
      const identityTags = [role, experience, ...focuses].filter(Boolean);
      await saveProfile({
        description:
          description ||
          `${project?.name || "Brand"} — AI visibility tracking for ${focuses.join(", ") || "search"}`,
        tagline: (description || industry || "AI visibility").slice(0, 160),
        industry: industry || focuses[0] || "Marketing",
        identityTags,
        targetMarkets: profile?.targetMarkets?.length
          ? profile.targetMarkets
          : [project?.location ?? "United States"],
        products: profile?.products ?? [],
        reviewed: true,
      });
      await generateDiscovery();
      router.push("/onboarding/topics");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !profile) {
    return (
      <OnboardingShell
        title="Loading…"
        stepHint="Let's customize your experience"
        previewKind="testimonial"
      >
        <p style={{ color: "var(--muted)" }}>Loading brand profile…</p>
      </OnboardingShell>
    );
  }

  if (phase === "role") {
    return (
      <OnboardingShell
        stepHint="Let's customize your experience"
        title="What best describes your role?"
        previewKind="testimonial"
      >
        <div className="ob-choice-list" role="radiogroup" aria-label="Role">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              className={role === r ? "ob-choice ob-choice-on" : "ob-choice"}
              onClick={() => setRole(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="ob-btn-stack">
          <button
            type="button"
            className="ob-btn-black"
            disabled={!role}
            onClick={() => setPhase("experience")}
          >
            Continue
          </button>
        </div>
      </OnboardingShell>
    );
  }

  if (phase === "experience") {
    return (
      <OnboardingShell
        stepHint="Let's customize your experience"
        title="What's your experience with digital marketing?"
        previewKind="stats"
      >
        <div className="ob-choice-list" role="radiogroup" aria-label="Experience">
          {EXPERIENCE.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={experience === r}
              className={
                experience === r ? "ob-choice ob-choice-on" : "ob-choice"
              }
              onClick={() => setExperience(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="ob-actions">
          <button
            type="button"
            className="ob-btn-muted"
            onClick={() => setPhase("role")}
          >
            Back
          </button>
          <button
            type="button"
            className="ob-btn-black"
            disabled={!experience}
            onClick={() => setPhase("focus")}
          >
            Continue
          </button>
        </div>
      </OnboardingShell>
    );
  }

  if (phase === "focus") {
    return (
      <OnboardingShell
        stepHint="Let's customize your experience"
        title="What are your main marketing focuses?"
        subtitle="Select one or several options:"
        previewKind="focus"
      >
        <div className="ob-choice-list" role="group" aria-label="Focuses">
          {FOCUSES.map((f) => (
            <label
              key={f}
              className={
                focuses.includes(f) ? "ob-choice ob-choice-on" : "ob-choice"
              }
            >
              <input
                type="checkbox"
                checked={focuses.includes(f)}
                onChange={() => toggleFocus(f)}
              />
              {f}
            </label>
          ))}
        </div>
        <div className="ob-actions">
          <button
            type="button"
            className="ob-btn-muted"
            onClick={() => setPhase("experience")}
          >
            Back
          </button>
          <button
            type="button"
            className="ob-btn-black"
            disabled={focuses.length === 0}
            onClick={() => setPhase("details")}
          >
            Continue
          </button>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      stepHint="Almost ready"
      title="Describe your brand"
      subtitle="A short description helps us generate better topics and prompts."
      previewKind="analysis"
      domainLabel={project?.domain || profile.domain || "yourwebsite.com"}
    >
      {(error || localError) && (
        <p className="ob-error">{localError ?? error}</p>
      )}
      <label className="ob-field">
        <span>Description</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does your brand do?"
        />
      </label>
      <label className="ob-field">
        <span>Industry</span>
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="B2B SaaS / ecommerce / agency"
        />
      </label>
      <div className="ob-actions">
        <button
          type="button"
          className="ob-btn-muted"
          onClick={() => setPhase("focus")}
        >
          Back
        </button>
        <button
          type="button"
          className="ob-btn-black"
          disabled={busy}
          onClick={() => void finish()}
        >
          {busy ? "Generating topics…" : "Continue"}
        </button>
      </div>
    </OnboardingShell>
  );
}
