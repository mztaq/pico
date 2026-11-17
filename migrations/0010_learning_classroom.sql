-- Pico Classroom. Apply to the D1 database bound to Pages as DB.
-- No student email addresses, accounts or source code are retained.
CREATE TABLE IF NOT EXISTS pico_classroom_rooms (
  id TEXT PRIMARY KEY,
  join_code TEXT NOT NULL UNIQUE,
  challenge_id TEXT NOT NULL,
  host_token_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pico_classroom_rooms_expiry
ON pico_classroom_rooms(expires_at);

CREATE TABLE IF NOT EXISTS pico_classroom_players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES pico_classroom_rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  joined_at INTEGER NOT NULL,
  UNIQUE(room_id, nickname)
);

CREATE INDEX IF NOT EXISTS idx_pico_classroom_players_room
ON pico_classroom_players(room_id);

CREATE TABLE IF NOT EXISTS pico_classroom_results (
  room_id TEXT NOT NULL REFERENCES pico_classroom_rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES pico_classroom_players(id) ON DELETE CASCADE,
  passed INTEGER NOT NULL,
  total INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  submitted_at INTEGER NOT NULL,
  PRIMARY KEY(room_id, player_id)
);

CREATE TABLE IF NOT EXISTS pico_classroom_limits (
  bucket TEXT NOT NULL,
  window INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(bucket, window)
);

CREATE INDEX IF NOT EXISTS idx_pico_classroom_limits_window
ON pico_classroom_limits(window);
