ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "model_reported" text;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "provider_request_id" text;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "latency_ms" integer;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "error_code" text;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "error_detail" text;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "collected_at" timestamp with time zone DEFAULT now() NOT NULL;
