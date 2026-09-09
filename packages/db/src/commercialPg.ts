import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import type { AuditLogEntry } from "./commercial.js";
import { auditLog, organization, project } from "./pg-schema.js";
import type { DemoStore } from "./seed.js";

/** Persist org plan / credits / bot visits + project status/settings to Postgres. */
export async function syncCommercialToPostgres(db: Db, store: DemoStore) {
  await db
    .update(organization)
    .set({
      planCode: store.organization.plan_code,
      billingPeriod: store.organization.billing_period,
      isAgency: store.organization.is_agency,
      creditsTotal: store.organization.credits_total ?? null,
      botVisitsUsed: store.organization.bot_visits_used ?? 0,
    })
    .where(eq(organization.id, store.organization.id));

  await db
    .update(project)
    .set({
      name: store.project.name,
      domain: store.project.domain ?? null,
      location: store.project.location ?? null,
      defaultCountry: store.project.default_country,
      language: store.project.language,
      timezone: store.project.timezone,
      status: store.project.status,
      frequency: store.project.frequency,
    })
    .where(eq(project.id, store.project.id));
}

const flushedAuditIds = new Set<string>();

export async function flushAuditLogToPostgres(
  db: Db,
  entries: AuditLogEntry[],
) {
  for (const e of entries) {
    if (flushedAuditIds.has(e.id)) continue;
    await db
      .insert(auditLog)
      .values({
        id: e.id,
        organizationId: e.organization_id,
        projectId: e.project_id ?? null,
        actorUserId: e.actor_user_id ?? null,
        actorLabel: e.actor_label ?? null,
        source: e.source,
        action: e.action,
        beforeJson: e.before != null ? JSON.stringify(e.before) : null,
        afterJson: e.after != null ? JSON.stringify(e.after) : null,
        createdAt: new Date(e.created_at),
      })
      .onConflictDoNothing();
    flushedAuditIds.add(e.id);
  }
}

export function resetAuditFlushCache() {
  flushedAuditIds.clear();
}

export async function persistCommercialSideEffects(
  db: Db | null,
  store: DemoStore,
) {
  if (!db) return;
  await syncCommercialToPostgres(db, store);
  await flushAuditLogToPostgres(db, store.auditLog ?? []);
}
