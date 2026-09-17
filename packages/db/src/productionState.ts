import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { billingWebhookEvent, sharedView } from "./pg-schema.js";
import type { SharedView } from "./schema.js";

export async function persistSharedView(db: Db | null, view: SharedView) {
  if (!db) return;
  await db
    .insert(sharedView)
    .values({
      id: view.id,
      projectId: view.project_id,
      name: view.name,
      widgetsJson: JSON.stringify(view.widgets),
      createdAt: new Date(view.created_at),
      expiresAt: new Date(view.expires_at),
      revokedAt: view.revoked_at ? new Date(view.revoked_at) : null,
    })
    .onConflictDoNothing();
}

export async function loadSharedView(
  db: Db | null,
  viewId: string,
): Promise<SharedView | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(sharedView)
    .where(eq(sharedView.id, viewId))
    .limit(1);
  const row = rows[0];
  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null;
  return {
    id: row.id,
    project_id: row.projectId,
    name: row.name,
    widgets: JSON.parse(row.widgetsJson) as string[],
    created_at: row.createdAt.toISOString(),
    expires_at: row.expiresAt.toISOString(),
  };
}

export async function revokeSharedView(
  db: Db | null,
  input: { viewId: string; projectId: string },
): Promise<boolean> {
  if (!db) return false;
  const rows = await db
    .update(sharedView)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sharedView.id, input.viewId),
        eq(sharedView.projectId, input.projectId),
      ),
    )
    .returning({ projectId: sharedView.projectId });
  return rows[0]?.projectId === input.projectId;
}

export async function billingWebhookWasProcessed(db: Db | null, eventId: string) {
  if (!db) return false;
  const rows = await db
    .select({ id: billingWebhookEvent.id })
    .from(billingWebhookEvent)
    .where(eq(billingWebhookEvent.id, eventId))
    .limit(1);
  return Boolean(rows[0]);
}

export async function recordBillingWebhookEvent(
  db: Db | null,
  input: { eventId: string; eventType: string; projectId?: string },
) {
  if (!db) return;
  await db
    .insert(billingWebhookEvent)
    .values({
      id: input.eventId,
      eventType: input.eventType,
      projectId: input.projectId,
    })
    .onConflictDoNothing();
}
