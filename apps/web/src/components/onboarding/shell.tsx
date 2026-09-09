"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const ONBOARDING_STEPS = [
  { id: "project", label: "Project", href: "/onboarding/project", n: 1 },
  { id: "profile", label: "Brand", href: "/onboarding/profile", n: 2 },
  { id: "topics", label: "Topics", href: "/onboarding/topics", n: 3 },
  { id: "prompts", label: "Prompts", href: "/onboarding/prompts", n: 4 },
  { id: "results", label: "Results", href: "/onboarding/results", n: 5 },
  { id: "plan", label: "Plan", href: "/onboarding/plan", n: 6 },
] as const;

type PreviewKind = "analysis" | "testimonial" | "stats" | "focus" | "none";

export function OnboardingShell({
  children,
  preview,
  previewKind = "analysis",
  title,
  subtitle,
  stepHint,
  domainLabel,
  centered,
}: {
  children: ReactNode;
  preview?: ReactNode;
  previewKind?: PreviewKind;
  title: string;
  subtitle?: string;
  stepHint?: string;
  domainLabel?: string;
  /** Plan-style single column */
  centered?: boolean;
}) {
  const pathname = usePathname();
  const current =
    ONBOARDING_STEPS.find((s) => pathname?.includes(`/onboarding/${s.id}`)) ??
    ONBOARDING_STEPS[0]!;
  const total = 5;
  const progressN = Math.min(current.n, total);

  const defaultPreview =
    previewKind === "none" || centered ? null : preview ?? (
      <>
        {previewKind === "analysis" && (
          <WebsiteAnalysisPreview domain={domainLabel || "yourwebsite.com"} />
        )}
        {previewKind === "testimonial" && <TestimonialPreview variant="role" />}
        {previewKind === "stats" && <StatsPreview />}
        {previewKind === "focus" && <TestimonialPreview variant="focus" />}
      </>
    );

  return (
    <div className={`ob-root${centered ? " ob-root-centered" : ""}`}>
      <div className={`ob-split${centered ? " ob-split-solo" : ""}`}>
        <section className="ob-pane-form">
          <header className="ob-pane-header">
            <Link href="/" className="ob-brand">
              <span className="mk-logo-mark" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="ob-brand-text">
                <strong>GeoLens</strong>
                <small>AI visibility</small>
              </span>
            </Link>
          </header>

          <div className="ob-pane-body geo-page-enter">
            <div
              className="ob-progress"
              role="progressbar"
              aria-valuenow={progressN}
              aria-valuemin={1}
              aria-valuemax={total}
              aria-label={`Step ${progressN} of ${total}`}
            >
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={
                    i + 1 < progressN
                      ? "ob-seg ob-seg-done"
                      : i + 1 === progressN
                        ? "ob-seg ob-seg-active"
                        : "ob-seg"
                  }
                />
              ))}
            </div>

            {stepHint && <p className="ob-eyebrow">{stepHint}</p>}
            <h1 className="ob-title">{title}</h1>
            {subtitle && <p className="ob-sub">{subtitle}</p>}
            {children}
          </div>
        </section>

        {!centered && defaultPreview && (
          <aside className="ob-pane-visual" aria-hidden>
            <div className="ob-visual-inner">{defaultPreview}</div>
          </aside>
        )}
      </div>
    </div>
  );
}

export function WebsiteAnalysisPreview({ domain }: { domain?: string }) {
  const host = domain?.trim() || "yourwebsite.com";
  return (
    <div className="ob-float-sheet">
      <p className="ob-float-domain">{host}</p>
      <div className="ob-sheet-grid">
        <div className="ob-sheet-card">
          <span className="ob-badge ob-badge-teal">Visibility</span>
          <p className="ob-sheet-title">AI mention analysis</p>
          <div className="ob-sheet-lines">
            <span />
            <span style={{ width: "72%" }} />
          </div>
          <svg className="ob-sheet-spark" viewBox="0 0 160 48" aria-hidden>
            <path
              d="M0 36 C20 34 28 20 48 22 C68 24 72 10 92 14 C112 18 120 28 140 18 L160 12"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M0 40 C24 38 36 30 56 32 C76 34 88 24 108 26 C128 28 140 34 160 28"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
        </div>
        <div className="ob-sheet-card">
          <span className="ob-badge ob-badge-ink">Potential</span>
          <p className="ob-sheet-title">Preparing growth recommendations</p>
          <ul className="ob-sheet-bullets">
            <li />
            <li />
            <li />
            <li />
          </ul>
        </div>
        <div className="ob-sheet-card ob-sheet-wide">
          <div className="ob-sheet-split">
            <div>
              <div className="ob-sheet-lines">
                <span />
                <span style={{ width: "85%" }} />
                <span style={{ width: "60%" }} />
              </div>
              <div className="ob-mini-bars" style={{ marginTop: 12 }}>
                <div className="ob-ghost-bar" style={{ width: "78%" }} />
                <div className="ob-ghost-bar" style={{ width: "62%" }} />
                <div className="ob-ghost-bar" style={{ width: "48%" }} />
              </div>
            </div>
            <div className="ob-donut" aria-hidden>
              <svg viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="28" fill="none" stroke="#e8eef2" strokeWidth="10" />
                <circle
                  cx="40"
                  cy="40"
                  r="28"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="10"
                  strokeDasharray="110 176"
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TestimonialPreview({
  variant = "role",
}: {
  variant?: "role" | "focus";
}) {
  if (variant === "focus") {
    return (
      <blockquote className="ob-quote-card">
        <span className="ob-quote-bar" aria-hidden />
        <p>
          I&apos;ve been using GeoLens for{" "}
          <strong>months</strong> now and heavily rely on it to help me move
          whatever brand I&apos;m working on{" "}
          <strong>into AI answers</strong>
        </p>
        <footer className="ob-quote-foot">
          <span className="ob-avatar" aria-hidden>
            C
          </span>
          <span>
            <strong>Casey Camilleri Marx</strong>
            <small>Digital Marketing Director</small>
          </span>
        </footer>
      </blockquote>
    );
  }

  return (
    <blockquote className="ob-quote-card">
      <span className="ob-quote-bar" aria-hidden />
      <p>
        GeoLens played a huge role in helping us{" "}
        <strong>identify where the biggest opportunities existed,</strong>{" "}
        monitor progress quickly, and continuously refine strategy based on
        real-time performance data
      </p>
      <footer className="ob-quote-foot">
        <span className="ob-avatar" aria-hidden>
          G
        </span>
        <span>
          <strong>Gabrielle Schneier</strong>
          <small>Sr. SEO Specialist, ForeFront Web</small>
        </span>
      </footer>
    </blockquote>
  );
}

export function StatsPreview() {
  return (
    <div className="ob-stats-card">
      <div className="ob-stats-head">
        <span className="ob-stats-icon" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 2L4 14h7l-1 8 10-14h-7l0-6z"
              fill="currentColor"
            />
          </svg>
        </span>
        <p>
          <strong>SureOak&apos;s</strong> results with GeoLens
        </p>
      </div>
      <div className="ob-stats-grid">
        <div>
          <span className="ob-stats-arrow" aria-hidden>
            ↑
          </span>
          <strong className="ob-stats-num">41%</strong>
          <span className="ob-stats-lbl">ChatGPT referral growth</span>
        </div>
        <div>
          <span className="ob-stats-arrow" aria-hidden>
            ↑
          </span>
          <strong className="ob-stats-num">286%</strong>
          <span className="ob-stats-lbl">AI Visibility growth</span>
        </div>
      </div>
    </div>
  );
}

/** @deprecated use WebsiteAnalysisPreview */
export function DashboardPreviewMock({
  brand = "Your brand",
}: {
  brand?: string;
}) {
  return <WebsiteAnalysisPreview domain={brand} />;
}
