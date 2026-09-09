/** Seeded CRM / B2B SaaS market model for the simulator (§6.3). */

export interface SimBrand {
  id: string;
  name: string;
  /** Latent strength 0–1 by topic key. */
  strength: Record<string, number>;
  /** Mean sentiment [-1, 1]. */
  sentimentMean: number;
  /** Slow daily drift applied after dayOffset. */
  driftPerDay: number;
  /** Step change: from this day index onward, add to strength. */
  stepDay?: number;
  stepDelta?: number;
}

export interface SimDomain {
  domain: string;
  classification: "owned" | "editorial" | "ugc" | "competitor" | "other";
  weight: number;
}

export interface SimWorld {
  topicKey: string;
  brands: SimBrand[];
  domains: SimDomain[];
  searchRate: number;
}

export const DEFAULT_WORLD: SimWorld = {
  topicKey: "crm",
  searchRate: 0.85,
  brands: [
    {
      id: "br_acme",
      name: "Acme",
      strength: { crm: 0.72, analytics: 0.4 },
      sentimentMean: 0.35,
      driftPerDay: 0.0005,
      stepDay: 45,
      stepDelta: 0.08,
    },
    {
      id: "br_beta",
      name: "BetaSoft",
      strength: { crm: 0.55, analytics: 0.6 },
      sentimentMean: 0.1,
      driftPerDay: -0.0003,
    },
    {
      id: "br_gamma",
      name: "GammaHQ",
      strength: { crm: 0.48, analytics: 0.35 },
      sentimentMean: 0.05,
      driftPerDay: 0.001,
    },
    {
      id: "br_delta",
      name: "DeltaForce CRM",
      strength: { crm: 0.4, analytics: 0.25 },
      sentimentMean: -0.05,
      driftPerDay: 0,
    },
    {
      id: "br_echo",
      name: "EchoOps",
      strength: { crm: 0.33, analytics: 0.5 },
      sentimentMean: 0.15,
      driftPerDay: 0.0002,
    },
    {
      id: "br_foxtrot",
      name: "Foxtrot",
      strength: { crm: 0.28, analytics: 0.22 },
      sentimentMean: 0,
      driftPerDay: 0,
    },
  ],
  domains: [
    { domain: "acme.example", classification: "owned", weight: 0.12 },
    { domain: "techcrunch.com", classification: "editorial", weight: 0.18 },
    { domain: "reddit.com", classification: "ugc", weight: 0.22 },
    { domain: "g2.com", classification: "editorial", weight: 0.15 },
    { domain: "betasoft.example", classification: "competitor", weight: 0.1 },
    { domain: "wikipedia.org", classification: "other", weight: 0.08 },
    { domain: "medium.com", classification: "ugc", weight: 0.08 },
    { domain: "forbes.com", classification: "editorial", weight: 0.07 },
  ],
};

export function effectiveStrength(
  brand: SimBrand,
  topic: string,
  dayIndex: number,
): number {
  const base = brand.strength[topic] ?? 0.2;
  let s = base + brand.driftPerDay * dayIndex;
  if (brand.stepDay !== undefined && dayIndex >= brand.stepDay) {
    s += brand.stepDelta ?? 0;
  }
  return Math.max(0.05, Math.min(0.95, s));
}
