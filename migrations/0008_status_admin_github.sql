-- GitHub OAuth admin sessions. Run in existing pico-db D1.
-- If 0007 was already applied, these statements safely do nothing.
-- Audit table is created by migration 0006_status_admin.sql.
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
