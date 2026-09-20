// Read-only checks against a built app and its configured API.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = createRequire(require.resolve("@playwright/cli/package.json"))("playwright");
const base = process.env.GEO_QA_WEB_URL ?? "http://localhost:3010";
const project = process.env.GEO_QA_PROJECT_ID ?? "prj_demo";
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/_next/static/") && response.status() >= 400) failures.push(`Asset ${response.status()}: ${response.url()}`);
  });
  const routes = ["overview", "prompts", "channels", "chats", "brands", "discovery", "sources/domains", "settings/reports", "agent/referrals"];
  for (const route of routes) {
    const response = await page.goto(`${base}/${project}/${route}`, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, route);
    assert.ok(page.url().includes(`/${project}/`), `unexpected redirect: ${route}`);
    await page.locator("h1").first().waitFor();
    assert.ok(await page.evaluate(() => document.styleSheets.length > 0), `CSS: ${route}`);
  }
  const response = await page.request.get(`${base}/backend/v1/projects/${project}/reports/overview`);
  assert.equal(response.status(), 200, "same-origin API proxy");
  const report = await response.json();
  assert.ok(Array.isArray(report.collection_health), "latest API contract");
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ routes: routes.length, assets: "passed", apiProxy: "passed", activePrompts: report.prompt_cohort.active_prompts }));
} finally { await browser.close(); }
