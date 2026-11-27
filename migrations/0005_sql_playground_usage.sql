-- Apply once to the Preview and Production D1 databases before deploying this build.
-- Verify the column is absent first: PRAGMA table_info(pico_usage);
-- Only consented workspace activity time is stored, never SQL or database contents.
ALTER TABLE pico_usage
ADD COLUMN sql_playground_seconds INTEGER NOT NULL DEFAULT 0;
