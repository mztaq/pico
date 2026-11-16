-- Add audit records for the protected Pico status editor.
-- Does not modify existing visitor, monitoring or incident data.
CREATE TABLE IF NOT EXISTS pico_status_admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES pico_status_incidents(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update')),
  stage TEXT NOT NULL CHECK (stage IN ('investigating','identified','monitoring','resolved')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pico_status_admin_audit_actor_time
  ON pico_status_admin_audit(actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pico_status_admin_audit_incident
  ON pico_status_admin_audit(incident_id, id DESC);
