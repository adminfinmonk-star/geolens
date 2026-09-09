import {
  claimHash,
  computePerceptionSummary,
  extractAtomicClaims,
  judgeClaimAgainstFacts,
  type AttributeScore,
  type ClaimVerdict,
} from "@geo/core";
import { newId } from "./schema.js";
import type { DemoStore } from "./seed.js";

export interface PerceptionAttributeRow extends AttributeScore {}

export interface FactRecord {
  id: string;
  project_id: string;
  statement: string;
  is_active: boolean;
  created_at: string;
}

export interface ClaimRecord {
  id: string;
  project_id: string;
  chat_id: string;
  prompt_id: string;
  model_channel_id: string;
  brand_id: string;
  statement: string;
  category: string;
  claim_hash: string;
  created_at: string;
}

export interface ClaimVerdictRecord extends ClaimVerdict {
  created_at: string;
}

export interface PerceptionRunMeta {
  id: string;
  kind: "market" | "objections" | "factcheck";
  industry: string;
  status: "SUCCEEDED";
  finished_at: string;
  next_run_at: string;
}

export function ensurePerception(store: DemoStore) {
  if (!store.facts) store.facts = [];
  if (!store.claims) store.claims = [];
  if (!store.claimVerdicts) store.claimVerdicts = [];
  if (!store.perceptionAttributes) store.perceptionAttributes = [];
  if (!store.perceptionRuns) store.perceptionRuns = [];
  if (!store.perceptionObjections) store.perceptionObjections = [];

  if (store.facts.length === 0) {
    seedFactsAndClaims(store);
  }
  if (store.perceptionAttributes.length === 0) {
    seedMarketPerception(store);
  }
  if (store.perceptionObjections.length === 0) {
    store.perceptionObjections = [
      {
        id: "obj_price",
        label: "Too expensive for small teams",
        score: 78,
        member_count: 4,
        phrasings: [
          "pricey for startups",
          "expensive compared to BetaSoft",
          "not worth it under 20 seats",
        ],
      },
      {
        id: "obj_complex",
        label: "Steep learning curve",
        score: 52,
        member_count: 3,
        phrasings: ["complex UI", "takes time to learn"],
      },
    ];
  }
}

function seedFactsAndClaims(store: DemoStore) {
  const now = new Date().toISOString();
  const own = store.brands.find((b) => b.is_own)!;
  const factPrice: FactRecord = {
    id: newId("fct"),
    project_id: store.project.id,
    statement: "Acme CRM starts at $49/mo",
    is_active: true,
    created_at: now,
  };
  const factInteg: FactRecord = {
    id: newId("fct"),
    project_id: store.project.id,
    statement: "Acme integrates with Salesforce and HubSpot",
    is_active: true,
    created_at: now,
  };
  store.facts.push(factPrice, factInteg);

  // Seed wrong price claim from a tracked chat (or synthetic)
  const chat =
    store.chats.find((c) => c.text.toLowerCase().includes("$9")) ??
    store.chats[0]!;
  const wrongText =
    "Acme starts at $9/mo, integrates with Salesforce, and has 10k customers.";
  const atoms = extractAtomicClaims(wrongText);
  for (const atom of atoms) {
    const claim: ClaimRecord = {
      id: newId("clm"),
      project_id: store.project.id,
      chat_id: chat.id,
      prompt_id: chat.prompt_id,
      model_channel_id: chat.model_channel_id,
      brand_id: own.id,
      statement: atom.statement,
      category: atom.category,
      claim_hash: claimHash(atom.statement),
      created_at: now,
    };
    store.claims.push(claim);
    const judged = judgeClaimAgainstFacts(atom, store.facts);
    if (judged) {
      store.claimVerdicts.push({
        claim_id: claim.id,
        fact_id: judged.fact.id,
        verdict: judged.verdict,
        fact_statement_at_verdict: judged.fact.statement,
        created_at: now,
      });
    }
  }

  // Also scan a sample of chats for more claims
  for (const c of store.chats.slice(0, 40)) {
    if (!c.text) continue;
    const mentionsOwn = store.mentions.some(
      (m) => m.chat_id === c.id && m.brand_id === own.id,
    );
    if (!mentionsOwn) continue;
    for (const atom of extractAtomicClaims(c.text)) {
      const hash = claimHash(atom.statement);
      if (store.claims.some((x) => x.claim_hash === hash)) continue;
      const claim: ClaimRecord = {
        id: newId("clm"),
        project_id: store.project.id,
        chat_id: c.id,
        prompt_id: c.prompt_id,
        model_channel_id: c.model_channel_id,
        brand_id: own.id,
        statement: atom.statement,
        category: atom.category,
        claim_hash: hash,
        created_at: c.run_date + "T12:00:00.000Z",
      };
      store.claims.push(claim);
      const judged = judgeClaimAgainstFacts(atom, store.facts);
      if (judged) {
        store.claimVerdicts.push({
          claim_id: claim.id,
          fact_id: judged.fact.id,
          verdict: judged.verdict,
          fact_statement_at_verdict: judged.fact.statement,
          created_at: claim.created_at,
        });
      }
    }
  }
}

function seedMarketPerception(store: DemoStore) {
  const finished = new Date().toISOString();
  store.perceptionRuns.push({
    id: newId("run"),
    kind: "market",
    industry: store.brandProfile.industry || "CRM software",
    status: "SUCCEEDED",
    finished_at: finished,
    next_run_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });

  // ≥4 attributes; Reliability = biggest gap (#1 association → #9 market)
  store.perceptionAttributes = [
    {
      attributeId: "attr_reliable",
      label: "Reliability",
      association: 94,
      market_prominence: 18,
      market_rank: 9,
      brands_carrying: 14,
    },
    {
      attributeId: "attr_affordable",
      label: "Value for money",
      association: 48,
      market_prominence: 72,
      market_rank: 2,
      brands_carrying: 11,
    },
    {
      attributeId: "attr_security",
      label: "Security",
      association: 61,
      market_prominence: 55,
      market_rank: 4,
      brands_carrying: 10,
    },
    {
      attributeId: "attr_integ",
      label: "Integrations",
      association: 70,
      market_prominence: 40,
      market_rank: 6,
      brands_carrying: 12,
    },
    {
      attributeId: "attr_analytics",
      label: "Analytics",
      association: 58,
      market_prominence: 50,
      market_rank: 5,
      brands_carrying: 9,
    },
  ];
}

export function marketPerceptionReport(store: DemoStore) {
  ensurePerception(store);
  const own = store.brands.find((b) => b.is_own)!;
  const run = store.perceptionRuns.find((r) => r.kind === "market");
  const summary = computePerceptionSummary(
    store.perceptionAttributes,
    own.name,
    [
      { brand: "BetaSoft", mean: 71 },
      { brand: "CloudNine", mean: 63 },
      { brand: "DataPeak", mean: 54 },
    ],
  );
  return {
    run,
    snapshot_note:
      "Perception is snapshot-per-run with no date range. Tracked prompt edits do not change these results.",
    attributes: store.perceptionAttributes,
    summary,
    cards_note:
      "Association and market prominence share a 0–100 scale but are not comparable.",
  };
}

export function objectionsReport(store: DemoStore) {
  ensurePerception(store);
  return {
    rows: store.perceptionObjections,
    guidance:
      "Separate false objections (content/PR) from true ones (product feedback). Mid-range scores are ambiguous — expand and filter by model.",
  };
}

export function factcheckReport(store: DemoStore) {
  ensurePerception(store);
  const contradicted = store.claimVerdicts
    .filter((v) => v.verdict === "contradicted")
    .map((v) => {
      const claim = store.claims.find((c) => c.id === v.claim_id)!;
      return {
        ...v,
        claim,
        fact: store.facts.find((f) => f.id === v.fact_id),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100);

  const byFact = store.facts.map((f) => {
    const related = store.claimVerdicts.filter((v) => v.fact_id === f.id);
    return {
      fact: f,
      verdicts: related.length,
      contradicted: related.filter((v) => v.verdict === "contradicted").length,
      never_comes_up: related.length === 0,
    };
  });

  const byCategory = new Map<
    string,
    { claims: number; chats: Set<string>; contradicted: number; judged: number }
  >();
  for (const c of store.claims) {
    const cur = byCategory.get(c.category) ?? {
      claims: 0,
      chats: new Set<string>(),
      contradicted: 0,
      judged: 0,
    };
    cur.claims += 1;
    cur.chats.add(c.chat_id);
    const v = store.claimVerdicts.find((x) => x.claim_id === c.id);
    if (v) {
      cur.judged += 1;
      if (v.verdict === "contradicted") cur.contradicted += 1;
    }
    byCategory.set(c.category, cur);
  }

  return {
    honesty:
      "AI can be wrong about you for months with nothing here if you never asserted the catching fact. Add starting price, integrations, and guarantees first.",
    contradicted,
    by_fact: byFact,
    by_category: [...byCategory.entries()].map(([category, v]) => ({
      category,
      claims: v.claims,
      chats: v.chats.size,
      contradicted_share: v.judged === 0 ? 0 : v.contradicted / v.judged,
    })),
    facts: store.facts,
    claims_total: store.claims.length,
  };
}

export function contradictedClaimsForActions(store: DemoStore) {
  ensurePerception(store);
  return store.claimVerdicts
    .filter((v) => v.verdict === "contradicted")
    .map((v) => {
      const claim = store.claims.find((c) => c.id === v.claim_id);
      const fact = store.facts.find((f) => f.id === v.fact_id);
      return {
        claim: claim?.statement ?? "unknown claim",
        sources: [fact?.statement ?? "asserted fact"].filter(Boolean),
      };
    });
}
