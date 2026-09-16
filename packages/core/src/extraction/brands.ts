/**
 * Brand detection (§7.1) — alias / regex matching. Pure functions.
 */

export interface BrandMatcher {
  brandId: string;
  name: string;
  aliases: string[];
  /** Optional case-insensitive regex patterns (source strings). */
  patterns: string[];
}

export interface BrandMention {
  brandId: string;
  brandName: string;
  matchedText: string;
  start: number;
  end: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileMatchers(brands: BrandMatcher[]): Array<{
  brand: BrandMatcher;
  regex: RegExp;
}> {
  return brands.flatMap((brand) => {
    const terms = [brand.name, ...brand.aliases].filter(Boolean);
    const fromTerms = terms.map((term) => ({
      brand,
      regex: new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"),
    }));
    const fromPatterns = brand.patterns.map((p) => ({
      brand,
      regex: new RegExp(p, "gi"),
    }));
    return [...fromTerms, ...fromPatterns];
  });
}

/** Find all brand mentions in answer text. Overlapping matches: longer wins. */
export function findBrandMentions(
  text: string,
  brands: BrandMatcher[],
): BrandMention[] {
  const compiled = compileMatchers(brands);
  const hits: BrandMention[] = [];

  for (const { brand, regex } of compiled) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: canonical exec loop for a global regex.
    while ((m = regex.exec(text)) !== null) {
      hits.push({
        brandId: brand.brandId,
        brandName: brand.name,
        matchedText: m[0],
        start: m.index,
        end: m.index + m[0].length,
      });
      if (m[0].length === 0) regex.lastIndex++;
    }
  }

  // Resolve overlaps: keep longer match, then earlier
  hits.sort((a, b) => {
    const lenDiff = b.end - b.start - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return a.start - b.start;
  });

  const accepted: BrandMention[] = [];
  for (const hit of hits) {
    const overlaps = accepted.some(
      (a) => !(hit.end <= a.start || hit.start >= a.end),
    );
    if (!overlaps) accepted.push(hit);
  }

  return accepted.sort((a, b) => a.start - b.start);
}
