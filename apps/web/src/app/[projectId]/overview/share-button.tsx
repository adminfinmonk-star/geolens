"use client";

import { apiBase } from "@/lib/api";
import { useState } from "react";

const API_BASE = apiBase();

export function ShareOverviewButton({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/v1/projects/${projectId}/views`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Shared overview" }),
      });
      if (!res.ok) {
        setStatus("Could not create share link");
        return;
      }
      const body = (await res.json()) as { share_path: string };
      const url = `${window.location.origin}${body.share_path}`;
      await navigator.clipboard.writeText(url);
      setStatus("Copied");
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus("API unreachable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="geo-btn geo-btn-ghost"
        style={{ padding: "0.4rem 0.85rem", fontSize: 13 }}
      >
        {busy ? "…" : "Share"}
      </button>
      {status && (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{status}</span>
      )}
    </div>
  );
}
