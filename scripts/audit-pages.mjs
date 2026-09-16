/**
 * Loads every web route and flags HTTP errors plus leaked demo-fixture strings.
 * Usage: node scripts/audit-pages.mjs [baseUrl] [projectId]
 */
const base = process.argv[2] ?? "http://127.0.0.1:3010";
const pid = process.argv[3] ?? "prj_demo";

const routes = [
  "/",
  "/login",
  "/signup",
  "/onboarding",
  "/onboarding/plan",
  "/onboarding/profile",
  "/onboarding/project",
  "/onboarding/prompts",
  "/onboarding/results",
  "/onboarding/topics",
  `/${pid}/overview`,
  `/${pid}/brands`,
  `/${pid}/competitors`,
  `/${pid}/chats`,
  `/${pid}/prompts`,
  `/${pid}/topics`,
  `/${pid}/channels`,
  `/${pid}/discovery`,
  `/${pid}/insights`,
  `/${pid}/impact`,
  `/${pid}/actions`,
  `/${pid}/perception`,
  `/${pid}/perception/fact-checking`,
  `/${pid}/shopping`,
  `/${pid}/ads`,
  `/${pid}/fanouts`,
  `/${pid}/agent/crawlability`,
  `/${pid}/agent/crawl-insights`,
  `/${pid}/agent/referrals`,
  `/${pid}/sources`,
  `/${pid}/sources/domains`,
  `/${pid}/sources/urls`,
  `/${pid}/sources/gaps`,
  `/${pid}/sources/url-detail`,
  `/${pid}/profile`,
  `/${pid}/billing`,
  `/${pid}/settings/api-keys`,
  `/${pid}/settings/sso`,
];

// Strings that only ever came from the synthetic demo dataset.
const fixtureTerms = [
  "BetaSoft",
  "CloudNine",
  "DataPeak",
  "acme.example",
  "Acme CRM",
  "Acme Store",
  "simulator injects",
  "seed window",
];

let fail = 0;
let dirty = 0;

for (const route of routes) {
  const url = `${base}${route}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const html = res.status < 400 ? await res.text() : "";
    const hits = fixtureTerms.filter((t) => html.includes(t));
    const errorish =
      html.includes("Application error") ||
      html.includes("Internal Server Error");
    const ok = res.status < 400 || res.status === 307 || res.status === 302;
    if (!ok) fail += 1;
    if (hits.length) dirty += 1;
    const flags = [
      ok ? null : "HTTP_FAIL",
      errorish ? "RENDER_ERROR" : null,
      hits.length ? `FIXTURES(${hits.join("|")})` : null,
    ].filter(Boolean);
    console.log(
      `${String(res.status).padEnd(4)} ${route.padEnd(34)} ${flags.length ? flags.join(" ") : "ok"}`,
    );
  } catch (err) {
    fail += 1;
    console.log(`ERR  ${route.padEnd(34)} ${err.message}`);
  }
}

console.log(
  `\n${routes.length} routes · ${fail} failed · ${dirty} with fixture strings`,
);
process.exit(fail === 0 && dirty === 0 ? 0 : 1);
