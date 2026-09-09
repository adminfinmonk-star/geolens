/**
 * Fact-checking (§10.3) — atomic claims + verdicts. Pure / deterministic path for CI.
 */

export interface FactRow {
  id: string;
  statement: string;
  is_active: boolean;
}

export interface ClaimRow {
  id: string;
  chat_id: string;
  prompt_id: string;
  model_channel_id: string;
  brand_id: string;
  statement: string;
  category: string;
  claim_hash: string;
}

export type VerdictKind = "contradicted" | "supported";

export interface ClaimVerdict {
  claim_id: string;
  fact_id: string;
  verdict: VerdictKind;
  fact_statement_at_verdict: string;
}

/** Normalize for hash / comparison. */
export function claimHash(statement: string): string {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9$./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split a sentence into atomic claims.
 * "It starts at $49/mo, integrates with Salesforce, and has 10k customers" → 3.
 */
export function extractAtomicClaims(text: string): {
  statement: string;
  category: string;
}[] {
  const out: { statement: string; category: string }[] = [];
  const price =
    text.match(
      /\b(?:starts? at|priced at|costs?|from)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*mo|per month|\/month)?/i,
    ) ?? text.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*mo|per month)/i);
  if (price) {
    out.push({
      statement: `Starts at $${price[1]!.replace(/,/g, "")}/mo`,
      category: "pricing",
    });
  }
  const integ = text.match(
    /\bintegrates?\s+with\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)/,
  );
  if (integ) {
    out.push({
      statement: `Integrates with ${integ[1]}`,
      category: "integrations",
    });
  }
  const cust = text.match(/\b([\d,]+k?|\d+)\s+customers?\b/i);
  if (cust) {
    out.push({
      statement: `Has ${cust[1]} customers`,
      category: "availability",
    });
  }
  return out;
}

function parsePrice(statement: string): number | null {
  const m = statement.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]!.replace(/,/g, ""));
}

/**
 * Deterministic verdict: pricing facts vs claims.
 * Different prices ⇒ contradicted; same ⇒ supported.
 */
export function judgeClaimAgainstFacts(
  claim: { statement: string; category: string },
  facts: FactRow[],
): { fact: FactRow; verdict: VerdictKind } | null {
  const active = facts.filter((f) => f.is_active);
  if (claim.category === "pricing") {
    const claimPrice = parsePrice(claim.statement);
    if (claimPrice == null) return null;
    for (const f of active) {
      if (!/price|starts|\$|\/mo/i.test(f.statement)) continue;
      const factPrice = parsePrice(f.statement);
      if (factPrice == null) continue;
      return {
        fact: f,
        verdict: factPrice === claimPrice ? "supported" : "contradicted",
      };
    }
  }
  if (claim.category === "integrations") {
    for (const f of active) {
      if (!/integrat/i.test(f.statement)) continue;
      const claimTarget = claim.statement.match(/with\s+(.+)$/i)?.[1]?.toLowerCase();
      const factHas = claimTarget
        ? f.statement.toLowerCase().includes(claimTarget)
        : false;
      if (claimTarget) {
        return {
          fact: f,
          verdict: factHas ? "supported" : "contradicted",
        };
      }
    }
  }
  return null;
}

export function contradictedShare(input: {
  claimsWithVerdict: number;
  contradicted: number;
}): number {
  if (input.claimsWithVerdict === 0) return 0;
  return input.contradicted / input.claimsWithVerdict;
}
