import {
  computeDomainReport,
  computeUrlReport,
  filterGaps,
  gapGuidance,
  type DomainClass,
  type DomainReportRow,
  type UrlReportRow,
} from "@geo/core";
import type { DemoStore } from "./seed.js";

/** In-memory Phase 2 overrides / bookmarks (per process). */
const classificationOverrides = new Map<string, Map<string, DomainClass>>();
const bookmarks = new Map<string, Set<string>>();

function overridesFor(projectId: string): Record<string, DomainClass> {
  const m = classificationOverrides.get(projectId);
  if (!m) return {};
  return Object.fromEntries(m.entries());
}

function bookmarksFor(projectId: string): Set<string> {
  let s = bookmarks.get(projectId);
  if (!s) {
    s = new Set();
    bookmarks.set(projectId, s);
  }
  return s;
}

export function setDomainClassification(
  projectId: string,
  domain: string,
  classification: DomainClass | null,
) {
  let m = classificationOverrides.get(projectId);
  if (!m) {
    m = new Map();
    classificationOverrides.set(projectId, m);
  }
  if (classification == null) m.delete(domain);
  else m.set(domain, classification);
}

export function toggleBookmark(projectId: string, key: string): boolean {
  const s = bookmarksFor(projectId);
  if (s.has(key)) {
    s.delete(key);
    return false;
  }
  s.add(key);
  return true;
}

export function reportsFromStore(store: DemoStore) {
  const projectId = store.project.id;
  const totalChatCount = store.chats.filter(
    (c) => c.status === "ok" || c.status === "empty",
  ).length;
  const trackedCompetitorCount = store.brands.filter((b) => !b.is_own).length;
  const ownedDomains = store.project.domain ? [store.project.domain] : [];
  const competitorDomains = store.brands
    .filter((b) => !b.is_own)
    .flatMap((b) => {
      // heuristic: brandname.example from simulator world
      const slug = b.name.toLowerCase().replace(/\s+/g, "");
      return [`${slug}.example`];
    });

  const sources = store.sources.map((s) => ({
    chatId: s.chat_id,
    url: s.url,
    domain: s.domain,
    cited: s.cited,
    citationCount: s.citation_count,
  }));
  const mentions = store.mentions.map((m) => {
    const brand = store.brands.find((b) => b.id === m.brand_id);
    return {
      chatId: m.chat_id,
      brandId: m.brand_id,
      isOwn: brand?.is_own ?? false,
    };
  });

  const domains = computeDomainReport({
    sources,
    mentions,
    totalChatCount,
    ownedDomains,
    competitorDomains,
    trackedCompetitorCount,
    classificationOverrides: overridesFor(projectId),
    bookmarks: bookmarksFor(projectId),
  });

  const urls = computeUrlReport({
    sources,
    mentions,
    trackedCompetitorCount,
    ownedDomains,
    competitorDomains,
    classificationOverrides: overridesFor(projectId),
    bookmarks: bookmarksFor(projectId),
  });

  const domainGaps = filterGaps(domains).map((r) => ({
    ...r,
    guidance: gapGuidance(r.classification),
    entity: "domain" as const,
  }));
  const urlGaps = filterGaps(urls).map((r) => ({
    ...r,
    guidance: gapGuidance(r.classification),
    entity: "url" as const,
  }));

  return { domains, urls, domainGaps, urlGaps };
}

export type { DomainReportRow, UrlReportRow, DomainClass };
