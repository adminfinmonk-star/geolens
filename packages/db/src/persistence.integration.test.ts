import { randomUUID, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb, closeDb } from "./client.js";
import { runMigrations } from "./migrate.js";
import { signup, getSessionUser, login } from "./auth.js";
import { requestPasswordRecovery, completePasswordRecovery } from "./passwordRecovery.js";
import { appUser, organization, passwordReset, reportSchedule } from "./pg-schema.js";
import { saveReportSchedule, deliverDueReports, getReportSchedule } from "./scheduledReports.js";
import { loadProjectStore, persistCollectionEvidence, replaceProjectCollection } from "./repository.js";
import { createPrompt, updatePrompt } from "./prompts.js";
import { importReferralRows } from "./agentAnalytics.js";
import { persistProjectStore } from "./repository.js";

const databaseUrl = process.env.GEO_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)("PostgreSQL reliability", () => {
  it("commits evidence without reverting prompt edits and supports one-use recovery", async () => {
    await runMigrations(databaseUrl);
    const db = createDb(databaseUrl);
    const account = await signup(db, { email: `integrity-${randomUUID()}@example.test`, password: "initial-password-123" });
    try {
      const projectId = account.project.id;
      await Promise.allSettled([
        createPrompt(db, projectId, { text: "Concurrent unique question", country_code: "US" }),
        createPrompt(db, projectId, { text: " Concurrent  unique question ", country_code: "us" }),
      ]);
      const uniqueStore = (await loadProjectStore(db, projectId))!;
      expect(uniqueStore.prompts.filter((p) => p.status === "active" && p.text.toLowerCase().includes("unique question"))).toHaveLength(1);
      const prompt = (await createPrompt(db, projectId, { text: "Original prompt", country_code: "US" }))!;
      const store = (await loadProjectStore(db, projectId))!;
      store.prompts.find((p) => p.id === prompt.id)!.branding = "branded";
      await replaceProjectCollection(db, store);
      const revised = await updatePrompt(db, projectId, prompt.id, { text: "Revised prompt" });
      store.chats = [{ id: `cht_${randomUUID()}`, project_id: projectId, prompt_id: prompt.id, model_channel_id: "openai-1", country_code: "US", run_date: "2026-09-19", status: "ok", text: "A real saved observation", surface_kind: "api" }];
      store.mentions = []; store.sources = [];
      await persistCollectionEvidence(db, store);
      store.sources.push({ chat_id: store.chats[0]!.id, url: "https://injected.example", domain: "injected.example", cited: true, citation_count: 1, retrieval_rank: 1 });
      await persistCollectionEvidence(db, store);
      const refreshed = (await loadProjectStore(db, projectId))!;
      expect(refreshed.chats).toHaveLength(1);
      expect(refreshed.sources).toHaveLength(0);
      expect(refreshed.prompts.find((p) => p.id === prompt.id)).toMatchObject({ text: "Original prompt", status: "archived", branding: "branded" });
      expect(refreshed.prompts.some((p) => p.id === revised!.id && p.text === "Revised prompt")).toBe(true);
      importReferralRows(refreshed, [{ date: "2026-09-19", source: "perplexity.ai", medium: "referral", country: "IN", device: "desktop", landing_page: "/", page_path: "/", session_starts: 2, conversions: 1, revenue: 5, currency: "USD" }]);
      await persistProjectStore(db, refreshed);
      expect((await loadProjectStore(db, projectId))!.gaReferrals[0]!.session_starts).toBe(2);

      let message = "";
      await requestPasswordRecovery(db, account.user.email, async (mail) => { message = mail.text; });
      const token = message.match(/token=([a-f0-9]{64})/)![1]!;
      const rows = await db.select().from(passwordReset).where(eq(passwordReset.userId, account.user.id));
      expect(rows[0]!.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
      const attempts = await Promise.allSettled([
        completePasswordRecovery(db, token, "replacement-password-123"),
        completePasswordRecovery(db, token, "replacement-password-123"),
      ]);
      expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await getSessionUser(db, account.token)).toBeNull();
      await expect(login(db, { email: account.user.email, password: "initial-password-123" })).rejects.toThrow();
      expect((await login(db, { email: account.user.email, password: "replacement-password-123" })).user.id).toBe(account.user.id);

      await saveReportSchedule(db, { projectId, userId: account.user.id, frequency: "weekly", enabled: true });
      const now = new Date();
      await db.update(reportSchedule).set({ nextRunAt: new Date(now.getTime() - 1000) }).where(eq(reportSchedule.projectId, projectId));
      const delivered: string[] = [];
      const deliver = async (mail: { to: string; text: string }) => { delivered.push(mail.to); expect(mail.text).toContain("selected prompt sample"); };
      await Promise.all([deliverDueReports(db, deliver, now, projectId), deliverDueReports(db, deliver, now, projectId)]);
      expect(delivered).toEqual([account.user.email]);
      expect((await getReportSchedule(db, projectId, account.user.id))?.lastSentAt).not.toBeNull();
    } finally {
      await db.delete(organization).where(eq(organization.id, account.organization.id));
      await db.delete(appUser).where(eq(appUser.id, account.user.id));
      await closeDb(db);
    }
  }, 60_000);
});
