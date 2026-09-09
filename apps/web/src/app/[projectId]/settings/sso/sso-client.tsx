"use client";

import { apiBase } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API = apiBase();

type SsoState = {
  available: boolean;
  configured: boolean;
  idp_entity_id: string | null;
  idp_sso_url: string | null;
  message?: string;
};

export function SsoSettingsClient({ projectId }: { projectId: string }) {
  const [sso, setSso] = useState<SsoState | null>(null);
  const [entity, setEntity] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [metadata, setMetadata] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/v1/projects/${projectId}/sso`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError(`Failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as SsoState;
      setSso(body);
      setEntity(body.idp_entity_id ?? "");
      setUrl(body.idp_sso_url ?? "");
      setError(null);
    } catch {
      setError(`API unreachable at ${API}`);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    void fetch(`${API}/v1/saml/metadata`, { credentials: "include" })
      .then((r) => r.text())
      .then(setMetadata)
      .catch(() => setMetadata(null));
  }, [load]);

  async function save() {
    const res = await fetch(`${API}/v1/projects/${projectId}/sso`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idp_entity_id: entity,
        idp_sso_url: url,
        idp_certificate_present: true,
      }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setSaved(true);
    await load();
  }

  async function startLogin() {
    const res = await fetch(`${API}/v1/projects/${projectId}/sso/login`, {
      credentials: "include",
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.message ?? body.error);
      return;
    }
    window.location.href = body.redirect_url;
  }

  return (
    <div className="geo-vis">
      <header className="geo-vis-header">
        <div>
          <div className="geo-vis-title-row">
            <h1>SSO &amp; SAML</h1>
            <span className="geo-badge geo-badge-neutral">Enterprise auth</span>
          </div>
          <p className="geo-page-lede">
            {sso?.message ??
              "Configure IdP for workspace single sign-on. ACS posts to /v1/saml/acs."}
          </p>
        </div>
        <div className="geo-vis-actions">
          <Link
            href={`/${projectId}/billing`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            Billing
          </Link>
          <Link
            href={`/${projectId}/settings/api-keys`}
            className="geo-btn geo-btn-ghost geo-btn-sm"
          >
            API keys
          </Link>
        </div>
      </header>

      <div className="geo-vis-kpis">
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">SSO status</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {!sso
              ? "—"
              : sso.configured
                ? "Configured"
                : sso.available
                  ? "Available"
                  : "Unavailable"}
          </p>
          <p className="geo-vis-kpi-meta">IdP connection</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Protocol</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            SAML 2.0
          </p>
          <p className="geo-vis-kpi-meta">Enterprise IdP</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">Plan gate</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {sso?.available ? "Open" : "Enterprise"}
          </p>
          <p className="geo-vis-kpi-meta">Feature availability</p>
        </article>
        <article className="geo-vis-kpi">
          <p className="geo-vis-kpi-label">SP metadata</p>
          <p className="geo-vis-kpi-value" style={{ fontSize: "1.15rem" }}>
            {metadata ? "Ready" : "—"}
          </p>
          <p className="geo-vis-kpi-meta">Download below</p>
        </article>
      </div>

      {error && <p className="ob-error">{error}</p>}

      <div className="geo-pr-layout">
        <div style={{ display: "grid", gap: "1rem" }}>
          {sso?.available ? (
            <section
              className="geo-panel geo-vis-panel"
              style={{ display: "grid", gap: 12 }}
            >
              <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                Identity provider
              </h2>
              <label className="geo-field">
                <span className="geo-field-label">IdP entity ID</span>
                <input
                  className="geo-input"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  placeholder="https://idp.example.com/entity"
                />
              </label>
              <label className="geo-field">
                <span className="geo-field-label">IdP SSO URL</span>
                <input
                  className="geo-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://idp.example.com/sso"
                />
              </label>
              <p className="geo-vis-note" style={{ margin: 0 }}>
                Certificate presence is recorded when you save. Upload/rotation
                wiring can be extended later.
              </p>
              <div className="geo-vis-actions">
                <button
                  type="button"
                  className="geo-btn geo-btn-primary geo-btn-sm"
                  onClick={() => void save()}
                >
                  {sso.configured ? "Update IdP" : "Save IdP"}
                </button>
                {sso.configured && (
                  <button
                    type="button"
                    className="geo-btn geo-btn-ghost geo-btn-sm"
                    onClick={() => void startLogin()}
                  >
                    Test IdP redirect
                  </button>
                )}
                {saved && <span className="geo-pr-success">Saved</span>}
              </div>
            </section>
          ) : (
            <section className="geo-panel geo-vis-panel">
              <h2 className="geo-section-title" style={{ marginTop: 0 }}>
                Enterprise required
              </h2>
              <p className="geo-vis-note" style={{ marginTop: 0 }}>
                SSO / SAML is available on enterprise plans. Upgrade billing to
                unlock IdP configuration.
              </p>
              <Link
                href={`/${projectId}/billing`}
                className="geo-btn geo-btn-primary geo-btn-sm"
              >
                Open billing
              </Link>
            </section>
          )}

          {metadata && (
            <section className="geo-panel geo-vis-panel">
              <div className="geo-vis-title-row">
                <h2 className="geo-section-title" style={{ margin: 0 }}>
                  Service provider metadata
                </h2>
                <a
                  className="geo-btn geo-btn-ghost geo-btn-sm"
                  href={`${API}/v1/saml/metadata`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open raw
                </a>
              </div>
              <pre
                className="geo-chat-answer"
                style={{
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  fontSize: 12,
                  background: "var(--bg-soft)",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-sm, 8px)",
                  overflow: "auto",
                  maxHeight: 280,
                }}
              >
                {metadata}
              </pre>
            </section>
          )}
        </div>

        <aside className="geo-pr-side">
          <section className="geo-panel geo-vis-panel">
            <h2 className="geo-section-title" style={{ marginTop: 0 }}>
              Security
            </h2>
            <p className="geo-vis-note" style={{ marginTop: 0 }}>
              Prefer IdP-initiated or SP-initiated SSO for enterprise users.
              Keep certificates rotated and ACS URL allowlisted in your IdP.
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
                href={`/${projectId}/billing`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Billing &amp; plan
              </Link>
              <Link
                href={`/${projectId}/profile`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
              >
                Brand profile
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
