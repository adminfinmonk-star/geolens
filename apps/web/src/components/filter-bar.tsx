"use client";

import { apiBase } from "@/lib/api";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DomainAnalyzeBar } from "./domain-analyze-bar";

const API = apiBase();

const DATE_PRESETS = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
] as const;

type Channel = { id: string; label: string };

function FilterIcon({ kind }: { kind: "range" | "channel" }) {
  if (kind === "range") {
    return (
      <svg
        className="geo-filter-pill-icon"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <rect
          x="2.5"
          y="3.5"
          width="11"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M2.5 6.5h11M5.5 2.5v2.5M10.5 2.5v2.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      className="geo-filter-pill-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FilterBar({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);

  const range = searchParams.get("range") ?? "7d";
  const channel = searchParams.get("channel") ?? "all";
  const dirty = channel !== "all" || range !== "7d";

  useEffect(() => {
    try {
      localStorage.setItem(
        `geo_filters_${projectId}`,
        JSON.stringify({ range, channel }),
      );
    } catch {
      /* ignore */
    }
  }, [projectId, range, channel]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API}/v1/channels`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          rows?: { id: string; label?: string; name?: string }[];
          channels?: { id: string; label?: string; name?: string }[];
        };
        const rows = body.rows ?? body.channels ?? [];
        if (cancelled) return;
        setChannels(
          rows
            .filter((r) => r.id)
            .map((r) => ({ id: r.id, label: r.label ?? r.name ?? r.id })),
        );
      } catch {
        /* leave the picker at "All models" when channels can't be loaded */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (
        (key === "channel" && value === "all") ||
        (key === "range" && value === "7d")
      ) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="geo-filter-bar">
      <DomainAnalyzeBar projectId={projectId} variant="compact" />

      <div className="geo-filter-pill">
        <FilterIcon kind="range" />
        <label className="sr-only" htmlFor="filter-range">
          Date range
        </label>
        <select
          id="filter-range"
          name="range"
          className="geo-select"
          value={range}
          onChange={(e) => setParam("range", e.target.value)}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="geo-filter-pill">
        <FilterIcon kind="channel" />
        <label className="sr-only" htmlFor="filter-channel">
          Model channel
        </label>
        <select
          id="filter-channel"
          name="channel"
          className="geo-select"
          value={channel}
          onChange={(e) => setParam("channel", e.target.value)}
        >
          <option value="all">All models</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {dirty ? (
        <button
          type="button"
          className="geo-btn geo-btn-quiet geo-btn-sm"
          onClick={() => router.replace(pathname)}
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
