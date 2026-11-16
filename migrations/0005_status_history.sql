-- Pico status archive. Run in the existing pico-db D1 database.
-- This migration adds only tables and indexes. It does not alter visitor data.
CREATE TABLE IF NOT EXISTS pico_status_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'uptimerobot',
  external_id TEXT NOT NULL,
  service_id TEXT NOT NULL CHECK (service_id IN ('website', 'mcp', 'oauth')),
  title TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  status TEXT NOT NULL DEFAULT 'investigating'
    CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_pico_status_incidents_started
  ON pico_status_incidents(started_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pico_status_incidents_service
  ON pico_status_incidents(service_id, started_at DESC);

CREATE TABLE IF NOT EXISTS pico_status_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES pico_status_incidents(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  stage TEXT NOT NULL
    CHECK (stage IN ('investigating', 'identified', 'monitoring', 'resolved')),
  message TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE (incident_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_pico_status_updates_incident
  ON pico_status_updates(incident_id, published_at DESC);
