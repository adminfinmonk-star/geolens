"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CheckVisibilityCard() {
  const router = useRouter();
  const [domain, setDomain] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const host = domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]!
      .trim();
    const q = host ? `?domain=${encodeURIComponent(host)}` : "";
    router.push(`/signup${q}`);
  }

  return (
    <aside className="mk-check-card" aria-label="Check brand visibility">
      <p className="mk-check-kicker">AI visibility</p>
      <h2>Be the brand AI recommends first</h2>
      <p className="mk-check-sub">
        Enter a domain to start tracking how often LLMs mention your brand.
      </p>
      <form onSubmit={onSubmit} className="mk-check-form">
        <label className="sr-only" htmlFor="mk-check-domain">
          Brand or domain
        </label>
        <input
          id="mk-check-domain"
          className="mk-check-input"
          placeholder="yoursite.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          autoComplete="url"
        />
        <button type="submit" className="mk-btn-pill mk-btn-soft mk-check-submit">
          Check AI visibility
        </button>
      </form>
      <div className="mk-check-meta">
        <span>Live demo available</span>
        <span aria-hidden>·</span>
        <span>No credit card required</span>
      </div>
    </aside>
  );
}
