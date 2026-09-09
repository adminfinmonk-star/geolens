import { describe, expect, it } from "vitest";
import {
  blockedSearchBots,
  crawlabilityReport,
  parseRobots,
  pathAllowed,
  testUrlAccess,
} from "./index.js";

const BOTS = [
  { userAgentToken: "GPTBot", vendor: "OpenAI", type: "training" },
  { userAgentToken: "OAI-SearchBot", vendor: "OpenAI", type: "search" },
  { userAgentToken: "PerplexityBot", vendor: "Perplexity", type: "search" },
  { userAgentToken: "Googlebot", vendor: "Google", type: "search" },
];

describe("parseRobots", () => {
  it("blocks root for a specific agent", () => {
    const txt = `
User-agent: OAI-SearchBot
Disallow: /

User-agent: *
Allow: /
`;
    const parsed = parseRobots(txt);
    const oai = parsed.groups.find((g) => g.agents.includes("oai-searchbot"))!;
    expect(pathAllowed(oai, "/")).toBe(false);
    expect(pathAllowed(oai, "/blog")).toBe(false);
  });

  it("Allow wins over shorter Disallow for a path", () => {
    const txt = `
User-agent: *
Disallow: /private
Allow: /private/public
`;
    const parsed = parseRobots(txt);
    const g = parsed.groups[0]!;
    expect(pathAllowed(g, "/private/secret")).toBe(false);
    expect(pathAllowed(g, "/private/public")).toBe(true);
  });
});

describe("crawlabilityReport", () => {
  it("marks blocked search bots for R5", () => {
    const report = crawlabilityReport(
      `User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n`,
      BOTS,
    );
    const blocked = blockedSearchBots(report);
    expect(blocked.some((b) => b.bot === "OAI-SearchBot")).toBe(true);
    expect(report.find((r) => r.bot === "Googlebot")?.status).toBe("Allowed");
  });

  it("404 robots ⇒ all Allowed", () => {
    const report = crawlabilityReport(null, BOTS);
    expect(report.every((r) => r.status === "Allowed")).toBe(true);
  });
});

describe("testUrlAccess", () => {
  it("evaluates a specific path", () => {
    const res = testUrlAccess(
      `User-agent: *\nDisallow: /admin\nAllow: /\n`,
      "https://acme.example/admin/settings",
      BOTS,
    );
    expect(res.path).toBe("/admin/settings");
    expect(res.rows.every((r) => r.allowed === false)).toBe(true);
  });
});
