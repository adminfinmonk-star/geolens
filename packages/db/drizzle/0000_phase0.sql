CREATE TABLE IF NOT EXISTS "organization" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "domain" text,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "plan_code" text DEFAULT 'trial' NOT NULL,
  "billing_period" text DEFAULT 'monthly' NOT NULL,
  "is_agency" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "app_user" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "name" text,
  "password_hash" text NOT NULL,
  "avatar_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "org_member" (
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("organization_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "project" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "domain" text,
  "default_country" char(2) DEFAULT 'US' NOT NULL,
  "language" text DEFAULT 'en' NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "status" text DEFAULT 'ONBOARDING' NOT NULL,
  "frequency" text DEFAULT 'daily' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "brand" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "is_own" boolean DEFAULT false NOT NULL,
  "aliases_json" text DEFAULT '[]' NOT NULL,
  "patterns_json" text DEFAULT '[]' NOT NULL
);

CREATE TABLE IF NOT EXISTS "prompt" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "country_code" char(2) DEFAULT 'US' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL
);

CREATE TABLE IF NOT EXISTS "chat" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "prompt_id" text NOT NULL REFERENCES "prompt"("id") ON DELETE CASCADE,
  "model_channel_id" text NOT NULL,
  "country_code" char(2) NOT NULL,
  "run_date" date NOT NULL,
  "status" text NOT NULL,
  "text" text DEFAULT '' NOT NULL,
  "raw_uri" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_project_run_idx" ON "chat" ("project_id", "run_date", "id");

CREATE TABLE IF NOT EXISTS "chat_brand_mention" (
  "chat_id" text NOT NULL REFERENCES "chat"("id") ON DELETE CASCADE,
  "brand_id" text NOT NULL REFERENCES "brand"("id") ON DELETE CASCADE,
  "mention_count" integer NOT NULL,
  "position" integer NOT NULL,
  "sentiment" double precision NOT NULL,
  PRIMARY KEY ("chat_id", "brand_id")
);

CREATE TABLE IF NOT EXISTS "chat_source" (
  "id" text PRIMARY KEY NOT NULL,
  "chat_id" text NOT NULL REFERENCES "chat"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "domain" text NOT NULL,
  "cited" boolean DEFAULT false NOT NULL,
  "citation_count" integer DEFAULT 0 NOT NULL,
  "retrieval_rank" integer NOT NULL
);
