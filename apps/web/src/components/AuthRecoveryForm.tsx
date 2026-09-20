"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiBase } from "@/lib/api";

export function AuthRecoveryForm({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const tokenRead = useRef(false);
  useEffect(() => {
    if (reset && !tokenRead.current) {
      tokenRead.current = true;
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
      setToken(value);
      window.history.replaceState(null, "", window.location.pathname);
      if (!value) setError("Reset link is missing. Request a new link.");
    }
  }, [reset]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (reset && password !== confirmation) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const response = await fetch(`${apiBase()}/v1/auth/${reset ? "reset-password" : "forgot-password"}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { token, password } : { email }),
      });
      const body = await response.json();
      if (!response.ok) { setError(body.message ?? "Unable to complete the request. Please try again."); return; }
      setMessage(body.message);
      setDone(true);
      setPassword(""); setConfirmation(""); setToken("");
    } catch { setError("Cannot reach the server. Please try again."); }
    finally { setBusy(false); }
  }

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem 1rem" }}>
    <section className="mk-card" style={{ width: "min(420px, 100%)", padding: "1.75rem" }}>
      <Link href="/">GeoLens</Link>
      <h1>{reset ? "Choose a new password" : "Reset your password"}</h1>
      <p>{reset ? "Your existing sessions will be signed out." : "Enter your account email to request a single-use reset link."}</p>
      {error && <p role="alert" className="geo-callout geo-callout-danger">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!done && <form onSubmit={submit} style={{ display: "grid", gap: "1rem" }}>
        {reset ? <>
          <label className="geo-field" htmlFor="recovery-password">New password
            <input id="recovery-password" className="geo-input" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="geo-field" htmlFor="recovery-confirm">Confirm password
            <input id="recovery-confirm" className="geo-input" type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </label>
          <small>At least 12 characters; maximum 72 UTF-8 bytes.</small>
        </> : <label className="geo-field" htmlFor="recovery-email">Email
          <input id="recovery-email" className="geo-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>}
        <button type="submit" className="geo-btn geo-btn-primary" disabled={busy || (reset && !token)}>{busy ? "Submitting…" : reset ? "Update password" : "Send reset link"}</button>
      </form>}
      <p><Link href="/login">Back to sign in</Link>{reset && <> · <Link href="/forgot-password">Request a new link</Link></>}</p>
    </section>
  </main>;
}
