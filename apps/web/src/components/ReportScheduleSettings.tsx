"use client";
import { useEffect, useState } from "react";
import { apiBase } from "@/lib/api";

type Schedule = { enabled: boolean; frequency: "daily" | "weekly"; nextRunAt: string; lastSentAt: string | null; lastError: string | null };
export function ReportScheduleSettings({ projectId }: { projectId: string }) {
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [recipient, setRecipient] = useState("");
  const [configured, setConfigured] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const endpoint = `${apiBase()}/v1/projects/${projectId}/report-schedule`;
  useEffect(() => {
    let cancelled = false;
    void fetch(endpoint, { credentials: "include" }).then(async (r) => {
      const result = await r.json();
      if (!r.ok) throw new Error("Sign in to a database-backed project to schedule reports.");
      if (cancelled) return;
      setRecipient(result.recipient); setConfigured(result.delivery_configured);
      setSchedule(result.schedule); setEnabled(result.schedule?.enabled ?? false);
      setFrequency(result.schedule?.frequency ?? "weekly"); setReady(true);
    }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [endpoint]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, frequency }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not save report schedule.");
      setSchedule(result.schedule); setMessage("Report schedule saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }
  return <section className="geo-panel" style={{ padding: "1.5rem" }}>
    <h2>Email summaries</h2>
    <p>Receive the last seven days of collected evidence, sample limits and failures. Delivery goes only to your account email{recipient ? `: ${recipient}` : "."}</p>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {ready && <form onSubmit={save} style={{ display: "grid", gap: "1rem" }}>
      {!configured && <p className="geo-callout">Email delivery is not configured. Ask your administrator to configure SMTP.</p>}
      <label><input type="checkbox" checked={enabled} disabled={!configured && !enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable email summaries</label>
      <label>Delivery frequency <select className="geo-input" value={frequency} onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}><option value="daily">Every 24 hours</option><option value="weekly">Every 7 days</option></select></label>
      <button type="submit" className="geo-btn geo-btn-primary" disabled={busy || (enabled && !configured)}>{busy ? "Saving…" : "Save schedule"}</button>
      {schedule?.enabled && <p>Next due: {new Date(schedule.nextRunAt).toLocaleString()}. Delivery is checked by the worker every 15 minutes.</p>}
      {schedule?.lastSentAt && <p>Last sent: {new Date(schedule.lastSentAt).toLocaleString()}</p>}
      {schedule?.lastError && <p role="alert">Last delivery failed. Check mail configuration; the worker will retry.</p>}
    </form>}
  </section>;
}
