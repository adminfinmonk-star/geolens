import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { orgMember, project } from "./pg-schema.js";

export type ProjectRole = "owner" | "admin" | "member" | "viewer";

/**
 * Multi-tenant authz chokepoint (§18): membership via org_member → project.
 * Call this before any /v1/projects/:projectId read or write.
 */
export async function userCanAccessProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<{ ok: true; role: string; organizationId: string } | { ok: false }> {
  const projects = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  const p = projects[0];
  if (!p) return { ok: false };

  const membership = await db
    .select()
    .from(orgMember)
    .where(
      and(
        eq(orgMember.organizationId, p.organizationId),
        eq(orgMember.userId, userId),
      ),
    )
    .limit(1);
  const m = membership[0];
  if (!m) return { ok: false };
  return {
    ok: true,
    role: m.role,
    organizationId: p.organizationId,
  };
}

export async function assertProjectAccess(
  db: Db,
  userId: string,
  projectId: string,
): Promise<{ role: string; organizationId: string }> {
  const result = await userCanAccessProject(db, userId, projectId);
  if (!result.ok) {
    throw new AuthzError("forbidden", "No access to this project");
  }
  return { role: result.role, organizationId: result.organizationId };
}

export class AuthzError extends Error {
  constructor(
    readonly code: "unauthorized" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}
