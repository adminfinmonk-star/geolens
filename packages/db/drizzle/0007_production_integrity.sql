CREATE TABLE IF NOT EXISTS "shared_view" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "widgets_json" text NOT NULL DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "shared_view_project_idx"
  ON "shared_view" ("project_id");

CREATE TABLE IF NOT EXISTS "billing_webhook_event" (
  "id" text PRIMARY KEY,
  "event_type" text NOT NULL,
  "project_id" text,
  "processed_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "raw_payload_json" text;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "retrieval_mode" text;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "locale" text;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "collector_version" text;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "extraction_version" text;
