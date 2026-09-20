CREATE TABLE IF NOT EXISTS password_reset (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset(user_id);
