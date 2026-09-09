"use client";

import { apiBase } from "@/lib/api";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { CommandPalette } from "./command-palette";
import { FilterBar } from "./filter-bar";
import { AppSideNav } from "./sidebar-nav";


const API = apiBase();

type Gate =
  | "checking"
  | "ok"
  | "redirect"
  | "unauthorized"
  | "forbidden"
  | "missing"
  | "unreachable";

/** Paths allowed while project status is still ONBOARDING. */
function isOnboardingAllowlisted(pathname: string, projectId: string): boolean {
  const base = `/${projectId}`;
  const allowed = [`${base}/billing`, `${base}/settings`];
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function ShellSkeleton() {
  return (
    <div className="geo-shell">
      <div className="geo-nav-shell">
        <aside className="geo-icon-rail" aria-hidden>
          <span className="geo-skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
        </aside>
        <aside className="geo-sidebar" aria-hidden>
          <span className="geo-skeleton geo-skeleton-title" style={{ width: "60%" }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="geo-skeleton geo-skeleton-row" style={{ height: 28 }} />
          ))}
        </aside>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="geo-topbar" />
        <div className="geo-main">
          <span className="geo-skeleton geo-skeleton-title" />
          <span className="geo-skeleton" style={{ height: 240, borderRadius: "var(--radius)" }} />
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading workspace
      </span>
    </div>
  );
}

function GateMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "var(--space-5)" }}>
      <div className="geo-empty" style={{ maxWidth: 460 }}>
        <p className="geo-empty-title">{title}</p>
        <p className="geo-empty-body">{body}</p>
        <Link href={action.href} className="geo-btn geo-btn-primary" style={{ marginTop: "var(--space-2)" }}>
          {action.label}
        </Link>
      </div>
    </div>
  );
}

export function AppShellClient({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [gate, setGate] = useState<Gate>("checking");

  useEffect(() => {
    if (projectId === "prj_demo") {
      setGate("ok");
      return;
    }
    if (isOnboardingAllowlisted(pathname, projectId)) {
      setGate("ok");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API}/v1/projects/${projectId}`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          // A failed check must not open the app. Distinguish the causes so the
          // user gets a route forward instead of a blank dashboard.
          if (res.status === 401) {
            setGate("unauthorized");
            router.replace("/login");
          } else if (res.status === 403) {
            setGate("forbidden");
          } else if (res.status === 404) {
            setGate("missing");
          } else {
            setGate("unreachable");
          }
          return;
        }
        const data = (await res.json()) as { project?: { status?: string } };
        if (cancelled) return;
        if (data.project?.status === "ONBOARDING") {
          setGate("redirect");
          router.replace("/onboarding/project");
          return;
        }
        setGate("ok");
      } catch {
        if (!cancelled) setGate("unreachable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, pathname, router]);

  if (gate === "checking" || gate === "redirect" || gate === "unauthorized") {
    return <ShellSkeleton />;
  }

  if (gate === "forbidden") {
    return (
      <GateMessage
        title="You don't have access to this project"
        body="Your account isn't a member of this workspace. Ask an owner to invite you, or switch to a project you belong to."
        action={{ href: "/login", label: "Switch account" }}
      />
    );
  }

  if (gate === "missing") {
    return (
      <GateMessage
        title="Project not found"
        body="This project doesn't exist or has been deleted. Check the URL, or head back and pick another workspace."
        action={{ href: "/", label: "Back to home" }}
      />
    );
  }

  if (gate === "unreachable") {
    return (
      <GateMessage
        title="Can't reach the API"
        body="The GeoLens API didn't respond. It may still be starting up — retry in a moment."
        action={{ href: pathname, label: "Retry" }}
      />
    );
  }

  return (
    <div className="geo-shell">
      <a href="#main" className="geo-skip">
        Skip to content
      </a>

      <AppSideNav projectId={projectId} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
        <header className="geo-topbar">
          <Suspense
            fallback={
              <span className="geo-skeleton" style={{ height: 30, width: 340, borderRadius: "var(--radius-sm)" }} />
            }
          >
            <FilterBar projectId={projectId} />
          </Suspense>
          <CommandPalette projectId={projectId} />
        </header>

        <main id="main" className="geo-main geo-page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
