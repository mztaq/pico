-- Circuit Clash classrooms. Apply to Cloudflare D1 in the Pico Pages environment.
-- Deploy this version of 0010, not the earlier draft for coding challenges.
CREATE TABLE IF NOT EXISTS pico_arena_rooms (
  id TEXT PRIMARY KEY,
  join_code TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT 'all',
  host_token_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'lobby' CHECK (state IN ('lobby','playing','finished')),
  seed INTEGER NOT NULL,
  duration INTEGER NOT NULL DEFAULT 180,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  starts_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pico_arena_rooms_expires
ON pico_arena_rooms(expires_at);

CREATE TABLE IF NOT EXISTS pico_arena_players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES pico_arena_rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  joined_at INTEGER NOT NULL,
  charge INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  amplifier INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  answered INTEGER NOT NULL DEFAULT 0,
  question_cursor INTEGER NOT NULL DEFAULT 0,
  last_answer_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE(room_id,nickname)
);
CREATE INDEX IF NOT EXISTS idx_pico_arena_players_room
ON pico_arena_players(room_id);

CREATE TABLE IF NOT EXISTS pico_arena_nodes (
  room_id TEXT NOT NULL REFERENCES pico_arena_rooms(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL CHECK(pos BETWEEN 0 AND 19),
  owner_id TEXT REFERENCES pico_arena_players(id) ON DELETE SET NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 3),
  PRIMARY KEY(room_id,pos)
);

CREATE TABLE IF NOT EXISTS pico_arena_limits (
  bucket TEXT NOT NULL,
  window INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(bucket,window)
);
CREATE INDEX IF NOT EXISTS idx_pico_arena_limits_window
ON pico_arena_limits(window);
