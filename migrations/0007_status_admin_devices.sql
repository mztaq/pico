CREATE TABLE IF NOT EXISTS pico_status_admin_invites (
  token_hash TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS pico_status_admin_sessions (
  id TEXT PRIMARY KEY,
  verifier_hash TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pico_status_admin_sessions_expiry
  ON pico_status_admin_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_pico_status_admin_invites_expiry
  ON pico_status_admin_invites(expires_at);
