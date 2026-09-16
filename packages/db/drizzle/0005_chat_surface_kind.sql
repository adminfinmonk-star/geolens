-- Persist answer provenance so live-vs-fixture honesty survives an API restart.
-- Without this the Overview "Live collection" badge silently reverted to false
-- once the in-memory store was rebuilt from Postgres.
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "surface_kind" text;
