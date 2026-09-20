CREATE TABLE IF NOT EXISTS report_schedule (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL,
  last_sent_at timestamptz,
  last_error text,
  lease_until timestamptz,
  lease_token text,
  UNIQUE(project_id, user_id)
);
