-- Referral + "adv cash" system.
-- Run once on the existing production database:
--   docker compose exec -T db psql -U adventure -d adventuremafia < db/migrations/001_referrals.sql
-- (Fresh installs get this automatically from db/init/01-schema.sql.)

CREATE TABLE IF NOT EXISTS referral_users (
  id                    SERIAL PRIMARY KEY,
  email                 TEXT        NOT NULL UNIQUE,
  phone                 TEXT        NOT NULL,
  name                  TEXT,
  referral_code         TEXT        NOT NULL UNIQUE,
  adv_cash              INTEGER     NOT NULL DEFAULT 0,         -- spendable balance
  referral_earned       INTEGER     NOT NULL DEFAULT 0,         -- lifetime referral earnings (for the cap)
  reward_per_conversion INTEGER     NOT NULL DEFAULT 500,       -- admin-editable
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,      -- admin enable/disable
  email_verified        BOOLEAN     NOT NULL DEFAULT FALSE,
  signup_credited       BOOLEAN     NOT NULL DEFAULT FALSE,     -- signup bonus paid once
  otp_code              TEXT,
  otp_expires_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_users_code ON referral_users(referral_code);

-- Ledger of every adv-cash movement (audit trail for the admin tab).
CREATE TABLE IF NOT EXISTS adv_cash_ledger (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     REFERENCES referral_users(id) ON DELETE CASCADE,
  amount     INTEGER     NOT NULL,                 -- + earned, - spent
  reason     TEXT        NOT NULL,                 -- signup | referral | redeemed | admin
  booking_id INTEGER,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adv_cash_ledger_user ON adv_cash_ledger(user_id, created_at DESC);

-- Booking links to the referral that produced it.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referral_code     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referred_by       INTEGER REFERENCES referral_users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adv_cash_discount  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referrer_rewarded  BOOLEAN NOT NULL DEFAULT FALSE;
