-- Migration 005: durable rate-limit counters (login / OTP / booking abuse
-- caps). Fixed-window counters in Postgres so limits survive restarts and need
-- no Redis. Expired rows are purged by the sweep job.

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT        PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count        INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
