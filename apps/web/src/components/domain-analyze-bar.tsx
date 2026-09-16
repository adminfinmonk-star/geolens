"use client";

import { apiBase } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

const API = apiBase();

function normalizeClientDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]!
    .split("?")[0]!
    .toLowerCase();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Props = {
  projectId: string;
  /** compact = topbar; hero = Overview header strip */
  variant?: "compact" | "hero";
  initialDomain?: string;
};

export function DomainAnalyzeBar({
  projectId,
  variant = "compact",
  initialDomain = "",
}: Props) {
  const router = useRouter();
  const inputId = useId();
  const [domain, setDomain] = useState(initialDomain);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);

  useEffect(() => {
    if (initialDomain) {
      setDomain(initialDomain);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API}/v1/projects/${projectId}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          project?: { domain?: string };
        };
        if (!cancelled && body.project?.domain) {
          setDomain(body.project.domain);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, initialDomain]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const host = normalizeClientDomain(domain);
    if (!host) {
      setError("Enter a website domain (e.g. warbyparker.com).");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Preparing brand profile & prompts…");
    try {
      const res = await fetch(`${API}/v1/projects/${projectId}/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: host, create: createNew }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        status?: string;
        job_id?: string;
        project_id?: string;
        domain?: string;
        brand_name?: string;
        collect?: { chats_written?: number };
      };

      if (!res.ok && res.status !== 202) {
        if (res.status === 401) {
          setError(
            "Sign in to analyze as a new project, or uncheck “New project”.",
          );
        } else if (res.status === 503) {
          setError(
            body.message ?? "Database required to create a new project.",
          );
        } else if (res.status === 409) {
          setError(body.message ?? "Cannot collect for this project right now.");
        } else {
          setError(body.message ?? "Could not analyze that domain.");
        }
        return;
      }

      const nextId = body.project_id ?? projectId;
      setDomain(body.domain ?? host);

      // Sync path (older API) — already finished
      if (body.status !== "running" || !body.job_id) {
        const written = body.collect?.chats_written ?? 0;
        setStatus(
          written > 0
            ? `Collected ${written} answers for ${body.brand_name ?? host}`
            : `Bound to ${body.domain ?? host}`,
        );
        router.push(`/${nextId}/overview`);
        router.refresh();
        return;
      }

      setStatus(
        `Collecting AI answers for ${body.brand_name ?? host}… usually ~15–30s`,
      );
      router.push(`/${nextId}/overview`);

      const deadline = Date.now() + 3 * 60 * 1000;
      let lastChats = 0;
      while (Date.now() < deadline) {
        await sleep(1500);
        const stRes = await fetch(
          `${API}/v1/projects/${nextId}/analyze/jobs/${body.job_id}`,
          { credentials: "include" },
        );
        if (!stRes.ok) continue;
        const st = (await stRes.json()) as {
          status: string;
          message?: string;
          chats?: number;
          collect?: { chats_written?: number };
          brand_name?: string;
        };
        if (typeof st.chats === "number" && st.chats !== lastChats) {
          lastChats = st.chats;
          setStatus(`Collecting… ${st.chats} answers so far`);
        }
        if (st.status === "done") {
          const written = st.collect?.chats_written ?? st.chats ?? 0;
          setStatus(
            `Collected ${written} answers for ${st.brand_name ?? body.brand_name ?? host}`,
          );
          router.refresh();
          return;
        }
        if (st.status === "error") {
          setError(st.message ?? "Collection failed — check API / Cursor keys.");
          router.refresh();
          return;
        }
      }
      setError("Analyze is still running in the background — refresh in a minute.");
      router.refresh();
    } catch {
      setError(
        "Could not reach the API (proxy/network). Is it running on port 3001?",
      );
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(null), 6000);
    }
  }

  return (
    <form
      className={`geo-domain-analyze geo-domain-analyze--${variant}`}
      onSubmit={onSubmit}
      aria-label="Analyze website visibility"
    >
      <label className="sr-only" htmlFor={inputId}>
        Website domain
      </label>
      <div className="geo-domain-analyze-field">
        <span className="geo-domain-analyze-prefix" aria-hidden>
          https://
        </span>
        <input
          id={inputId}
          className="geo-domain-analyze-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="Enter a domain, e.g. warbyparker.com"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            if (error) setError(null);
          }}
          disabled={busy}
        />
      </div>
      {variant === "hero" ? (
        <label className="geo-domain-analyze-create">
          <input
            type="checkbox"
            checked={createNew}
            onChange={(e) => setCreateNew(e.target.checked)}
            disabled={busy}
          />
          New project
        </label>
      ) : null}
      <button
        type="submit"
        className="geo-btn geo-btn-primary geo-btn-sm geo-domain-analyze-btn"
        disabled={busy}
      >
        {busy ? "Analyzing…" : "Analyze"}
      </button>
      {busy && status ? (
        <p className="geo-domain-analyze-status" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="geo-domain-analyze-error" role="alert">
          {error}
        </p>
      ) : null}
      {!busy && !error && status ? (
        <p className="geo-domain-analyze-status" role="status">
          {status}
        </p>
      ) : null}
    </form>
  );
}
