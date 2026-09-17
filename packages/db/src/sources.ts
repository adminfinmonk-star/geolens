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

function overridesFor(store: DemoStore): Record<string, DomainClass> {
  if (store.sourceClassifications) return store.sourceClassifications;
  const projectId = store.project.id;
  const m = classificationOverrides.get(projectId);
  if (!m) return {};
  return Object.fromEntries(m.entries());
}

function bookmarksFor(store: DemoStore): Set<string> {
  if (store.sourceBookmarks) return new Set(store.sourceBookmarks);
  const projectId = store.project.id;
  let s = bookmarks.get(projectId);
  if (!s) {
    s = new Set();
    bookmarks.set(projectId, s);
  }
  return s;
}

export function setDomainClassification(
  store: DemoStore,
  domain: string,
  classification: DomainClass | null,
) {
  store.sourceClassifications ??= {};
  if (classification == null) delete store.sourceClassifications[domain];
  else store.sourceClassifications[domain] = classification;
}

export function toggleBookmark(store: DemoStore, key: string): boolean {
  const s = bookmarksFor(store);
  if (s.has(key)) {
    s.delete(key);
    store.sourceBookmarks = [...s];
    return false;
  }
  s.add(key);
  store.sourceBookmarks = [...s];
  return true;
}

export function reportsFromStore(store: DemoStore) {
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
    classificationOverrides: overridesFor(store),
    bookmarks: bookmarksFor(store),
  });

  const urls = computeUrlReport({
    sources,
    mentions,
    trackedCompetitorCount,
    ownedDomains,
    competitorDomains,
    classificationOverrides: overridesFor(store),
    bookmarks: bookmarksFor(store),
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
