import {
  boolean,
  char,
  date,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** §5.2 + session auth tables (Phase 0). */

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  timezone: text("timezone").notNull().default("UTC"),
  planCode: text("plan_code").notNull().default("trial"),
  billingPeriod: text("billing_period").notNull().default("monthly"),
  isAgency: boolean("is_agency").notNull().default(false),
  creditsTotal: integer("credits_total"),
  botVisitsUsed: integer("bot_visits_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const appUser = pgTable("app_user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orgMember = pgTable(
  "org_member",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain"),
  location: text("location"),
  defaultCountry: char("default_country", { length: 2 }).notNull().default("US"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
  status: text("status").notNull().default("ONBOARDING"),
  frequency: text("frequency").notNull().default("daily"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const brand = pgTable("brand", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isOwn: boolean("is_own").notNull().default(false),
  aliasesJson: text("aliases_json").notNull().default("[]"),
  patternsJson: text("patterns_json").notNull().default("[]"),
});

export const prompt = pgTable("prompt", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  countryCode: char("country_code", { length: 2 }).notNull().default("US"),
  status: text("status").notNull().default("active"),
});

/** Fact tables — DATA_BACKEND=postgres path (§3.2). */
export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    promptId: text("prompt_id")
      .notNull()
      .references(() => prompt.id, { onDelete: "cascade" }),
    modelChannelId: text("model_channel_id").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    runDate: date("run_date").notNull(),
    status: text("status").notNull(),
    text: text("text").notNull().default(""),
    rawUri: text("raw_uri"),
    /** Provenance of the answer: "api" | "ui" | "simulator". Drives live-vs-fixture honesty. */
    surfaceKind: text("surface_kind"),
  },
  (t) => [uniqueIndex("chat_project_run_idx").on(t.projectId, t.runDate, t.id)],
);

export const chatBrandMention = pgTable(
  "chat_brand_mention",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "cascade" }),
    mentionCount: integer("mention_count").notNull(),
    position: integer("position").notNull(),
    sentiment: doublePrecision("sentiment").notNull(),
  },
  (t) => [primaryKey({ columns: [t.chatId, t.brandId] })],
);

export const chatSource = pgTable("chat_source", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  cited: boolean("cited").notNull().default(false),
  citationCount: integer("citation_count").notNull().default(0),
  retrievalRank: integer("retrieval_rank").notNull(),
});

/** Feature-slice JSON for Actions/Perception/Shopping/Agent (§ gap-closure). */
export const projectExtension = pgTable("project_extension", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => project.id, { onDelete: "cascade" }),
  payloadJson: text("payload_json").notNull().default("{}"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apiKey = pgTable("api_key", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => project.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scopesJson: text("scopes_json").notNull().default('["read"]'),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  projectId: text("project_id"),
  actorUserId: text("actor_user_id"),
  actorLabel: text("actor_label"),
  source: text("source").notNull(),
  action: text("action").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
