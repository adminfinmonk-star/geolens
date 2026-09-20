"use client";

import { apiBase } from "@/lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = apiBase();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Login failed");
        return;
      }
      const project = data.project as
        | { id?: string; status?: string }
        | undefined;
      if (project?.status === "ONBOARDING") {
        router.push("/onboarding/project");
      } else {
        router.push(`/${project?.id ?? "prj_demo"}/overview`);
      }
    } catch {
      setError("Cannot reach API on :3001");
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
        style={{ width: "min(400px, 100%)", padding: "1.75rem 1.5rem" }}
      >
        <Link
          href="/"
          style={{ fontWeight: 650, fontSize: 18, letterSpacing: "-0.04em" }}
        >
          GeoLens
        </Link>
        <h1 style={{ margin: "1.5rem 0 0.4rem", fontSize: "1.75rem" }}>
          Log in
        </h1>
        <p style={{ color: "var(--muted)", margin: "0 0 1.35rem" }}>
          Welcome back to your workspace.
        </p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--space-1)" }}>
          <div className="geo-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="geo-input"
              required
              type="email"
              autoComplete="email"
              autoFocus
              aria-invalid={error ? true : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="geo-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="geo-input"
              required
              type="password"
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
                <span className="geo-spinner" aria-hidden /> Signing in…
              </>
            ) : (
              "Log in"
            )}
          </button>
        </form>
        <p><Link href="/forgot-password">Forgot your password?</Link></p>
        <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 14 }}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
