-- Apply once to each Cloudflare D1 environment BEFORE deploying the Binary Lab usage API.
-- Existing visitor rows keep their counters. Binary Lab starts at zero.
-- Verify the live pico_usage table contains the five earlier *_seconds columns first.
ALTER TABLE pico_usage
  ADD COLUMN binary_lab_seconds INTEGER NOT NULL DEFAULT 0
  CHECK (binary_lab_seconds >= 0);
