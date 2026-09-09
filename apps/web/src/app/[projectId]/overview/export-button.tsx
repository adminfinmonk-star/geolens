"use client";

import { apiBase } from "@/lib/api";
import { useState } from "react";

const API_BASE = apiBase();

export function ExportOverviewButton({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download(kind: "brands" | "chats") {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `${API_BASE}/v1/projects/${projectId}/exports/${kind}.csv`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setStatus("Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}-${projectId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${kind}.csv`);
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
        className="geo-btn geo-btn-ghost"
        style={{ padding: "0.4rem 0.85rem", fontSize: 13 }}
        disabled={busy}
        onClick={() => void download("brands")}
      >
        {busy ? "…" : "Export brands"}
      </button>
      <button
        type="button"
        className="geo-btn geo-btn-ghost"
        style={{ padding: "0.4rem 0.85rem", fontSize: 13 }}
        disabled={busy}
        onClick={() => void download("chats")}
      >
        Export chats
      </button>
      {status && (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{status}</span>
      )}
    </div>
  );
}
