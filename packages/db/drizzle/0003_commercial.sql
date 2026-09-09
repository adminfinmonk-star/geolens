-- Phase 11 commercial columns + audit_log
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "credits_total" integer;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "bot_visits_used" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "project_id" text,
  "actor_user_id" text,
  "actor_label" text,
  "source" text NOT NULL,
  "action" text NOT NULL,
  "before_json" text,
  "after_json" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_log_org_idx" ON "audit_log" ("organization_id", "created_at");
