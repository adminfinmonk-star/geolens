import { describe, expect, it } from "vitest";
import {
  crawlInsightsDashboard,
  getCrawlability,
  ingestWebhookLogs,
} from "./agentAnalytics.js";
import { generateActionsForStore } from "./actions.js";
import { getDemoStore, resetDemoStore } from "./seed.js";

describe("agent analytics", () => {
  it("blocked search bot in robots.txt produces R5 action", async () => {
    delete process.env.DATABASE_URL;
    resetDemoStore();
    const store = await getDemoStore();
    const crawl = getCrawlability(store);
    expect(
      crawl.blocked_search_bots.some((b) => b.bot === "OAI-SearchBot"),
    ).toBe(true);

    const { actions } = generateActionsForStore(store, { force: true });
    const r5 = actions.find((a) => a.rule_id === "R5");
    expect(r5).toBeTruthy();
    expect(r5!.evidence.length).toBeGreaterThan(0);
    expect(r5!.overview).toMatch(/OAI-SearchBot|Unblock/);
  }, 60_000);

  it("diagnoses crawled-but-never-cited URLs", async () => {
    delete process.env.DATABASE_URL;
    resetDemoStore();
    const store = await getDemoStore();
    const dash = crawlInsightsDashboard(store);
    expect(dash.crawled_never_cited.length).toBeGreaterThan(0);
    expect(
      dash.visited_urls.some((u) => u.url.includes("legacy/pricing")),
    ).toBe(true);

    ingestWebhookLogs(store, [
      {
        timestamp: "2026-08-10T12:00:00Z",
        request_method: "GET",
        request_url: `https://${store.project.domain}/only-crawled`,
        response_status: 200,
        user_agent: "PerplexityBot/1.0",
      },
    ]);
    const again = crawlInsightsDashboard(store);
    expect(
      again.visited_urls.some(
        (u) => u.url.includes("only-crawled") && u.crawled_never_cited,
      ),
    ).toBe(true);
  }, 60_000);
});
