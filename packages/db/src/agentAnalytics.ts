import {
  blockedSearchBots,
  crawlabilityReport,
  ingestAccessLogBatch,
  joinVisitedUrls,
  parseAccessLogFile,
  statusCodeHistogram,
  testUrlAccess,
  type AgentLogRow,
} from "@geo/core";
import { AI_BOTS, matchBot, classifyAssistantReferral } from "@geo/registry";
import { dataState, demoFixturesEnabled } from "./fixtures.js";
import type { DemoStore, GaReferralDaily } from "./seed.js";

const DEFAULT_ROBOTS = `User-agent: OAI-SearchBot
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: *
Allow: /
Disallow: /admin
`;

export function ensureAgentAnalytics(store: DemoStore) {
  if (!store.agentLogs) store.agentLogs = [];
  if (!store.gaReferrals) store.gaReferrals = [];
  if (!store.logIntegrations) {
    store.logIntegrations = [
      { id: "int_webhook", kind: "webhook", status: "ready", label: "Generic webhook" },
      { id: "int_upload", kind: "file_upload", status: "ready", label: "File upload" },
      {
        id: "int_cf",
        kind: "cloudflare",
        status: "setup_required",
        label: "Cloudflare Worker",
        warning:
          "Free Workers tier caps at 100k req/day and fails closed by default — set Fail Open or upgrade.",
      },
    ];
  }
  if (!demoFixturesEnabled(store)) return;
  if (store.robotsTxt == null) store.robotsTxt = DEFAULT_ROBOTS;
  if (store.agentLogs.length === 0) {
    seedAgentLogs(store);
  }
  if (store.gaReferrals.length === 0) {
    seedGaReferrals(store);
  }
}

function seedAgentLogs(store: DemoStore) {
  const domain = store.project.domain ?? "acme.example";
  const base = `https://${domain}`;
  const samples: Parameters<typeof ingestAccessLogBatch>[0] = [
    {
      timestamp: "2026-08-01T10:00:00Z",
      request_method: "GET",
      request_url: `${base}/legacy/pricing`,
      response_status: 404,
      user_agent: "Mozilla/5.0 (compatible; PerplexityBot/1.0)",
    },
    {
      timestamp: "2026-08-01T10:05:00Z",
      request_method: "GET",
      request_url: `${base}/legacy/pricing`,
      response_status: 404,
      user_agent: "GPTBot/2.0",
    },
    {
      timestamp: "2026-08-02T11:00:00Z",
      request_method: "GET",
      request_url: `${base}/docs/getting-started`,
      response_status: 200,
      user_agent: "ClaudeBot/1.0",
    },
    {
      timestamp: "2026-08-03T09:00:00Z",
      request_method: "GET",
      request_url: `${base}/blog/crm-guide`,
      response_status: 200,
      user_agent: "OAI-SearchBot/1.0",
    },
    {
      timestamp: "2026-08-03T09:30:00Z",
      request_method: "GET",
      request_url: `${base}/docs/getting-started`,
      response_status: 200,
      user_agent: "PerplexityBot/1.0",
    },
    {
      timestamp: "2026-08-04T08:00:00Z",
      request_method: "GET",
      request_url: `${base}/legacy/pricing`,
      response_status: 500,
      user_agent: "bingbot/2.0",
    },
  ];
  const res = ingestAccessLogBatch(samples, matchBot);
  store.agentLogs.push(...res.accepted);
}

function seedGaReferrals(store: DemoStore) {
  const rows: GaReferralDaily[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(2026, 7, 20 + i));
    const date = d.toISOString().slice(0, 10);
    rows.push({
      date,
      assistant: "ChatGPT",
      platform: "OpenAI",
      source: "chatgpt.com",
      medium: "referral",
      country: "US",
      device: "desktop",
      landing_page: "/docs/getting-started",
      page_path: "/docs/getting-started",
      session_starts: 12 + (i % 5),
      conversions: i % 4 === 0 ? 1 : 0,
      revenue: i % 4 === 0 ? 99 : 0,
      currency: "USD",
    });
    rows.push({
      date,
      assistant: "Perplexity",
      platform: "Perplexity",
      source: "perplexity.ai",
      medium: "referral",
      country: "US",
      device: "mobile",
      landing_page: "/pricing",
      page_path: "/pricing",
      session_starts: 5 + (i % 3),
      conversions: 0,
      revenue: 0,
      currency: "USD",
    });
  }
  store.gaReferrals = rows;
}

export function getCrawlability(store: DemoStore) {
  ensureAgentAnalytics(store);
  const known = store.robotsTxt != null;
  const report = known ? crawlabilityReport(store.robotsTxt!, AI_BOTS) : [];
  const blockedSearch = known ? blockedSearchBots(report) : [];
  return {
    domain: store.project.domain ?? null,
    robots_txt: store.robotsTxt ?? null,
    robots_fetched_at: store.robotsFetchedAt ?? null,
    robots_source: store.robotsSource ?? (known ? "manual" : null),
    data_state: dataState(store, known),
    rows: report,
    blocked_search_bots: blockedSearch,
    empty_reason: known
      ? null
      : store.project.domain
        ? "robots.txt has not been fetched for this domain yet."
        : "Set a project domain to fetch robots.txt.",
    categorization_note:
      "Bot types are best-effort from published vendor documentation.",
  };
}

/**
 * Fetch the live robots.txt for the project domain. A 404 is a real answer
 * (allow all) and is recorded as such; a network failure leaves state unknown.
 */
export async function refreshRobotsTxt(
  store: DemoStore,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number | null; error?: string }> {
  ensureAgentAnalytics(store);
  const domain = store.project.domain?.trim();
  if (!domain) return { ok: false, status: null, error: "no_project_domain" };
  const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  try {
    const res = await fetchImpl(`https://${host}/robots.txt`, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) {
      store.robotsTxt = "";
      store.robotsFetchedAt = new Date().toISOString();
      store.robotsSource = "fetched_404";
      return { ok: true, status: 404 };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: `http_${res.status}` };
    }
    store.robotsTxt = await res.text();
    store.robotsFetchedAt = new Date().toISOString();
    store.robotsSource = "fetched";
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  }
}

export function runUrlTester(store: DemoStore, pathOrUrl: string) {
  ensureAgentAnalytics(store);
  return testUrlAccess(store.robotsTxt ?? null, pathOrUrl, AI_BOTS);
}

export function ingestWebhookLogs(store: DemoStore, batch: unknown) {
  ensureAgentAnalytics(store);
  const res = ingestAccessLogBatch(batch, matchBot, {
    quotaRemaining: 1_000_000,
  });
  store.agentLogs.push(...res.accepted);
  return res;
}

export function ingestUploadedLogs(store: DemoStore, text: string) {
  ensureAgentAnalytics(store);
  const entries = parseAccessLogFile(text);
  return ingestWebhookLogs(store, entries);
}

/** Cloudflare path stub — records setup intent; real Worker deploy is Phase 11 ops. */
export function connectCloudflare(store: DemoStore) {
  ensureAgentAnalytics(store);
  const row = store.logIntegrations.find((i) => i.kind === "cloudflare");
  if (row) {
    row.status = "connected";
    row.connected_at = new Date().toISOString();
  }
  return {
    integration: row,
    warning:
      "Set the Worker route to Fail Open on free tier or traffic will 5xx for real visitors.",
  };
}

export function crawlInsightsDashboard(store: DemoStore) {
  ensureAgentAnalytics(store);
  const logs = store.agentLogs;
  const failure =
    logs.length === 0
      ? 0
      : logs.filter((l) => l.response_status >= 400).length / logs.length;

  // Aggregate prompt-tracking sources for join
  const byUrl = new Map<
    string,
    { retrievals: number; citations: number; topics: Set<string> }
  >();
  for (const s of store.sources) {
    const url = s.url.split("?")[0]!;
    const cur = byUrl.get(url) ?? {
      retrievals: 0,
      citations: 0,
      topics: new Set<string>(),
    };
    cur.retrievals += 1;
    if (s.cited) cur.citations += s.citation_count || 1;
    const chat = store.chats.find((c) => c.id === s.chat_id);
    const prompt = chat
      ? store.prompts.find((p) => p.id === chat.prompt_id)
      : undefined;
    const topic = prompt?.topic_id
      ? store.topics.find((t) => t.id === prompt.topic_id)?.name
      : undefined;
    if (topic) cur.topics.add(topic);
    byUrl.set(url, cur);
  }

  // Also map owned crawled URLs that appear in logs but not sources
  const visited = joinVisitedUrls(
    logs,
    [...byUrl.entries()].map(([url, v]) => ({
      url,
      retrievals: v.retrievals,
      citations: v.citations,
      topics: [...v.topics],
    })),
  );

  // Diagnose: crawled never cited — include seeded legacy URL even if path differs from sources
  const crawledNeverCited = visited.filter((v) => v.crawled_never_cited);

  const bots = new Set(logs.map((l) => l.bot_token));
  const connected = store.logIntegrations.some((i) => i.status === "connected");
  return {
    data_state: dataState(store, logs.length > 0),
    empty_reason:
      logs.length > 0
        ? null
        : connected
          ? "No AI bot visits recorded yet for the connected log source."
          : "Connect a log source (webhook, file upload, or Cloudflare Worker) to see AI bot crawl activity.",
    kpis: {
      total_bot_visits: logs.length,
      active_bots: bots.size,
      failure_rate: failure,
      top_folder: mode(logs.map((l) => l.request_folder)),
      top_url: visited[0]?.url ?? null,
    },
    status_codes: statusCodeHistogram(logs),
    visited_urls: visited,
    crawled_never_cited: crawledNeverCited,
    integrations: store.logIntegrations,
    quota_note: null as string | null,
    prompt_columns_note:
      "retrievals / citation_rate / topics come from prompt tracking — independent of bot activity.",
  };
}

function mode(xs: string[]): string | null {
  if (xs.length === 0) return null;
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

export function referralsOverview(store: DemoStore) {
  ensureAgentAnalytics(store);
  const rows = store.gaReferrals;
  const byAssistant = new Map<string, number>();
  let session_starts = 0;
  let conversions = 0;
  let revenue = 0;
  for (const r of rows) {
    session_starts += r.session_starts;
    conversions += r.conversions;
    revenue += r.revenue;
    byAssistant.set(
      r.assistant,
      (byAssistant.get(r.assistant) ?? 0) + r.session_starts,
    );
  }
  return {
    data_state: dataState(store, rows.length > 0),
    empty_reason:
      rows.length > 0
        ? null
        : "Connect GA4 to import assistant referral sessions. No traffic data is estimated on your behalf.",
    kpis: {
      session_starts,
      conversions,
      conversion_rate: session_starts === 0 ? 0 : conversions / session_starts,
      revenue,
      currency: rows[0]?.currency ?? "USD",
    },
    by_assistant: [...byAssistant.entries()].map(([assistant, sessions]) => ({
      assistant,
      sessions,
    })),
    series: rows,
    honesty: {
      floor_not_total:
        "AI Assistants is a floor, not a total. Google AI Overviews/AI Mode land in Organic Search; mobile AI apps often appear as Direct.",
      organic_search:
        "Organic Search hides Google AI Overviews and AI Mode traffic.",
      direct: "Direct includes AI apps and links that pass no referrer.",
    },
    definitions: {
      session_starts:
        "GA4 session_start events — not the GA4 sessions metric.",
      conversions: "GA4 key events (customer-configured).",
      landing_vs_page_path:
        "landing_page is session entry; page_path is where the event fired — they do not join.",
    },
  };
}

export function classifySampleReferral(input: {
  source?: string;
  medium?: string;
  referrerHost?: string;
  utmSource?: string;
}) {
  return classifyAssistantReferral(input);
}

/** Evidence for Actions R5/R6 from live agent analytics. */
export function agentEvidenceForActions(store: DemoStore) {
  ensureAgentAnalytics(store);
  const crawl = getCrawlability(store);
  const insights = crawlInsightsDashboard(store);
  return {
    robotsBlocks: crawl.blocked_search_bots.map((b) => ({
      bot: b.bot,
      kind: "search" as const,
      directive: `Blocked in robots.txt (${b.reason})`,
    })),
    crawlErrors: insights.visited_urls
      .filter((u) =>
        Object.keys(u.status_codes).some((c) => Number(c) >= 400),
      )
      .slice(0, 10)
      .map((u) => {
        const code = Number(
          Object.entries(u.status_codes).find(([c]) => Number(c) >= 400)?.[0] ??
            404,
        );
        return {
          url: u.url,
          status: code,
          botVisits: u.bot_visits,
        };
      }),
  };
}

export type { AgentLogRow };
