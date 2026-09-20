"use client";
import { useState } from "react";
import { apiBase } from "@/lib/api";

export function ReferralImport({ projectId, onImported }: { projectId: string; onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <section style={{ margin: "1rem 0" }}>
    <h2>Import measured referrals</h2>
    <p>Upload a normalized JSON array from your analytics export. Matching date/source/device/page dimensions are replaced, not added twice. This is an import, not a live GA4 connection.</p>
    <details><summary>Required row format</summary><pre style={{ overflowX: "auto" }}>{JSON.stringify({ date: "YYYY-MM-DD", source: "perplexity.ai", medium: "referral", country: "IN", device: "desktop", landing_page: "/", page_path: "/", session_starts: 0, conversions: 0, revenue: 0, currency: "USD" }, null, 2)}</pre><p>Use your measured session_start events, key events and revenue. Maximum 5,000 rows, one currency.</p></details>
    <label>Analytics JSON <input type="file" accept=".json,application/json" disabled={busy} onChange={async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      e.target.value = "";
      if (file.size > 800_000) { setMessage("File is too large (maximum 800 KB)."); return; }
      setBusy(true); setMessage("");
      try {
        const rows = JSON.parse(await file.text());
        const res = await fetch(`${apiBase()}/v1/projects/${projectId}/agent/referrals/import`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
        const result = await res.json(); if (!res.ok) throw new Error(result.message ?? "Import failed");
        setMessage(`Imported ${result.imported} rows.`); onImported();
      } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
      finally { setBusy(false); }
    }} /></label>
    <p role="status">{busy ? "Importing…" : message}</p>
  </section>;
}
