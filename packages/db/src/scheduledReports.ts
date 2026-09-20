import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, lte, or } from "drizzle-orm";
import type { Db } from "./client.js";
import { appUser, orgMember, reportSchedule } from "./pg-schema.js";
import { loadProjectStore } from "./repository.js";
import { overviewReportPayload } from "./reports.js";
import { emailConfigured, sendEmail } from "./email.js";
import type { DemoStore } from "./seed.js";

export function nextReportDate(frequency: "daily" | "weekly", from = new Date()) {
  return new Date(from.getTime() + (frequency === "daily" ? 1 : 7) * 86_400_000);
}

export async function getReportSchedule(db: Db, projectId: string, userId: string) {
  const rows = await db.select().from(reportSchedule).where(and(eq(reportSchedule.projectId, projectId), eq(reportSchedule.userId, userId)));
  return rows[0] ?? null;
}

export async function saveReportSchedule(db: Db, input: { projectId: string; userId: string; frequency: "daily" | "weekly"; enabled: boolean }) {
  await db.insert(reportSchedule).values({ id: `rpt_${randomUUID()}`, ...input, nextRunAt: nextReportDate(input.frequency) })
    .onConflictDoUpdate({ target: [reportSchedule.projectId, reportSchedule.userId], set: { frequency: input.frequency, enabled: input.enabled, nextRunAt: nextReportDate(input.frequency), lastError: null } });
  return getReportSchedule(db, input.projectId, input.userId);
}

export function reportEmailText(store: DemoStore, frequency: "daily" | "weekly") {
  const report = overviewReportPayload(store, { range: "7d" });
  const e = report.evidence;
  const link = new URL(`/${encodeURIComponent(store.project.id)}/overview`, process.env.WEB_URL ?? "http://localhost:3010");
  return [
    `GeoLens ${frequency} summary: ${store.project.domain ?? store.project.name}`,
    `Reporting window: ${report.filters.from} to ${report.filters.to} (last seven days).`,
    `Own-brand presence: ${e.mentioned_answers}/${e.eligible_answers} eligible discovery answers.`,
    `Collection failures: ${e.failed_attempts}.`,
    `Collected citations: ${report.kpis.citations}; cited pages: ${report.kpis.cited_pages}.`,
    report.honesty.note,
    "This is a selected prompt sample, not population reach or market demand. No calibrated score interval is claimed.",
    `View evidence and manage this report: ${link}`,
  ].join("\n\n");
}

/** Leases prevent concurrent workers delivering the same due report. SMTP is at-least-once. */
export async function deliverDueReports(db: Db, deliver = sendEmail, now = new Date(), projectId?: string) {
  const due = await db.select().from(reportSchedule).where(and(projectId ? eq(reportSchedule.projectId, projectId) : undefined, eq(reportSchedule.enabled, true), lte(reportSchedule.nextRunAt, now), or(isNull(reportSchedule.leaseUntil), lt(reportSchedule.leaseUntil, now)))).limit(50);
  let sent = 0;
  for (const candidate of due) {
    const leaseToken = randomUUID();
    const claimed = await db.update(reportSchedule).set({ leaseToken, leaseUntil: new Date(now.getTime() + 5 * 60_000) }).where(and(eq(reportSchedule.id, candidate.id), eq(reportSchedule.enabled, true), lte(reportSchedule.nextRunAt, now), or(isNull(reportSchedule.leaseUntil), lt(reportSchedule.leaseUntil, now)))).returning();
    const schedule = claimed[0];
    if (!schedule) continue;
    const ownsLease = and(eq(reportSchedule.id, schedule.id), eq(reportSchedule.leaseToken, leaseToken));
    try {
      const store = await loadProjectStore(db, schedule.projectId);
      if (!store) throw new Error("project_not_found");
      const users = await db.select({ email: appUser.email }).from(appUser).innerJoin(orgMember, eq(orgMember.userId, appUser.id)).where(and(eq(appUser.id, schedule.userId), eq(orgMember.organizationId, store.organization.id))).limit(1);
      if (!users[0]) {
        await db.update(reportSchedule).set({ enabled: false, lastError: "membership_removed", leaseToken: null, leaseUntil: null }).where(ownsLease);
        continue;
      }
      if (deliver === sendEmail && !emailConfigured()) throw new Error("email_not_configured");
      await deliver({ to: users[0].email, subject: `GeoLens report: ${store.project.domain ?? store.project.name}`, text: reportEmailText(store, schedule.frequency as "daily" | "weekly"), messageId: `<${schedule.id}.${schedule.nextRunAt.getTime()}@geolens.local>` });
      await db.update(reportSchedule).set({ lastSentAt: now, nextRunAt: nextReportDate(schedule.frequency as "daily" | "weekly", now), lastError: null, leaseToken: null, leaseUntil: null }).where(ownsLease);
      sent++;
    } catch {
      await db.update(reportSchedule).set({ lastError: "report_delivery_failed", nextRunAt: new Date(now.getTime() + 15 * 60_000), leaseToken: null, leaseUntil: null }).where(ownsLease);
    }
  }
  return { scanned: due.length, sent };
}
