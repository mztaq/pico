-- D1 migration 0003: put last_updated second and add Binary Lab at the end.
-- Based on the verified production CREATE TABLE pico_usage statement.
-- Apply ONCE after backing up the correct database and confirming this column does not exist.
-- Wrangler's D1 migrations system rolls back the migration if any statement fails.
-- Do not use PRAGMA foreign_keys=OFF: D1 enforces foreign keys.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE pico_usage_reordered (
  visitor_id TEXT PRIMARY KEY,
  last_updated INTEGER NOT NULL,
  logic_sim_seconds INTEGER NOT NULL DEFAULT 0,
  python_seconds INTEGER NOT NULL DEFAULT 0,
  pseudocode_seconds INTEGER NOT NULL DEFAULT 0,
  flowchart_seconds INTEGER NOT NULL DEFAULT 0,
  cpu_studio_seconds INTEGER NOT NULL DEFAULT 0,
  binary_lab_seconds INTEGER NOT NULL DEFAULT 0 CHECK (binary_lab_seconds >= 0),
  FOREIGN KEY (visitor_id) REFERENCES pico_visitors(visitor_id) ON DELETE CASCADE
);

INSERT INTO pico_usage_reordered (
  visitor_id,
  last_updated,
  logic_sim_seconds,
  python_seconds,
  pseudocode_seconds,
  flowchart_seconds,
  cpu_studio_seconds,
  binary_lab_seconds
)
SELECT
  visitor_id,
  last_updated,
  logic_sim_seconds,
  python_seconds,
  pseudocode_seconds,
  flowchart_seconds,
  cpu_studio_seconds,
  0
FROM pico_usage;

DROP TABLE pico_usage;
ALTER TABLE pico_usage_reordered RENAME TO pico_usage;

PRAGMA foreign_key_check;
