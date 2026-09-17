"use client";

import { apiBase } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/components/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/shell";

const API = apiBase();

type PlanRow = {
  code: string;
  name: string;
  display_name: string;
  amount_cents: number;
  amount_cents_monthly: number;
  billing_period: string;
  max_active_prompts: number;
  max_channels: number;
  max_countries: number;
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/mo`;
}

export default function OnboardingPlanPage() {
  const router = useRouter();
  const { loading, projectId, project } = useOnboarding();
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selected, setSelected] = useState("starter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(
      `${API}/v1/projects/${projectId}/onboarding/plans?billing_period=${period}`,
      { credentials: "include" },
    );
    if (!res.ok) {
      setError("Failed to load plans");
      return;
    }
    const data = (await res.json()) as { plans: PlanRow[] };
    setPlans(data.plans);
    if (data.plans.some((p) => p.code === "starter")) {
      setSelected("starter");
    } else if (data.plans[0]) {
      setSelected(data.plans[0].code);
    }
  }, [projectId, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.code === selected) ?? plans[0],
    [plans, selected],
  );

  const altPlan = useMemo(
    () => plans.find((p) => p.code !== selected) ?? plans[1],
    [plans, selected],
  );

  async function complete(opts: {
    plan_code?: string;
    keep_trial?: boolean;
  }) {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/v1/projects/${projectId}/onboarding/complete`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_code: opts.plan_code,
            billing_period: period,
            keep_trial: opts.keep_trial,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "complete_failed");
      }
      if (!opts.keep_trial && opts.plan_code && opts.plan_code !== "trial") {
        const checkout = await fetch(
          `${API}/v1/projects/${projectId}/billing/checkout`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan_code: opts.plan_code,
              success_url: `${window.location.origin}/${projectId}/overview?checkout=success`,
              cancel_url: `${window.location.origin}/onboarding/plan`,
            }),
          },
        );
        if (!checkout.ok) {
          const failure = (await checkout.json()) as { error?: string };
          throw new Error(failure.error ?? "checkout_failed");
        }
        const data = (await checkout.json()) as {
          session?: { checkout_url?: string; id?: string; mode?: string };
        };
        if (data.session?.mode === "stripe" && data.session.checkout_url) {
          window.location.href = data.session.checkout_url;
          return;
        }
        if (data.session?.id) {
          const completeCheckout = await fetch(
            `${API}/v1/projects/${projectId}/billing/checkout/${data.session.id}/complete`,
            { method: "POST", credentials: "include" },
          );
          if (!completeCheckout.ok) throw new Error("checkout_completion_failed");
        }
      }
      router.push(`/${projectId}/overview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <OnboardingShell title="Loading…" stepHint="Choose plan" centered>
        <p style={{ color: "var(--muted)" }}>Loading plans…</p>
      </OnboardingShell>
    );
  }

  const domain = project?.domain || project?.name || "your brand";
  const priceLabel = selectedPlan
    ? formatPrice(
        period === "annual"
          ? Math.round(selectedPlan.amount_cents / 12)
          : selectedPlan.amount_cents,
      )
    : "";

  return (
    <OnboardingShell
      stepHint="Recommended for you"
      title="This is your best plan match"
      centered
      previewKind="none"
    >
      <p className="ob-plan-domain">
        <strong>{domain}</strong>, your ultimate solution for AI search
        visibility
      </p>

      {error && <p className="ob-error">{error}</p>}

      <div className="ob-plan-toggle" role="group" aria-label="Billing period">
        <button
          type="button"
          aria-pressed={period === "monthly"}
          onClick={() => setPeriod("monthly")}
        >
          Monthly
        </button>
        <button
          type="button"
          aria-pressed={period === "annual"}
          onClick={() => setPeriod("annual")}
        >
          Yearly
        </button>
      </div>

      <div className="ob-plan-tabs">
        {selectedPlan && (
          <button
            type="button"
            className="ob-plan-tab ob-plan-tab-on"
            onClick={() => setSelected(selectedPlan.code)}
          >
            <span className="ob-plan-tab-badge">for you</span>
            <strong>{selectedPlan.display_name}</strong>
            <span>
              {formatPrice(
                period === "annual"
                  ? Math.round(selectedPlan.amount_cents / 12)
                  : selectedPlan.amount_cents,
              )}
            </span>
          </button>
        )}
        {altPlan && (
          <button
            type="button"
            className={
              selected === altPlan.code
                ? "ob-plan-tab ob-plan-tab-on"
                : "ob-plan-tab"
            }
            onClick={() => setSelected(altPlan.code)}
          >
            <strong>{altPlan.display_name}</strong>
            <span>
              {formatPrice(
                period === "annual"
                  ? Math.round(altPlan.amount_cents / 12)
                  : altPlan.amount_cents,
              )}
            </span>
          </button>
        )}
      </div>

      {plans.length > 2 && (
        <div className="ob-plan-grid" style={{ marginBottom: "1.25rem" }}>
          {plans
            .filter(
              (p) =>
                p.code !== selectedPlan?.code && p.code !== altPlan?.code,
            )
            .map((p) => (
              <button
                key={p.code}
                type="button"
                className={
                  selected === p.code
                    ? "ob-plan-card ob-plan-card-on"
                    : "ob-plan-card"
                }
                onClick={() => setSelected(p.code)}
              >
                <strong>{p.display_name}</strong>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {formatPrice(
                    period === "annual"
                      ? Math.round(p.amount_cents / 12)
                      : p.amount_cents,
                  )}
                </span>
              </button>
            ))}
        </div>
      )}

      {selectedPlan && (
        <ul className="ob-plan-features">
          <li>
            <span>
              <strong>Prompt tracking:</strong>{" "}
              <em>up to {selectedPlan.max_active_prompts} active prompts</em>
            </span>
          </li>
          <li>
            <span>
              <strong>AI channels:</strong>{" "}
              <em>{selectedPlan.max_channels} models monitored</em>
            </span>
          </li>
          <li>
            <span>
              <strong>Markets:</strong>{" "}
              <em>{selectedPlan.max_countries} countries</em>
            </span>
          </li>
          <li>
            <span>
              <strong>AI visibility:</strong>{" "}
              <em>track performance in AI search</em>
            </span>
          </li>
          <li>
            <span>
              <strong>Brand performance:</strong>{" "}
              <em>monitor mentions &amp; sentiment</em>
            </span>
          </li>
          <li>
            <span>
              <strong>Competitive research:</strong>{" "}
              <em>benchmark and outperform</em>
            </span>
          </li>
        </ul>
      )}

      <p className="ob-plan-price-note">
        7 days free, then {priceLabel}
      </p>

      <div className="ob-btn-stack">
        <button
          type="button"
          className="ob-btn-black"
          disabled={busy || !selectedPlan}
          onClick={() =>
            void complete({ keep_trial: true, plan_code: "trial" })
          }
        >
          {busy ? "Working…" : "Get free trial"}
        </button>
        <button
          type="button"
          className="ob-btn-muted"
          disabled={busy || !selected}
          onClick={() => void complete({ plan_code: selected })}
        >
          Skip trial
        </button>
      </div>
    </OnboardingShell>
  );
}
