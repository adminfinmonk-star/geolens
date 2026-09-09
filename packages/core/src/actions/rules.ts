import {
  ADDRESSABILITY,
  EFFORT,
  computeOpportunityScore,
  relativeOpportunityScore,
  type ScoreInputs,
} from "./scoring.js";

export type ActionGroup = "SITE_AUDIT" | "OWNED" | "EARNED";
export type ActionRuleId =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8"
  | "R9"
  | "R10";

export interface ActionEvidenceRow {
  kind: string;
  label: string;
  detail?: string;
  url?: string;
  metric?: number;
}

export interface GeneratedActionDraft {
  rule_id: ActionRuleId;
  group: ActionGroup;
  subtype: string;
  overview: string;
  why_this_matters: string;
  competitor_evidence: string;
  brief: string;
  steps: { text: string }[];
  expected_outcome: string;
  additional_context?: string;
  scope: {
    topic?: string;
    models?: string[];
    country?: string;
    your_page?: string;
  };
  evidence: ActionEvidenceRow[];
  score_inputs: ScoreInputs;
  opportunity_score: number;
  relative_opportunity_score: 1 | 2 | 3;
}

export interface DomainEvidence {
  domain: string;
  classification: string;
  retrieval_count: number;
  gap_score: number;
  gap_score_normalized: number;
  competitor_brands_mentioned: number;
  own_brand_mentioned: boolean;
  total_citations: number;
}

export interface UrlEvidence {
  url: string;
  domain: string;
  classification: string;
  retrieval_count: number;
  citation_count: number;
  citation_rate: number;
  gap_score: number;
  own_brand_mentioned: boolean;
  competitor_brands_mentioned: number;
}

export interface TopicPageTypeGap {
  topicId: string;
  topicName: string;
  pageType: string;
  competitorCitedCount: number;
  ownCitedCount: number;
  competitorUrls: { url: string; citations: number }[];
}

export interface FanoutCoverageGap {
  text: string;
  type: string;
  occurrences: number;
  ownDomainInSources: boolean;
}

export interface RobotsBlock {
  bot: string;
  kind: "search" | "other";
  directive: string;
}

export interface CrawlError {
  url: string;
  status: number;
  botVisits: number;
}

export interface ContradictedClaim {
  claim: string;
  sources: string[];
}

export interface ProductAttributeGap {
  product: string;
  attribute: string;
  competitorValues: string[];
}

export interface ActionsEvidenceBundle {
  ownBrandName: string;
  ownDomains: string[];
  windowDays: number;
  domains: DomainEvidence[];
  urls: UrlEvidence[];
  topicPageTypeGaps: TopicPageTypeGap[];
  fanouts: FanoutCoverageGap[];
  robotsBlocks: RobotsBlock[];
  crawlErrors: CrawlError[];
  contradictedClaims: ContradictedClaim[];
  productAttributeGaps: ProductAttributeGap[];
  /** topicId → 0–1 importance */
  topicImportance: Record<string, number>;
  /** Minimum competitor citations for R1 (default 3). */
  r1Threshold?: number;
  /** Minimum retrievals for R3 (default 5). */
  r3Threshold?: number;
  /** Min retrievals for R4/R7 (default 5). */
  highRetrievalThreshold?: number;
  /** Min fanout occurrences for R10 (default 5). */
  fanoutThreshold?: number;
}

function finalize(
  draft: Omit<
    GeneratedActionDraft,
    "opportunity_score" | "relative_opportunity_score"
  >,
): GeneratedActionDraft {
  const opportunity_score = computeOpportunityScore(draft.score_inputs);
  return {
    ...draft,
    opportunity_score,
    relative_opportunity_score: relativeOpportunityScore(opportunity_score),
  };
}

/** R1 OWNED / missing page type */
export function ruleR1(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  const N = bundle.r1Threshold ?? 3;
  const out: GeneratedActionDraft[] = [];
  for (const g of bundle.topicPageTypeGaps) {
    if (g.competitorCitedCount < N || g.ownCitedCount > 0) continue;
    const evidence: ActionEvidenceRow[] = g.competitorUrls.map((u) => ({
      kind: "competitor_url",
      label: u.url,
      url: u.url,
      metric: u.citations,
      detail: `${u.citations} citations in last ${bundle.windowDays}d`,
    }));
    evidence.push({
      kind: "gap",
      label: `${g.pageType} × ${g.topicName}`,
      detail: `Competitors cited ${g.competitorCitedCount}×; you have 0`,
      metric: g.competitorCitedCount,
    });
    out.push(
      finalize({
        rule_id: "R1",
        group: "OWNED",
        subtype: "owned_pages",
        overview: `Publish a ${g.pageType} covering ${g.topicName}`,
        why_this_matters: `Competitor ${g.pageType} pages were cited in ${g.competitorCitedCount} conversations about ${g.topicName} in the last ${bundle.windowDays} days, while you have no ${g.pageType} covering the topic.`,
        competitor_evidence: g.competitorUrls
          .slice(0, 5)
          .map((u) => `${u.url} (${u.citations} cites)`)
          .join("; "),
        brief: `Outline a ${g.pageType} for "${g.topicName}" that answers the same questions competitor pages cover. Lead with a direct comparison/definition, then sections for criteria buyers ask about.`,
        steps: [
          { text: `Audit competitor URLs for structure and claims` },
          { text: `Draft ${g.pageType} brief grounded in the evidence rows` },
          { text: `Publish on ${bundle.ownDomains[0] ?? "your domain"} and request re-crawl` },
        ],
        expected_outcome: `Close the ${g.pageType} citation gap on ${g.topicName}`,
        scope: { topic: g.topicName },
        evidence,
        score_inputs: {
          gap_volume: Math.min(1, g.competitorCitedCount / 20),
          competitor_density: Math.min(1, g.competitorUrls.length / 5),
          topic_importance: bundle.topicImportance[g.topicId] ?? 0.5,
          addressability: ADDRESSABILITY.OWNED,
          estimated_effort: EFFORT.new_page,
        },
      }),
    );
  }
  return out;
}

/** R2 EARNED / editorial gap */
export function ruleR2(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  const editorial = bundle.domains.filter((d) => d.classification === "EDITORIAL");
  if (editorial.length === 0) return [];
  const scores = editorial.map((d) => d.gap_score).sort((a, b) => a - b);
  const p70 = scores[Math.floor(scores.length * 0.7)] ?? scores[scores.length - 1]!;
  return editorial
    .filter((d) => d.gap_score >= p70 && !d.own_brand_mentioned)
    .map((d) =>
      finalize({
        rule_id: "R2",
        group: "EARNED",
        subtype: "editorial",
        overview: `Pursue coverage on ${d.domain}`,
        why_this_matters: `${d.domain} is an editorial source with gap score ${d.gap_score.toFixed(2)} (above the 70th percentile in this view). Competitors appear in ${d.competitor_brands_mentioned} brand-mention contexts while ${bundle.ownBrandName} does not.`,
        competitor_evidence: `Competitor brands mentioned on retrievals from ${d.domain}; ${d.total_citations} total citations.`,
        brief: `Pitch a contributed piece or analyst briefing to ${d.domain} that positions ${bundle.ownBrandName} for the topics where this domain is already retrieved.`,
        steps: [
          { text: `List recent articles on ${d.domain} that cite competitors` },
          { text: `Prepare media kit + proof points from tracked chats` },
          { text: `Outreach to editors covering your category` },
        ],
        expected_outcome: `Earn citations from ${d.domain} in future AI answers`,
        scope: {},
        evidence: [
          {
            kind: "domain",
            label: d.domain,
            metric: d.gap_score,
            detail: `gap_score=${d.gap_score.toFixed(3)}, retrievals=${d.retrieval_count}`,
          },
          {
            kind: "threshold",
            label: "70th percentile gap",
            metric: p70,
            detail: `Action fires when gap_score ≥ ${p70.toFixed(3)}`,
          },
        ],
        score_inputs: {
          gap_volume: Math.min(1, d.gap_score_normalized || d.gap_score),
          competitor_density: Math.min(1, d.competitor_brands_mentioned / 4),
          topic_importance: 0.5,
          addressability: ADDRESSABILITY.EDITORIAL,
          estimated_effort: EFFORT.earned_placement,
        },
      }),
    );
}

/** R3 REFERENCE / record correction */
export function ruleR3(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  const N = bundle.r3Threshold ?? 5;
  return bundle.domains
    .filter(
      (d) =>
        d.classification === "REFERENCE" &&
        d.retrieval_count >= N &&
        !d.own_brand_mentioned,
    )
    .map((d) =>
      finalize({
        rule_id: "R3",
        group: "EARNED",
        subtype: "reference",
        overview: `Claim/correct your entry on ${d.domain}`,
        why_this_matters: `${d.domain} was retrieved ${d.retrieval_count} times without mentioning ${bundle.ownBrandName}. Reference sources shape how models describe the category.`,
        competitor_evidence: `${d.competitor_brands_mentioned} competitor brand mentions observed on this domain's retrievals.`,
        brief: `Audit the ${d.domain} entry for your category, claim ownership if missing, and correct factual gaps using primary sources.`,
        steps: [
          { text: `Find the relevant ${d.domain} page(s)` },
          { text: `Compare listed brands vs your tracked set` },
          { text: `Submit corrections / claim the listing` },
        ],
        expected_outcome: `${bundle.ownBrandName} appears on ${d.domain} and in downstream AI answers`,
        scope: {},
        evidence: [
          {
            kind: "domain",
            label: d.domain,
            metric: d.retrieval_count,
            detail: "REFERENCE domain without own-brand mention",
          },
        ],
        score_inputs: {
          gap_volume: Math.min(1, d.retrieval_count / 30),
          competitor_density: Math.min(1, d.competitor_brands_mentioned / 4),
          topic_importance: 0.45,
          addressability: ADDRESSABILITY.REFERENCE,
          estimated_effort: EFFORT.directory_claim,
        },
      }),
    );
}

/** R4 UGC / community presence */
export function ruleR4(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  const N = bundle.highRetrievalThreshold ?? 5;
  const threads = bundle.urls.filter(
    (u) =>
      u.classification === "UGC" &&
      u.retrieval_count >= N &&
      u.competitor_brands_mentioned > 0 &&
      !u.own_brand_mentioned,
  );
  const byDomain = new Map<string, UrlEvidence[]>();
  for (const t of threads) {
    const list = byDomain.get(t.domain) ?? [];
    list.push(t);
    byDomain.set(t.domain, list);
  }
  return [...byDomain.entries()].map(([domain, urls]) =>
    finalize({
      rule_id: "R4",
      group: "EARNED",
      subtype: "ugc",
      overview: `Engage in ${domain}`,
      why_this_matters: `${urls.length} high-retrieval UGC thread(s) on ${domain} name competitors but not ${bundle.ownBrandName}.`,
      competitor_evidence: urls
        .slice(0, 5)
        .map((u) => u.url)
        .join("; "),
      brief: `Join the exact threads below with helpful, non-spammy answers that cite your primary docs.`,
      steps: [
        { text: `Prioritize threads by retrieval_count` },
        { text: `Draft authentic replies (no marketing dump)` },
        { text: `Monitor for follow-up questions` },
      ],
      expected_outcome: `Organic mentions of ${bundle.ownBrandName} on ${domain}`,
      scope: {},
      evidence: urls.slice(0, 10).map((u) => ({
        kind: "thread",
        label: u.url,
        url: u.url,
        metric: u.retrieval_count,
        detail: `competitors=${u.competitor_brands_mentioned}`,
      })),
      score_inputs: {
        gap_volume: Math.min(
          1,
          urls.reduce((s, u) => s + u.retrieval_count, 0) / 40,
        ),
        competitor_density: Math.min(
          1,
          Math.max(...urls.map((u) => u.competitor_brands_mentioned)) / 4,
        ),
        topic_importance: 0.4,
        addressability: ADDRESSABILITY.UGC,
        estimated_effort: EFFORT.community,
      },
    }),
  );
}

/** R5 SITE_AUDIT / crawl blocked */
export function ruleR5(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  return bundle.robotsBlocks
    .filter((b) => b.kind === "search")
    .map((b) =>
      finalize({
        rule_id: "R5",
        group: "SITE_AUDIT",
        subtype: "crawlability",
        overview: `Unblock ${b.bot} in robots.txt`,
        why_this_matters: `Search-type bot ${b.bot} is blocked (${b.directive}). A blocked search bot means the engine structurally cannot cite you.`,
        competitor_evidence: "N/A — technical accessibility gap",
        brief: `Allow ${b.bot} on public content paths while keeping private/admin paths disallowed.`,
        steps: [
          { text: `Inspect robots.txt for User-agent: ${b.bot}` },
          { text: `Remove or narrow Disallow for public marketing pages` },
          { text: `Verify with a live URL test` },
        ],
        expected_outcome: `${b.bot} can crawl and potentially cite ${bundle.ownDomains[0] ?? "your site"}`,
        scope: { your_page: "/robots.txt" },
        evidence: [
          {
            kind: "robots",
            label: b.bot,
            detail: b.directive,
          },
        ],
        score_inputs: {
          gap_volume: 0.95,
          competitor_density: 0.2,
          topic_importance: 0.7,
          addressability: ADDRESSABILITY.SITE_AUDIT,
          estimated_effort: EFFORT.technical_fix,
        },
      }),
    );
}

/** R6 SITE_AUDIT / crawl errors */
export function ruleR6(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  return bundle.crawlErrors
    .filter((e) => e.status >= 400 && e.botVisits >= 1)
    .map((e) =>
      finalize({
        rule_id: "R6",
        group: "SITE_AUDIT",
        subtype: "crawl_errors",
        overview: `Fix ${e.status} on ${e.url}`,
        why_this_matters: `Bots visited ${e.url} ${e.botVisits} time(s) and received HTTP ${e.status}. Broken pages cannot be cited.`,
        competitor_evidence: "N/A",
        brief: `Resolve the ${e.status} (redirect, restore, or remove from sitemaps) so crawlers land on a 200.`,
        steps: [
          { text: `Reproduce the ${e.status}` },
          { text: `Ship fix or 301 to replacement` },
          { text: `Update sitemap / internal links` },
        ],
        expected_outcome: `Healthy crawl responses for ${e.url}`,
        scope: { your_page: e.url },
        evidence: [
          {
            kind: "crawl_error",
            label: e.url,
            url: e.url,
            metric: e.status,
            detail: `bot_visits=${e.botVisits}`,
          },
        ],
        score_inputs: {
          gap_volume: Math.min(1, e.botVisits / 10),
          competitor_density: 0.1,
          topic_importance: 0.5,
          addressability: ADDRESSABILITY.SITE_AUDIT,
          estimated_effort: EFFORT.technical_fix,
        },
      }),
    );
}

/** R7 OWNED / retrieved but not cited */
export function ruleR7(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  const N = bundle.highRetrievalThreshold ?? 5;
  return bundle.urls
    .filter(
      (u) =>
        u.classification === "OWN" &&
        u.retrieval_count >= N &&
        u.citation_rate < 0.05,
    )
    .map((u) =>
      finalize({
        rule_id: "R7",
        group: "OWNED",
        subtype: "owned_pages",
        overview: `Restructure ${u.url} for extractability`,
        why_this_matters: `Your page was retrieved ${u.retrieval_count} times with citation rate ${(u.citation_rate * 100).toFixed(1)}%. Models see it but rarely quote it — improve headings, direct answers, tables, and freshness.`,
        competitor_evidence: `Competitors are cited elsewhere while this owned URL stalls at ${u.citation_count} citations.`,
        brief: `Add a clear H1 answer, FAQ schema, comparison table, and updated dates so extractors can lift passages.`,
        steps: [
          { text: `Identify the question this URL should answer in one sentence` },
          { text: `Add scannable structure (H2s, lists, table)` },
          { text: `Refresh stats and publish date` },
        ],
        expected_outcome: `Higher citation rate on ${u.url}`,
        scope: { your_page: u.url },
        evidence: [
          {
            kind: "owned_url",
            label: u.url,
            url: u.url,
            metric: u.retrieval_count,
            detail: `citation_rate=${u.citation_rate.toFixed(3)}`,
          },
        ],
        score_inputs: {
          gap_volume: Math.min(1, u.retrieval_count / 25),
          competitor_density: 0.3,
          topic_importance: 0.55,
          addressability: ADDRESSABILITY.OWNED,
          estimated_effort: EFFORT.page_edit,
        },
      }),
    );
}

/** R8 OWNED / fact correction */
export function ruleR8(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  return bundle.contradictedClaims.map((c) =>
    finalize({
      rule_id: "R8",
      group: "OWNED",
      subtype: "fact_correction",
      overview: `Correct claim — cited from ${c.sources[0] ?? "sources"}`,
      why_this_matters: `Models repeat a contradicted claim: "${c.claim}". Cited sources still carry the wrong fact.`,
      competitor_evidence: c.sources.join("; "),
      brief: `Update primary pages and request corrections on the citing sources so the next enrichment run clears the contradiction.`,
      steps: [
        { text: `Verify the true value from your system of record` },
        { text: `Patch owned pages that state the claim` },
        { text: `Contact citing publishers listed in evidence` },
      ],
      expected_outcome: `Claim no longer contradicted in fact-check runs`,
      scope: {},
      evidence: [
        { kind: "claim", label: c.claim, detail: "contradicted" },
        ...c.sources.map((s) => ({
          kind: "source",
          label: s,
          url: s.startsWith("http") ? s : undefined,
        })),
      ],
      score_inputs: {
        gap_volume: 0.7,
        competitor_density: 0.2,
        topic_importance: 0.6,
        addressability: ADDRESSABILITY.OWNED,
        estimated_effort: EFFORT.page_edit,
      },
    }),
  );
}

/** R9 SHOPPING / attribute coverage */
export function ruleR9(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  return bundle.productAttributeGaps.map((g) =>
    finalize({
      rule_id: "R9",
      group: "OWNED",
      subtype: "shopping",
      overview: `Add ${g.attribute} to ${g.product} PDP`,
      why_this_matters: `AI comparison grids show ${g.attribute} for competitors (${g.competitorValues.join(", ")}) but a blank for ${g.product}.`,
      competitor_evidence: g.competitorValues.join("; "),
      brief: `Publish a clear ${g.attribute} value on the ${g.product} product page and structured data.`,
      steps: [
        { text: `Confirm canonical ${g.attribute} value` },
        { text: `Update PDP + feed attributes` },
        { text: `Re-check shopping answers after next collection` },
      ],
      expected_outcome: `${g.product} no longer blank for ${g.attribute}`,
      scope: { your_page: g.product },
      evidence: [
        {
          kind: "attribute_gap",
          label: `${g.product} · ${g.attribute}`,
          detail: `competitors: ${g.competitorValues.join(", ")}`,
        },
      ],
      score_inputs: {
        gap_volume: 0.55,
        competitor_density: Math.min(1, g.competitorValues.length / 3),
        topic_importance: 0.5,
        addressability: ADDRESSABILITY.SHOPPING,
        estimated_effort: EFFORT.product_pdp,
      },
    }),
  );
}

/** R10 OWNED / fanout coverage */
export function ruleR10(bundle: ActionsEvidenceBundle): GeneratedActionDraft[] {
  const N = bundle.fanoutThreshold ?? 5;
  return bundle.fanouts
    .filter((f) => f.occurrences >= N && !f.ownDomainInSources)
    .map((f) =>
      finalize({
        rule_id: "R10",
        group: "OWNED",
        subtype: "owned_pages",
        overview: `Create content answering "${f.text}"`,
        why_this_matters: `Fanout query "${f.text}" occurred ${f.occurrences} times; retrieved sources never included ${bundle.ownDomains[0] ?? "your domain"}.`,
        competitor_evidence: "Sources retrieved for this fanout exclude your domain",
        brief: `Publish a focused page that directly answers "${f.text}" with extractable sections.`,
        steps: [
          { text: `Map intent of the fanout query` },
          { text: `Draft answer-first page` },
          { text: `Internal-link from related commercial pages` },
        ],
        expected_outcome: `Your domain appears in retrievals for this fanout`,
        scope: {},
        evidence: [
          {
            kind: "fanout",
            label: f.text,
            metric: f.occurrences,
            detail: `type=${f.type}`,
          },
        ],
        score_inputs: {
          gap_volume: Math.min(1, f.occurrences / 30),
          competitor_density: 0.4,
          topic_importance: 0.5,
          addressability: ADDRESSABILITY.OWNED,
          estimated_effort: EFFORT.new_page,
        },
      }),
    );
}

const ALL_RULES = [
  ruleR1,
  ruleR2,
  ruleR3,
  ruleR4,
  ruleR5,
  ruleR6,
  ruleR7,
  ruleR8,
  ruleR9,
  ruleR10,
] as const;

/** Run R1–R10 over an evidence bundle. */
export function generateActions(
  bundle: ActionsEvidenceBundle,
): GeneratedActionDraft[] {
  return ALL_RULES.flatMap((rule) => rule(bundle)).sort(
    (a, b) => b.opportunity_score - a.opportunity_score,
  );
}
