import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, count } from "drizzle-orm";
import { canCreateProject, getPlan } from "@geo/core";
import type { Db } from "./client.js";
import { newId } from "./schema.js";
import {
  appUser,
  orgMember,
  organization,
  project,
  session,
} from "./pg-schema.js";

const SESSION_DAYS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function signup(
  db: Db,
  input: {
    email: string;
    password: string;
    name?: string;
    orgName?: string;
    projectName?: string;
  },
) {
  const email = input.email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(appUser)
    .where(eq(appUser.email, email))
    .limit(1);
  if (existing[0]) {
    throw new AuthError("email_taken", "Email already registered");
  }
  if (input.password.length < 8) {
    throw new AuthError("weak_password", "Password must be at least 8 characters");
  }

  const userId = newId("usr");
  const orgId = newId("org");
  const projectId = newId("prj");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date();

  await db.insert(appUser).values({
    id: userId,
    email,
    name: input.name ?? email.split("@")[0],
    passwordHash,
    createdAt: now,
  });

  await db.insert(organization).values({
    id: orgId,
    name: input.orgName ?? `${input.name ?? "My"} Org`,
    planCode: "trial",
    billingPeriod: "monthly",
    isAgency: false,
    timezone: "UTC",
    createdAt: now,
  });

  await db.insert(orgMember).values({
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: now,
  });

  await db.insert(project).values({
    id: projectId,
    organizationId: orgId,
    name: input.projectName ?? "My first project",
    status: "ONBOARDING",
    defaultCountry: "US",
    language: "en",
    timezone: "UTC",
    frequency: "daily",
    createdAt: now,
  });

  const token = await createSession(db, userId);
  return {
    token,
    user: { id: userId, email, name: input.name ?? null },
    organization: { id: orgId, name: input.orgName ?? `${input.name ?? "My"} Org` },
    project: { id: projectId, name: input.projectName ?? "My first project", status: "ONBOARDING" },
  };
}

export async function login(
  db: Db,
  input: { email: string; password: string },
) {
  const email = input.email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(appUser)
    .where(eq(appUser.email, email))
    .limit(1);
  const user = rows[0];
  if (!user) throw new AuthError("invalid_credentials", "Invalid email or password");

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new AuthError("invalid_credentials", "Invalid email or password");

  const token = await createSession(db, user.id);
  const membership = await db
    .select()
    .from(orgMember)
    .where(eq(orgMember.userId, user.id))
    .limit(1);
  const orgId = membership[0]?.organizationId;
  let projectRow = null;
  if (orgId) {
    const projects = await db
      .select()
      .from(project)
      .where(eq(project.organizationId, orgId))
      .limit(1);
    projectRow = projects[0] ?? null;
  }

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
    project: projectRow
      ? { id: projectRow.id, name: projectRow.name, status: projectRow.status }
      : null,
  };
}

export async function loginWithEmail(db: Db, email: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(appUser)
    .where(eq(appUser.email, normalized))
    .limit(1);
  const user = rows[0];
  if (!user) {
    throw new AuthError("sso_user_not_found", "No account for this SSO email");
  }
  const token = await createSession(db, user.id);
  const membership = await db
    .select()
    .from(orgMember)
    .where(eq(orgMember.userId, user.id))
    .limit(1);
  const orgId = membership[0]?.organizationId;
  let projectRow = null;
  if (orgId) {
    const projects = await db
      .select()
      .from(project)
      .where(eq(project.organizationId, orgId))
      .limit(1);
    projectRow = projects[0] ?? null;
  }
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
    project: projectRow
      ? { id: projectRow.id, name: projectRow.name, status: projectRow.status }
      : null,
  };
}

export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await db.insert(session).values({
    id: newId("ses"),
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return token;
}

export async function getSessionUser(db: Db, token: string | undefined) {
  if (!token) return null;
  const rows = await db
    .select({
      userId: appUser.id,
      email: appUser.email,
      name: appUser.name,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    })
    .from(session)
    .innerJoin(appUser, eq(session.userId, appUser.id))
    .where(
      and(
        eq(session.tokenHash, hashToken(token)),
        gt(session.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function logout(db: Db, token: string | undefined) {
  if (!token) return;
  await db.delete(session).where(eq(session.tokenHash, hashToken(token)));
}

export async function listUserProjects(db: Db, userId: string) {
  const memberships = await db
    .select()
    .from(orgMember)
    .where(eq(orgMember.userId, userId));
  const orgIds = memberships.map((m) => m.organizationId);
  if (orgIds.length === 0) return [];

  const all = await db.select().from(project);
  return all.filter((p) => orgIds.includes(p.organizationId));
}

export async function createProjectForUser(
  db: Db,
  userId: string,
  input: { name: string; domain?: string },
) {
  const membership = await db
    .select()
    .from(orgMember)
    .where(
      and(eq(orgMember.userId, userId), eq(orgMember.role, "owner")),
    )
    .limit(1);
  const owner = membership[0];
  if (!owner) {
    throw new AuthError("forbidden", "Owner membership required");
  }

  const orgRows = await db
    .select()
    .from(organization)
    .where(eq(organization.id, owner.organizationId))
    .limit(1);
  const org = orgRows[0];
  if (!org) throw new AuthError("forbidden", "Organization not found");

  const existing = await db
    .select({ n: count() })
    .from(project)
    .where(eq(project.organizationId, owner.organizationId));
  const projectCount = Number(existing[0]?.n ?? 0);
  const plan = getPlan(org.planCode);
  const gate = canCreateProject({
    plan_code: org.planCode,
    is_agency: org.isAgency,
    credits_total: org.creditsTotal ?? plan.credits_total,
    credits_allocated: 0,
    project_count: projectCount,
    project_status: "CUSTOMER",
    active_prompts: 0,
    enabled_channels: 0,
    countries: 1,
    bot_visits_used: org.botVisitsUsed ?? 0,
    frequency: "daily",
  });
  if (!gate.ok) {
    throw new AuthError(gate.code ?? "project_quota", gate.message ?? "Quota");
  }

  const id = newId("prj");
  await db.insert(project).values({
    id,
    organizationId: owner.organizationId,
    name: input.name,
    domain: input.domain,
    status: "ONBOARDING",
    defaultCountry: "US",
    language: "en",
    timezone: "UTC",
    frequency: "daily",
  });
  return { id, name: input.name, organizationId: owner.organizationId, status: "ONBOARDING" as const };
}

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
