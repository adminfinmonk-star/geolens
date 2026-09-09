/**
 * RFC 9309 robots.txt parser (subset used for Crawlability §12.1).
 * Pure — no I/O.
 */

export interface RobotsRule {
  pathPrefix: string;
  allow: boolean;
  /** Original pattern length for longest-match precedence. */
  patternLength: number;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  raw: string;
}

function normalizePattern(pattern: string): { pathPrefix: string; patternLength: number } {
  let p = pattern.trim();
  // Strip end-anchor for prefix matching; keep length for precedence
  const patternLength = p.length;
  if (p.endsWith("$")) p = p.slice(0, -1);
  // Collapse * wildcards to empty for simple prefix checks (RFC longest match still uses length)
  p = p.replace(/\*+/g, "");
  if (!p.startsWith("/")) p = `/${p}`;
  return { pathPrefix: p || "/", patternLength };
}

export function parseRobots(txt: string): ParsedRobots {
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let pendingAgents: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      if (current && current.rules.length > 0 && pendingAgents.length === 0) {
        // New block after rules → start fresh
        current = null;
      }
      if (!current || current.rules.length > 0) {
        pendingAgents = [agent];
        current = { agents: pendingAgents, rules: [] };
        groups.push(current);
      } else {
        pendingAgents.push(agent);
        current.agents = pendingAgents;
      }
      continue;
    }

    if (key === "allow" || key === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      if (value === "" && key === "disallow") {
        // Empty Disallow = allow all (no rule)
        continue;
      }
      const { pathPrefix, patternLength } = normalizePattern(value || "/");
      current.rules.push({
        pathPrefix,
        allow: key === "allow",
        patternLength,
      });
    }
  }

  return { groups, raw: txt };
}

function groupForAgent(parsed: ParsedRobots, agent: string): {
  group: RobotsGroup | null;
  reason: string;
} {
  const target = agent.toLowerCase();
  // Most-specific (longest agent token that matches) among explicit groups
  let best: RobotsGroup | null = null;
  let bestLen = -1;
  for (const g of parsed.groups) {
    for (const a of g.agents) {
      if (a === "*") continue;
      if (target.includes(a) || a.includes(target)) {
        if (a.length > bestLen) {
          best = g;
          bestLen = a.length;
        }
      }
    }
  }
  if (best) return { group: best, reason: "explicit rule for this bot" };
  const star = parsed.groups.find((g) => g.agents.includes("*")) ?? null;
  if (star) return { group: star, reason: "inherited from wildcard" };
  return { group: null, reason: "no matching group (default allow)" };
}

export type CrawlStatus = "Allowed" | "Partial" | "Blocked";

export function pathAllowed(group: RobotsGroup | null, path: string): boolean {
  if (!group || group.rules.length === 0) return true;
  const p = path.startsWith("/") ? path : `/${path}`;
  let best: RobotsRule | null = null;
  for (const rule of group.rules) {
    const prefix = rule.pathPrefix.replace(/\*$/, "");
    if (p === prefix || p.startsWith(prefix === "/" ? "/" : prefix)) {
      // Special: Disallow: / blocks everything
      if (rule.pathPrefix === "/" && !rule.allow) {
        if (!best || rule.patternLength >= best.patternLength) best = rule;
        continue;
      }
      if (prefix === "/" && rule.allow && rule.patternLength <= 1) {
        // Allow: / is weak
        if (!best) best = rule;
        continue;
      }
      if (!best || rule.patternLength > best.patternLength) best = rule;
      else if (best && rule.patternLength === best.patternLength && rule.allow) {
        // Allow wins ties per common practice / RFC 9309 longest-match; equal length Allow preferred
        best = rule;
      }
    }
  }
  if (!best) return true;
  return best.allow;
}

export function evaluateBot(
  parsed: ParsedRobots,
  bot: { userAgentToken: string; vendor: string; type: string },
): {
  bot: string;
  platform: string;
  type: string;
  status: CrawlStatus;
  reason: string;
} {
  const { group, reason } = groupForAgent(parsed, bot.userAgentToken);
  let status: CrawlStatus = "Allowed";
  if (group) {
    const rootBlocked = !pathAllowed(group, "/");
    const hasDisallow = group.rules.some((r) => !r.allow);
    if (rootBlocked) status = "Blocked";
    else if (hasDisallow) status = "Partial";
    else status = "Allowed";
  }
  return {
    bot: bot.userAgentToken,
    platform: bot.vendor,
    type: bot.type,
    status,
    reason,
  };
}

export function crawlabilityReport(
  robotsTxt: string | null,
  bots: { userAgentToken: string; vendor: string; type: string }[],
): ReturnType<typeof evaluateBot>[] {
  // 404 / missing ⇒ all Allowed
  if (robotsTxt == null || robotsTxt.trim() === "") {
    return bots.map((bot) => ({
      bot: bot.userAgentToken,
      platform: bot.vendor,
      type: bot.type,
      status: "Allowed" as const,
      reason: "no robots.txt (404 ⇒ allow all)",
    }));
  }
  const parsed = parseRobots(robotsTxt);
  return bots.map((b) => evaluateBot(parsed, b));
}

/** URL Tester: which bots may fetch this path. */
export function testUrlAccess(
  robotsTxt: string | null,
  pathOrUrl: string,
  bots: { userAgentToken: string; vendor: string; type: string }[],
): {
  path: string;
  rows: {
    bot: string;
    platform: string;
    type: string;
    allowed: boolean;
    reason: string;
  }[];
} {
  let path = pathOrUrl;
  try {
    path = new URL(pathOrUrl).pathname || "/";
  } catch {
    if (!path.startsWith("/")) path = `/${path}`;
  }
  if (robotsTxt == null || robotsTxt.trim() === "") {
    return {
      path,
      rows: bots.map((b) => ({
        bot: b.userAgentToken,
        platform: b.vendor,
        type: b.type,
        allowed: true,
        reason: "no robots.txt",
      })),
    };
  }
  const parsed = parseRobots(robotsTxt);
  return {
    path,
    rows: bots.map((b) => {
      const { group, reason } = groupForAgent(parsed, b.userAgentToken);
      return {
        bot: b.userAgentToken,
        platform: b.vendor,
        type: b.type,
        allowed: pathAllowed(group, path),
        reason,
      };
    }),
  };
}

/** Search-type bots that are fully blocked — feeds Actions R5. */
export function blockedSearchBots(
  report: ReturnType<typeof crawlabilityReport>,
): { bot: string; platform: string; reason: string }[] {
  return report
    .filter((r) => r.type === "search" && r.status === "Blocked")
    .map((r) => ({ bot: r.bot, platform: r.platform, reason: r.reason }));
}
