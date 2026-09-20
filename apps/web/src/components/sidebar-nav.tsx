"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GeoLensMark } from "./geolens-mark";
import { ThemeToggle } from "./theme-toggle";

type NavItem = { href: string; label: string; badge?: string };
type NavGroup = {
  id: string;
  label: string;
  short: string;
  items: NavItem[];
};

/**
 * Semrush-style dual rail (Stitch `0a1448ba…` + user reference).
 * Hover peeks secondary · click pins · << collapses secondary (rail stays).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "analysis",
    label: "AI Analysis",
    short: "Analysis",
    items: [
      { href: "overview", label: "Visibility Overview" },
      { href: "competitors", label: "Competitor Research" },
      { href: "discovery", label: "Prompt Research" },
    ],
  },
  {
    id: "monitor",
    label: "Boost & Monitor",
    short: "Monitor",
    items: [
      { href: "prompts", label: "Prompt Tracking" },
      { href: "sources/domains", label: "Sources & Citations" },
      { href: "actions", label: "Actions & Fixes" },
    ],
  },
  {
    id: "results",
    label: "Results",
    short: "Results",
    items: [
      { href: "chats", label: "Chats" },
      { href: "fanouts", label: "Fanouts", badge: "Preview" },
      { href: "ads", label: "Ads", badge: "Preview" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    short: "Settings",
    items: [
      { href: "profile", label: "Profile" },
      { href: "brands", label: "Brands" },
      { href: "competitors", label: "Competitors" },
      { href: "topics", label: "Topics & tags" },
      { href: "channels", label: "Channels" },
      { href: "billing", label: "Billing" },
      { href: "settings/api-keys", label: "API keys" },
      { href: "settings/reports", label: "Email reports" },
      { href: "settings/sso", label: "SSO" },
    ],
  },
];

const PIN_KEY = "geo_nav_pinned";
const COLLAPSE_KEY = "geo_nav_collapsed";

function matchGroupId(pathname: string, projectId: string): string {
  const ranked = NAV_GROUPS.flatMap((g) =>
    g.items.map((item) => ({
      groupId: g.id,
      href: `/${projectId}/${item.href}`,
    })),
  ).sort((a, b) => b.href.length - a.href.length);

  for (const row of ranked) {
    if (pathname === row.href || pathname.startsWith(`${row.href}/`)) {
      return row.groupId;
    }
  }
  if (pathname === `/${projectId}/sources`) return "monitor";
  if (pathname.startsWith(`/${projectId}/agent`)) return "settings";
  if (pathname.startsWith(`/${projectId}/shopping`)) return "settings";
  if (pathname.startsWith(`/${projectId}/impact`)) return "monitor";
  return "analysis";
}

export function AppSideNav({ projectId }: { projectId: string }) {
  const pathname = usePathname() ?? "";
  const routeSuite = useMemo(
    () => matchGroupId(pathname, projectId),
    [pathname, projectId],
  );

  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem(PIN_KEY);
      const c = localStorage.getItem(COLLAPSE_KEY);
      setPinned(p && NAV_GROUPS.some((g) => g.id === p) ? p : routeSuite);
      setCollapsed(c === "1");
    } catch {
      setPinned(routeSuite);
    }
    setReady(true);
  }, [routeSuite]);

  useEffect(() => {
    if (!ready) return;
    // Keep pin aligned with the page the user is on (unless fully collapsed).
    if (!collapsed) {
      setPinned((prev) => {
        if (prev === routeSuite) return prev;
        try {
          localStorage.setItem(PIN_KEY, routeSuite);
        } catch {
          /* ignore */
        }
        return routeSuite;
      });
    }
  }, [routeSuite, collapsed, ready]);

  const persistPin = useCallback((id: string | null) => {
    setPinned(id);
    try {
      if (id) localStorage.setItem(PIN_KEY, id);
      else localStorage.removeItem(PIN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const persistCollapsed = useCallback((value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  function clearLeaveTimer() {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  function onRailEnter(id: string) {
    clearLeaveTimer();
    setHovered(id);
  }

  function onShellLeave() {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => setHovered(null), 120);
  }

  function pinSuite(id: string) {
    clearLeaveTimer();
    persistCollapsed(false);
    persistPin(id);
    setHovered(null);
  }

  function toggleCollapse() {
    clearLeaveTimer();
    setHovered(null);
    if (collapsed) {
      persistCollapsed(false);
      persistPin(routeSuite);
    } else {
      persistCollapsed(true);
      persistPin(null);
    }
  }

  const peeking = Boolean(hovered);
  const showSecondary =
    peeking || (!collapsed && pinned != null);
  const displayId = hovered ?? pinned ?? routeSuite;
  const displayGroup =
    NAV_GROUPS.find((g) => g.id === displayId) ?? NAV_GROUPS[0];
  const panelMode = peeking && (collapsed || hovered !== pinned) ? "peek" : "pinned";

  return (
    <div
      className="geo-nav-shell"
      data-collapsed={collapsed ? "true" : "false"}
      data-peeking={peeking ? "true" : "false"}
      onMouseLeave={onShellLeave}
    >
      <aside className="geo-icon-rail" aria-label="Suites">
        <Link href="/" className="geo-rail-logo" title="GeoLens home">
          <GeoLensMark className="geo-rail-mark" />
        </Link>

        <nav className="geo-rail-nav">
          {NAV_GROUPS.map((g) => {
            const active =
              (!collapsed && pinned === g.id) ||
              hovered === g.id ||
              (!pinned && !collapsed && routeSuite === g.id);
            return (
              <button
                key={g.id}
                type="button"
                className="geo-rail-item"
                data-active={active ? "true" : "false"}
                aria-pressed={pinned === g.id && !collapsed}
                aria-expanded={showSecondary && displayId === g.id}
                title={g.label}
                onMouseEnter={() => onRailEnter(g.id)}
                onFocus={() => onRailEnter(g.id)}
                onClick={() => pinSuite(g.id)}
              >
                <span className="geo-rail-icon" aria-hidden>
                  {suiteIcon(g.id)}
                </span>
                <span className="geo-rail-label">{g.short}</span>
              </button>
            );
          })}
        </nav>

        <div className="geo-rail-bottom">
          <button
            type="button"
            className="geo-rail-collapse"
            onClick={toggleCollapse}
            aria-label={
              collapsed
                ? "Expand secondary navigation"
                : "Collapse secondary navigation"
            }
            title={collapsed ? "Expand nav" : "Collapse nav"}
          >
            <CollapseChevrons collapsed={collapsed} />
            <span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      </aside>

      {showSecondary && (
        <aside
          className="geo-sidebar"
          data-mode={panelMode}
          aria-label={displayGroup.label}
          onMouseEnter={clearLeaveTimer}
        >
          <div className="geo-side-suite-head">
            <div>
              <p className="geo-side-suite-kicker">GeoLens suite</p>
              <div className="geo-side-suite-title">
                <span>{displayGroup.label}</span>
                {panelMode === "pinned" && (
                  <span className="geo-side-live-dot" aria-hidden />
                )}
              </div>
            </div>
            {panelMode === "peek" ? (
              <span className="geo-side-ver">Peek</span>
            ) : (
              <span className="geo-side-ver">Pinned</span>
            )}
          </div>

          <nav className="geo-side-nav" aria-label={displayGroup.label}>
            <div className="geo-side-links">
              {displayGroup.items.map((item) => {
                const href = `/${projectId}/${item.href}`;
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className="geo-nav-link"
                    data-active={active ? "true" : "false"}
                    onClick={() => {
                      persistCollapsed(false);
                      persistPin(displayGroup.id);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="geo-nav-badge">{item.badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="geo-side-footer">
            <div className="geo-side-footer-row">
              <Link
                href={`/${projectId}/profile`}
                className="geo-btn geo-btn-ghost geo-btn-sm"
                style={{ flex: 1 }}
              >
                Profile
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function CollapseChevrons({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
    >
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
    </svg>
  );
}

function suiteIcon(id: string): ReactNode {
  switch (id) {
    case "analysis":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "brand":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 19V5h16v14H4z" />
          <path d="M8 15v-4M12 15V9M16 15v-6" />
        </svg>
      );
    case "monitor":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </svg>
      );
    case "results":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 5h16v11H8l-4 3V5z" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      );
  }
}

/** @deprecated use AppSideNav — kept for command palette helpers */
export function SidebarNav({ projectId }: { projectId: string }) {
  return <AppSideNav projectId={projectId} />;
}

export function IconRail({ projectId }: { projectId: string }) {
  return <AppSideNav projectId={projectId} />;
}

export function flatNavItems(projectId: string) {
  return NAV_GROUPS.flatMap((g) =>
    g.items.map((i) => ({
      id: i.href,
      label: i.label,
      group: g.label,
      href: `/${projectId}/${i.href}`,
    })),
  );
}
