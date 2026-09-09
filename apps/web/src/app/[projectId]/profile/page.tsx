"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = apiBase();

type Profile = {
  domain: string;
  name: string;
  industry: string;
  tagline: string;
  description: string;
  identityTags: string[];
  targetMarkets: string[];
  products: string[];
  personas: string[];
  reviewed: boolean;
};

export default function ProfilePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/v1/projects/${projectId}/brand-profile`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Failed to load profile");
        return;
      }
      const data = (await res.json()) as { profile: Profile };
      setProfile({
        ...data.profile,
        description: data.profile.description ?? "",
        identityTags: data.profile.identityTags ?? [],
        targetMarkets: data.profile.targetMarkets ?? [],
      });
    } catch {
      setError(`API unreachable at ${API}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    await fetch(`${API}/v1/projects/${projectId}/brand-profile`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, reviewed: true }),
    });
    setSaved(true);
  }

  if (error) return <p className="ob-error">{error}</p>;
  if (!profile) return <p className="geo-vis-note">Loading…</p>;

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>Brand profile</h1>
            <span className="geo-badge geo-badge-neutral">Workspace settings</span>
          </div>
          <p className="geo-page-lede">
            Identity AI uses when answering about your company — review before
            discovery.
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/billing`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Billing
          </Link>
          <button
            type="submit"
            form="brand-profile-form"
            className="geo-btn geo-btn-primary geo-btn-sm"
          >
            Save changes
          </button>
        </div>
      </header>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Primary domain</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {profile.domain || "—"}
          </p>
          <p className="geo-vis-kpi-meta">Canonical brand host</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Industry</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {profile.industry || "—"}
          </p>
          <p className="geo-vis-kpi-meta">Classification taxonomy</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Target markets</p>
          <p className="geo-vis-kpi-value">{profile.targetMarkets.length}</p>
          <p className="geo-vis-kpi-meta">Countries / regions listed</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Grounding review</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {profile.reviewed ? "Reviewed" : "Needs review"}
          </p>
          <p className="geo-vis-kpi-meta">Save marks profile reviewed</p>
        </article>
      </div>

      <div className="geo-pr-layout">
        <form
          id="brand-profile-form"
          onSubmit={(e) => void save(e)}
          className="geo-panel geo-vis-panel"
          style={{ display: "grid", gap: "0.85rem" }}
        >
          <h2 className="geo-section-title" style={{ marginTop: 0 }}>
            Entity identity
          </h2>
          {(
            [
              ["name", "Brand name"],
              ["domain", "Canonical domain"],
              ["industry", "Industry"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="geo-field">
              <span className="geo-field-label">{label}</span>
              <input
                className="geo-input"
                value={profile[key]}
                onChange={(e) =>
                  setProfile({ ...profile, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <label className="geo-field">
            <span className="geo-field-label">Tagline / description</span>
            <textarea
              className="geo-input"
              rows={3}
              value={profile.description}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  description: e.target.value,
                  tagline: e.target.value.slice(0, 160),
                })
              }
            />
          </label>
          <label className="geo-field">
            <span className="geo-field-label">Identity tags (comma-separated)</span>
            <input
              className="geo-input"
              value={profile.identityTags.join(", ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  identityTags: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="geo-field">
            <span className="geo-field-label">Target markets (comma-separated)</span>
            <input
              className="geo-input"
              value={profile.targetMarkets.join(", ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  targetMarkets: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="geo-field">
            <span className="geo-field-label">Products (comma-separated)</span>
            <input
              className="geo-input"
              value={profile.products.join(", ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  products: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="geo-field">
            <span className="geo-field-label">Personas (comma-separated)</span>
            <input
              className="geo-input"
              value={profile.personas.join(", ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  personas: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <div className="geo-vis-actions">
            <button type="submit" className="geo-btn geo-btn-primary">
              Save brand profile
            </button>
            {saved && <span className="geo-pr-success">Saved</span>}
          </div>
        </form>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Offline extraction
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Profile seeds can be extracted offline from your domain. Review
              fields before running Prompt Research.
            </p>
            <Link
              href={`/${projectId}/discovery`}
              className="geo-btn geo-btn-ghost geo-btn-sm"
            >
              Open Prompt Research
            </Link>
          </section>
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Related settings
            </h2>
            <div className="geo-vis-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <Link href={`/${projectId}/brands`} className="geo-btn geo-btn-ghost geo-btn-sm">
                Brands
              </Link>
              <Link href={`/${projectId}/topics`} className="geo-btn geo-btn-ghost geo-btn-sm">
                Topics &amp; tags
              </Link>
              <Link href={`/${projectId}/channels`} className="geo-btn geo-btn-ghost geo-btn-sm">
                Channels
              </Link>
              <Link href={`/${projectId}/settings/api-keys`} className="geo-btn geo-btn-ghost geo-btn-sm">
                API keys
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
