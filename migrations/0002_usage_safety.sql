-- Apply once in the preview D1 Console before deploying the updated API.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pico_usage_events (
  visitor_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0 CHECK (applied IN (0,1)),
  PRIMARY KEY (visitor_id, batch_id),
  FOREIGN KEY (visitor_id) REFERENCES pico_visitors(visitor_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pico_usage_events_expiry
ON pico_usage_events(created_at);

-- HMAC-based visitor-address rate-limit keys, not raw IP addresses.
CREATE TABLE IF NOT EXISTS pico_rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pico_rate_limits_expiry
ON pico_rate_limits(expires_at);

