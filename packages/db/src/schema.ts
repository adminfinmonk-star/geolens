/**
 * Drizzle-oriented schema types mirroring BUILD_SPEC §5 (Postgres).
 * Runtime seed for Phase 1 uses the in-memory store until DATABASE_URL is set.
 */

export interface Organization {
  id: string;
  name: string;
  domain?: string;
  timezone: string;
  plan_code: string;
  billing_period: "monthly" | "annual";
  is_agency: boolean;
  /** Agency credit pool override; null for brand plans. */
  credits_total?: number | null;
  bot_visits_used?: number;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  domain?: string;
  /** Free-text market location (e.g. "United States"). */
  location?: string;
  default_country: string;
  language: string;
  timezone: string;
  status: string;
  frequency: "daily" | "weekly";
  created_at: string;
}

export interface Brand {
  id: string;
  project_id: string;
  name: string;
  is_own: boolean;
  aliases: string[];
  patterns: string[];
}

export interface Prompt {
  id: string;
  project_id: string;
  text: string;
  country_code: string;
  topic_id?: string;
  status: "active" | "paused" | "archived";
  branding?: "branded" | "non-branded";
  intent_type?: "informational" | "commercial" | "transactional";
  volume_score?: number;
  persona?: string;
}

export interface Topic {
  id: string;
  project_id: string;
  name: string;
}

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  group?: string;
  is_system: boolean;
}

export interface BrandProfileRow {
  domain: string;
  name: string;
  industry: string;
  tagline: string;
  description: string;
  identityTags: string[];
  targetMarkets: string[];
  products: string[];
  personas: string[];
  reviewed: boolean;
}

export interface ChatRow {
  id: string;
  project_id: string;
  prompt_id: string;
  model_channel_id: string;
  country_code: string;
  run_date: string;
  status: "ok" | "empty" | "error" | "blocked";
  text: string;
  raw_uri?: string;
  /** Collection surface — never misrepresent api as ui. */
  surface_kind?: "ui" | "api" | "simulator";
}

export interface ChatBrandMention {
  chat_id: string;
  brand_id: string;
  mention_count: number;
  position: number;
  sentiment: number;
}

export interface ChatSource {
  chat_id: string;
  url: string;
  domain: string;
  cited: boolean;
  citation_count: number;
  retrieval_rank: number;
}

export interface ChatFanout {
  chat_id: string;
  text: string;
  type: "search" | "shopping" | "synthetic";
}

export interface ChatAd {
  chat_id: string;
  advertiser_name: string;
  ad_unit_type: string;
  target_url: string;
  title: string;
}

export interface SharedView {
  id: string;
  project_id: string;
  name: string;
  widgets: string[];
  created_at: string;
}

export type ActionStatus = "new" | "in_progress" | "done" | "declined";

export interface ActionStep {
  id: string;
  text: string;
  done: boolean;
}

export interface ActionEvidenceRow {
  kind: string;
  label: string;
  detail?: string;
  url?: string;
  metric?: number;
}

export interface ActionRecord {
  id: string;
  project_id: string;
  rule_id: string;
  group: "SITE_AUDIT" | "OWNED" | "EARNED";
  subtype: string;
  status: ActionStatus;
  overview: string;
  why_this_matters: string;
  competitor_evidence: string;
  brief: string;
  steps: ActionStep[];
  expected_outcome: string;
  additional_context?: string;
  scope: {
    topic?: string;
    models?: string[];
    country?: string;
    your_page?: string;
  };
  evidence: ActionEvidenceRow[];
  opportunity_score: number;
  relative_opportunity_score: 1 | 2 | 3;
  impact_band: string;
  created_at: string;
  updated_at: string;
}

export interface ActionStatusEvent {
  id: string;
  action_id: string;
  project_id: string;
  from: ActionStatus | null;
  to: ActionStatus;
  at: string;
  user_id?: string;
}

export const ID_PREFIX = {
  org: "org_",
  usr: "usr_",
  prj: "prj_",
  br: "br_",
  pr: "pr_",
  cht: "cht_",
  ses: "ses_",
  src: "src_",
  tpc: "tpc_",
  tag: "tag_",
  vw: "vw_",
  act: "act_",
  asev: "asev_",
  stp: "stp_",
  fct: "fct_",
  clm: "clm_",
  run: "run_",
  prd: "prd_",
  mer: "mer_",
  cat: "cat_",
  key: "key_",
  aud: "aud_",
  chk: "chk_",
} as const;


let seq = 0;
export function newId(prefix: keyof typeof ID_PREFIX): string {
  seq += 1;
  const t = Date.now().toString(36);
  return `${ID_PREFIX[prefix]}${t}${seq.toString(36)}`;
}
