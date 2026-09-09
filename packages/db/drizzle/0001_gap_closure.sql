CREATE TABLE IF NOT EXISTS "project_extension" (
  "project_id" text PRIMARY KEY NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "payload_json" text NOT NULL DEFAULT '{}',
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
