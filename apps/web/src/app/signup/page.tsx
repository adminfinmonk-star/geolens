"use client";

import { apiBase } from "@/lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = apiBase();

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/v1/auth/signup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          org_name: orgName || undefined,
          project_name: "My first project",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Signup failed");
        return;
      }
      router.push(`/onboarding/project`);
    } catch {
      setError("Cannot reach API. Is it running on :3001?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem 1rem",
      }}
    >
      <div
        className="mk-card geo-page-enter"
        style={{ width: "min(420px, 100%)", padding: "1.75rem 1.5rem" }}
      >
        <Link
          href="/"
          style={{ fontWeight: 650, fontSize: 18, letterSpacing: "-0.04em" }}
        >
          GeoLens
        </Link>
        <h1 style={{ margin: "1.5rem 0 0.4rem", fontSize: "1.75rem" }}>
          Start free trial
        </h1>
        <p style={{ color: "var(--muted)", margin: "0 0 1.35rem" }}>
          Create your account, then finish a short setup funnel before the
          dashboard.
        </p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--space-1)" }}>
          <div className="geo-field">
            <label htmlFor="signup-name">Your name</label>
            <input
              id="signup-name"
              className="geo-input"
              required
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="geo-field">
            <label htmlFor="signup-email">Work email</label>
            <input
              id="signup-email"
              className="geo-input"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="geo-field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              className="geo-input"
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              aria-describedby="signup-password-hint"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span id="signup-password-hint" className="geo-field-hint">
              At least 8 characters.
            </span>
          </div>
          <div className="geo-field">
            <label htmlFor="signup-org">Organization name</label>
            <input
              id="signup-org"
              className="geo-input"
              autoComplete="organization"
              aria-describedby="signup-org-hint"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <span id="signup-org-hint" className="geo-field-hint">
              Optional — you can change this later.
            </span>
          </div>
          {error && (
            <p
              role="alert"
              className="geo-callout geo-callout-danger"
              style={{ margin: "0 0 var(--space-3)" }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="geo-btn geo-btn-primary"
            style={{ width: "100%" }}
          >
            {loading ? (
              <>
                <span className="geo-spinner" aria-hidden /> Creating…
              </>
            ) : (
              "Sign up"
            )}
          </button>
        </form>
        <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 14 }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
