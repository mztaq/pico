-- Add Traffic Storm active-time usage to the existing Pico D1 analytics table.
-- Apply once to the correct Preview D1 database, then Production before deploying
-- a Pages build with the new Traffic Storm usage API.
-- Back up the database and verify the column is absent first:
-- PRAGMA table_info(pico_usage);
ALTER TABLE pico_usage
ADD COLUMN traffic_storm_seconds INTEGER NOT NULL DEFAULT 0 CHECK (traffic_storm_seconds >= 0);
