/**
 * URL normalization (BUILD_SPEC §7.4.1).
 * Pure — no I/O.
 */
export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    try {
      url = new URL(`https://${raw.trim()}`);
    } catch {
      return raw.trim().toLowerCase();
    }
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4);
  }

  const drop = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "ref",
  ]);

  const kept: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    if (!drop.has(key)) kept.push([key, value]);
  });
  kept.sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [k, v] of kept) {
    url.searchParams.append(k, v);
  }

  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  url.pathname = path || "/";

  return url.toString();
}

export function extractDomain(normalizedUrl: string): string {
  try {
    return new URL(normalizedUrl).hostname;
  } catch {
    return normalizedUrl;
  }
}
