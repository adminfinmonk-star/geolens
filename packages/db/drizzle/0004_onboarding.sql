-- Peec-style onboarding: free-text project location
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "location" text;
