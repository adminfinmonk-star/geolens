// Read-only browser checks; reset form submission is intercepted, never sent.
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const playwrightRequire = createRequire(require.resolve("@playwright/cli/package.json"));
const { chromium } = playwrightRequire("playwright");
const base = process.env.GEO_QA_WEB_URL ?? "http://localhost:3010";
const output = path.join(tmpdir(), `geolens-ui-${Date.now()}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  for (const route of ["/login", "/forgot-password", `/reset-password#token=${"a".repeat(64)}`]) {
    const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, route);
    assert.ok(await page.locator("h1").isVisible(), "page heading is visible");
    assert.ok(await page.evaluate(() => document.styleSheets.length > 0), "stylesheets loaded");
    await page.screenshot({ path: path.join(output, `${route.split("#")[0].slice(1)}.png`) });
  }
  await page.route("**/v1/auth/reset-password", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Password updated. Sign in again with your new password." }) }));
  await page.getByLabel("New password", { exact: true }).fill("a-new-password-123");
  await page.getByLabel("Confirm password", { exact: true }).fill("a-new-password-123");
  assert.ok(await page.getByRole("button", { name: "Update password" }).isEnabled(), "fragment token survives React effects");
  await page.getByRole("button", { name: "Update password" }).click();
  await page.getByRole("status").filter({ hasText: "Password updated" }).waitFor();
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ checked: 3, resetSubmission: "intercepted test", screenshots: output }));
} finally { await browser.close(); }
