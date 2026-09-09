"use client";

import { apiBase } from "@/lib/api";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const API = apiBase();

const DATE_PRESETS = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
] as const;

type Channel = { id: string; label: string };

export function FilterBar({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);

  const range = searchParams.get("range") ?? "7d";
  const channel = searchParams.get("channel") ?? "all";

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
      if (key === "channel" && value === "all") next.delete("channel");
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-2)",
        alignItems: "center",
        flexWrap: "wrap",
        flex: 1,
        minWidth: 0,
      }}
    >
      <Link
        href={`/${projectId}/profile`}
        className="geo-chip"
        title={`Project ${projectId} — open settings`}
      >
        Project
      </Link>

      <label className="sr-only" htmlFor="filter-range">
        Date range
      </label>
      <select
        id="filter-range"
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

      <label className="sr-only" htmlFor="filter-channel">
        Model channel
      </label>
      <select
        id="filter-channel"
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

      {channel !== "all" || range !== "7d" ? (
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
