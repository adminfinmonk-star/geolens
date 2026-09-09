export interface AccessLogEntry {
  timestamp: string;
  request_method: string;
  request_url: string;
  response_status: number;
  user_agent: string;
  country_code?: string;
  client_ip?: string;
  referer?: string;
}

export interface AgentLogRow {
  timestamp: string;
  request_method: string;
  request_url: string;
  request_path: string;
  request_folder: string;
  response_status: number;
  user_agent: string;
  bot_token: string;
  bot_vendor: string;
  bot_type: string;
  country_code?: string;
}

export interface CrawlUrlMetrics {
  url: string;
  bot_visits: number;
  platforms: string[];
  status_codes: Record<string, number>;
  /** From prompt tracking — independent of bot activity. */
  retrievals: number;
  citation_rate: number;
  topics: string[];
  /** Crawled but never cited in AI answers. */
  crawled_never_cited: boolean;
}

function firstPathSegment(url: string): string {
  try {
    const path = new URL(url).pathname || "/";
    const seg = path.split("/").filter(Boolean)[0];
    return seg ? `/${seg}` : "/";
  } catch {
    return "/";
  }
}

function requestPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
}

export type BotMatcher = (ua: string) => {
  userAgentToken: string;
  vendor: string;
  type: string;
} | null;

/**
 * Filter + normalize access log batch. Non-AI traffic discarded at ingest.
 * Max 500 entries; returns per-row errors instead of silent drops.
 */
export function ingestAccessLogBatch(
  batch: unknown,
  matchBot: BotMatcher,
  opts?: { maxEntries?: number; quotaRemaining?: number },
): {
  accepted: AgentLogRow[];
  errors: { index: number; error: string }[];
  discarded_non_bot: number;
  quota_exhausted: boolean;
} {
  const max = opts?.maxEntries ?? 500;
  const errors: { index: number; error: string }[] = [];
  const accepted: AgentLogRow[] = [];
  let discarded_non_bot = 0;
  let quota_exhausted = false;
  let quotaLeft = opts?.quotaRemaining ?? Infinity;

  if (!Array.isArray(batch)) {
    return {
      accepted: [],
      errors: [{ index: -1, error: "body_must_be_array" }],
      discarded_non_bot: 0,
      quota_exhausted: false,
    };
  }
  if (batch.length > max) {
    return {
      accepted: [],
      errors: [{ index: -1, error: `max_${max}_entries` }],
      discarded_non_bot: 0,
      quota_exhausted: false,
    };
  }

  batch.forEach((raw, index) => {
    const e = raw as Partial<AccessLogEntry>;
    if (!e.timestamp || !e.request_method || !e.request_url || e.response_status == null || !e.user_agent) {
      errors.push({ index, error: "missing_required_field" });
      return;
    }
    const status = Number(e.response_status);
    if (!Number.isFinite(status) || status < 100 || status > 599) {
      errors.push({ index, error: "invalid_status" });
      return;
    }
    const bot = matchBot(String(e.user_agent));
    if (!bot) {
      discarded_non_bot += 1;
      return;
    }
    if (quotaLeft <= 0) {
      quota_exhausted = true;
      return;
    }
    quotaLeft -= 1;
    accepted.push({
      timestamp: String(e.timestamp),
      request_method: String(e.request_method).toUpperCase(),
      request_url: String(e.request_url),
      request_path: requestPath(String(e.request_url)),
      request_folder: firstPathSegment(String(e.request_url)),
      response_status: status,
      user_agent: String(e.user_agent),
      bot_token: bot.userAgentToken,
      bot_vendor: bot.vendor,
      bot_type: bot.type,
      country_code: e.country_code,
    });
  });

  return { accepted, errors, discarded_non_bot, quota_exhausted };
}

/** Parse simple CLF or CSV lines into AccessLogEntry shapes. */
export function parseAccessLogFile(text: string): AccessLogEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out: AccessLogEntry[] = [];
  for (const line of lines) {
    if (line.includes(",")) {
      // CSV: timestamp,method,url,status,user_agent
      const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length >= 5) {
        out.push({
          timestamp: parts[0]!,
          request_method: parts[1]!,
          request_url: parts[2]!,
          response_status: Number(parts[3]),
          user_agent: parts.slice(4).join(","),
        });
      }
      continue;
    }
    // Common Log-ish: host ident user [date] "METHOD URL PROTO" status size "ref" "ua"
    const m = line.match(
      /^\S+ \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]+) [^"]+" (\d{3}) \S+ "[^"]*" "([^"]*)"/,
    );
    if (m) {
      out.push({
        timestamp: new Date(m[1]!).toISOString(),
        request_method: m[2]!,
        request_url: m[3]!.startsWith("http") ? m[3]! : `https://example.com${m[3]}`,
        response_status: Number(m[4]),
        user_agent: m[5]!,
      });
    }
  }
  return out;
}

export function joinVisitedUrls(
  logs: AgentLogRow[],
  promptSources: {
    url: string;
    retrievals: number;
    citations: number;
    topics: string[];
  }[],
): CrawlUrlMetrics[] {
  const byUrl = new Map<
    string,
    {
      visits: number;
      platforms: Set<string>;
      codes: Record<string, number>;
    }
  >();
  for (const log of logs) {
    const url = log.request_url.split("?")[0]!;
    const cur = byUrl.get(url) ?? {
      visits: 0,
      platforms: new Set<string>(),
      codes: {},
    };
    cur.visits += 1;
    cur.platforms.add(log.bot_vendor);
    const key = String(log.response_status);
    cur.codes[key] = (cur.codes[key] ?? 0) + 1;
    byUrl.set(url, cur);
  }

  const sourceByUrl = new Map(
    promptSources.map((s) => [s.url.split("?")[0]!, s]),
  );

  return [...byUrl.entries()]
    .map(([url, v]) => {
      const src = sourceByUrl.get(url);
      const retrievals = src?.retrievals ?? 0;
      const citations = src?.citations ?? 0;
      const citation_rate = retrievals === 0 ? 0 : citations / retrievals;
      return {
        url,
        bot_visits: v.visits,
        platforms: [...v.platforms],
        status_codes: v.codes,
        retrievals,
        citation_rate,
        topics: src?.topics ?? [],
        crawled_never_cited: v.visits > 0 && citations === 0,
      };
    })
    .sort((a, b) => b.bot_visits - a.bot_visits);
}

export const BASELINE_STATUS_CODES = [
  200, 301, 302, 304, 307, 308, 401, 403, 404, 410, 429, 500, 502, 503, 504,
] as const;

export function statusCodeHistogram(logs: AgentLogRow[]): Record<string, number> {
  const hist: Record<string, number> = {};
  for (const c of BASELINE_STATUS_CODES) hist[String(c)] = 0;
  for (const log of logs) {
    const k = String(log.response_status);
    hist[k] = (hist[k] ?? 0) + 1;
  }
  return hist;
}
