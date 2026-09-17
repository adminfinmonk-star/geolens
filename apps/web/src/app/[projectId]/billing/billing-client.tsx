"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API_BASE = apiBase();

type PlanRow = {
  code: string;
  name: string;
  track: string;
  amount_cents: number;
  features: Record<string, boolean>;
};

type Billing = {
  plan: {
    code: string;
    name: string;
    track: string;
    features: Record<string, boolean>;
  };
  limits: {
    max_active_prompts: number;
    max_channels: number;
    max_countries: number;
    bot_visit_limit: number;
    credits_total: number | null;
  };
  usage: {
    active_prompts: number;
    enabled_channels: number;
    countries: number;
    bot_visits_used: number;
    credits_allocated: number;
    project_status: string;
  };
  banners: { bot_quota_exhausted: boolean; project_paused: boolean };
  pause: { paused_at: string | null; warning: string };
  billing: {
    stripe_customer_id: string | null;
    subscription_status: string;
    mode: string;
  };
  sso: {
    available: boolean;
    configured: boolean;
    idp_entity_id: string | null;
    idp_sso_url: string | null;
    message?: string;
  };
  plans?: PlanRow[];
};

function usagePct(used: number, max: number) {
  if (!max) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export function BillingClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/billing`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError(`Failed to load billing (${res.status})`);
        return;
      }
      const json = (await res.json()) as Billing;
      setData(json);
      setError(null);
    } catch {
      setError(`API unreachable at ${API_BASE}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      void (async () => {
        window.history.replaceState({}, "", `/${projectId}/billing`);
        // Stripe checkout is finalized only by the signed webhook. Give that
        // durable event a moment to arrive, then refresh the displayed status.
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        await load();
      })();
    }
  }, [projectId, load]);

  async function pause() {
    if (
      !confirm(
        "Pausing stops all prompts and permanently loses data for the paused period. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`${API_BASE}/v1/projects/${projectId}/pause`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acknowledge_data_loss: true }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  async function unpause() {
    setBusy(true);
    await fetch(`${API_BASE}/v1/projects/${projectId}/unpause`, {
      method: "POST",
      credentials: "include",
    });
    setBusy(false);
    await load();
  }

  async function checkout(planCode: string) {
    setBusy(true);
    const res = await fetch(
      `${API_BASE}/v1/projects/${projectId}/billing/checkout`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_code: planCode }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const body = (await res.json()) as {
      session: { id: string; checkout_url: string; mode: string };
    };
    if (body.session.mode === "mock") {
      await fetch(
        `${API_BASE}/v1/projects/${projectId}/billing/checkout/${body.session.id}/complete`,
        { method: "POST", credentials: "include" },
      );
      await load();
      return;
    }
    window.location.href = body.session.checkout_url;
  }

  if (!data) {
    return (
      <p className={error ? "ob-error" : "geo-vis-note"}>
        {error ?? "Loading billing…"}
      </p>
    );
  }

  const { plan, limits, usage, banners, pause: pauseInfo, billing, sso, plans } =
    data;
  const promptPct = usagePct(usage.active_prompts, limits.max_active_prompts);
  const botPct = usagePct(usage.bot_visits_used, limits.bot_visit_limit);
  const channelPct = usagePct(usage.enabled_channels, limits.max_channels);

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Billing</h1>
            <span className="geo-badge geo-badge-neutral">Workspace plan</span>
          </div>
          <p className="geo-page-lede">
            Plan, usage, and checkout for this workspace. Mode: {billing.mode}
            {billing.subscription_status !== "none"
              ? ` · subscription ${billing.subscription_status}`
              : ""}
            .
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/settings/api-keys`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            API keys
          </Link>
          <Link
            href={`/${projectId}/settings/sso`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            SSO
          </Link>
        </div>
      </header>

      {banners.bot_quota_exhausted && (
        <p className="ob-error" style={{ marginBottom: "1rem" }}>
          Bot-visit limit reached for this month. Gaps mean limit reached, not
          zero crawl activity.
        </p>
      )}
      {banners.project_paused && (
        <p className="ob-error" style={{ marginBottom: "1rem" }}>
          Project paused since {pauseInfo.paused_at ?? "—"}. {pauseInfo.warning}
        </p>
      )}
      {error && <p className="ob-error">{error}</p>}

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Plan</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {plan.name}
          </p>
          <p className="geo-vis-kpi-meta">
            {plan.code} · {plan.track}
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Prompt quota</p>
          <p className="geo-vis-kpi-value">{promptPct}%</p>
          <p className="geo-vis-kpi-meta">
            {usage.active_prompts} / {limits.max_active_prompts}
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Channels</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {usage.enabled_channels}/{limits.max_channels}
          </p>
          <p className="geo-vis-kpi-meta">
            {usage.countries}/{limits.max_countries} countries
          </p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Status</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {usage.project_status}
          </p>
          <p className="geo-vis-kpi-meta">Workspace lifecycle</p>
        </article>
      </div>

      <div className="geo-pr-layout">
        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="geo-panel geo-vis-panel">
            <div className="geo-vis-title-row">
              <h2 className="geo-section-title" style={{ margin: 0 }}>
                Current plan
              </h2>
              <span className="geo-badge geo-badge-neutral">{plan.name}</span>
            </div>
            <p className="geo-vis-note">
              Upgrade via checkout below
              {billing.mode === "mock" ? " (mock mode — no Stripe keys)" : ""}.
              SSO:{" "}
              {sso.configured
                ? "configured"
                : sso.available
                  ? "available"
                  : "enterprise required"}
              .
            </p>
            <div className="geo-vis-actions">
              {usage.project_status === "PAUSED" ? (
                <button
                  type="button"
                  className="geo-btn geo-btn-primary geo-btn-sm"
                  disabled={busy}
                  onClick={() => void unpause()}
                >
                  Resume project
                </button>
              ) : (
                <button
                  type="button"
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                  disabled={busy}
                  onClick={() => void pause()}
                >
                  Pause project
                </button>
              )}
            </div>
          </section>

          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Usage
            </h2>
            {(
              [
                [
                  "Active prompts",
                  usage.active_prompts,
                  limits.max_active_prompts,
                  promptPct,
                ],
                [
                  "Channels",
                  usage.enabled_channels,
                  limits.max_channels,
                  channelPct,
                ],
                [
                  "Bot visits",
                  usage.bot_visits_used,
                  limits.bot_visit_limit,
                  botPct,
                ],
              ] as const
            ).map(([label, used, max, pct]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span className="geo-vis-note" style={{ margin: 0 }}>
                    {used.toLocaleString()} / {max.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div className="geo-vis-bar-track">
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
            <p className="geo-vis-note" style={{ marginBottom: 0 }}>
              Credits allocated:{" "}
              {limits.credits_total != null
                ? `${usage.credits_allocated} / ${limits.credits_total}`
                : `${usage.credits_allocated} (brand plan)`}
            </p>
          </section>

          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Upgrade
            </h2>
            <div className="geo-vis-actions" style={{ flexWrap: "wrap" }}>
              {(plans ?? [])
                .filter((p) => p.code !== "trial" && p.code !== plan.code)
                .map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    className="geo-btn geo-btn-primary geo-btn-sm"
                    disabled={busy}
                    onClick={() => void checkout(p.code)}
                  >
                    {p.name}
                    {p.amount_cents > 0
                      ? ` · $${(p.amount_cents / 100).toFixed(0)}/mo`
                      : " · contact"}
                  </button>
                ))}
              {(plans ?? []).filter(
                (p) => p.code !== "trial" && p.code !== plan.code,
              ).length === 0 && (
                <p className="geo-vis-note" style={{ margin: 0 }}>
                  No upgrade options for the current plan.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              What counts toward quota
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Active tracked prompts, enabled channels, countries, and bot
              visits are enforced server-side. Exhausted bot quota shows as
              limit reached — not empty crawl activity.
            </p>
          </section>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Related
            </h2>
            <div
              className="geo-vis-actions"
              style={{ flexDirection: "column", alignItems: "stretch" }}
            >
              <Link
                href={`/${projectId}/channels`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Channels
              </Link>
              <Link
                href={`/${projectId}/settings/sso`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Configure SSO
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
