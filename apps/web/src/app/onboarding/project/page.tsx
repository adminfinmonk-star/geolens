"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/components/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/shell";

const LOCATIONS = [
  "United States",
  "United Kingdom",
  "Germany",
  "India",
  "Australia",
  "Canada",
  "France",
];

function countryFromLocation(location: string): string {
  const map: Record<string, string> = {
    "United States": "US",
    "United Kingdom": "GB",
    Germany: "DE",
    India: "IN",
    Australia: "AU",
    Canada: "CA",
    France: "FR",
  };
  return map[location] ?? "US";
}

function timezoneFromLocation(location: string): string {
  const map: Record<string, string> = {
    "United States": "America/New_York",
    "United Kingdom": "Europe/London",
    Germany: "Europe/Berlin",
    India: "Asia/Kolkata",
    Australia: "Australia/Sydney",
    Canada: "America/Toronto",
    France: "Europe/Paris",
  };
  return map[location] ?? "America/New_York";
}

export default function OnboardingProjectPage() {
  const router = useRouter();
  const { loading, error, project, saveProject } = useOnboarding();
  const [domain, setDomain] = useState("");
  const [location, setLocation] = useState("United States");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);

  useEffect(() => {
    if (!project) return;
    setDomain(project.domain ?? "");
    setLocation(project.location ?? "United States");
  }, [project]);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      const host = domain
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]!
        .trim();
      if (!host) {
        setLocalError("Enter your website domain.");
        setBusy(false);
        return;
      }
      const brandName =
        host.split(".")[0]!.charAt(0).toUpperCase() +
        host.split(".")[0]!.slice(1);
      await saveProject({
        domain: host,
        name: project?.name && project.name !== "My first project"
          ? project.name
          : brandName,
        location,
        language: project?.language || "en",
        timezone: timezoneFromLocation(location),
        default_country: countryFromLocation(location),
      });
      router.push("/onboarding/profile");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function skipWebsite() {
    setBusy(true);
    setLocalError(null);
    try {
      await saveProject({
        domain: "mybrand.com",
        name: project?.name && project.name !== "My first project"
          ? project.name
          : "My brand",
        location,
        language: "en",
        timezone: timezoneFromLocation(location),
        default_country: countryFromLocation(location),
      });
      router.push("/onboarding/profile");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <OnboardingShell
        title="Loading…"
        stepHint="Let's get started"
        previewKind="analysis"
      >
        <p style={{ color: "var(--muted)" }}>Preparing your project…</p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      stepHint="Let's get started"
      title="Check your website's visibility"
      subtitle="Get realtime data and insights on your or your client's website"
      previewKind="analysis"
      domainLabel={domain || "yourwebsite.com"}
    >
      {(error || localError) && (
        <p className="ob-error">{localError ?? error}</p>
      )}
      <form onSubmit={(e) => void analyze(e)}>
        <label className="ob-field">
          <span className="sr-only">Website</span>
          <input
            className="ob-input"
            required
            placeholder="Enter your website"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            autoFocus
          />
        </label>

        {showExtras && (
          <label className="ob-field">
            <span>Primary market</span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="ob-btn-stack">
          <button type="submit" className="ob-btn-black" disabled={busy}>
            {busy ? "Analyzing…" : "Analyze website"}
          </button>
          <button
            type="button"
            className="ob-btn-muted"
            disabled={busy}
            onClick={() => void skipWebsite()}
          >
            I don&apos;t have a website
          </button>
        </div>
      </form>
      {!showExtras && (
        <button
          type="button"
          onClick={() => setShowExtras(true)}
          style={{
            marginTop: 14,
            background: "none",
            border: 0,
            color: "var(--muted)",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Set market &amp; language
        </button>
      )}
    </OnboardingShell>
  );
}
