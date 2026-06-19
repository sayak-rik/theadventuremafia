-- The Adventure Mafia — Postgres schema
-- Auto-loaded by the postgres container on first boot.

-- ---------------------------------------------------------------------------
-- Bike models + dynamic pricing. Admins edit prices here; the site reads them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bike_models (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  engine_cc     INTEGER     NOT NULL,
  price_double  INTEGER     NOT NULL,   -- INR, per rider on two-up booking
  price_single  INTEGER     NOT NULL,   -- INR, solo rider
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Departure dates. Tours leave every Sunday, Sep–May. One row per departure.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip_dates (
  id               SERIAL PRIMARY KEY,
  depart_on        DATE        NOT NULL UNIQUE,
  -- 20 motorbikes available per departure.
  bikes_total      INTEGER     NOT NULL DEFAULT 20,
  bikes_booked     INTEGER     NOT NULL DEFAULT 0,
  -- 10 shared-cab seats available per departure.
  cab_seats_total  INTEGER     NOT NULL DEFAULT 10,
  cab_seats_booked INTEGER     NOT NULL DEFAULT 0,
  is_open          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bikes_within_capacity CHECK (bikes_booked >= 0 AND bikes_booked <= bikes_total),
  CONSTRAINT cab_within_capacity CHECK (cab_seats_booked >= 0 AND cab_seats_booked <= cab_seats_total),
  -- Only Sundays are valid departures (Postgres DOW: 0 = Sunday).
  CONSTRAINT depart_is_sunday CHECK (EXTRACT(DOW FROM depart_on) = 0)
);

-- ---------------------------------------------------------------------------
-- Bookings / lead capture.
-- ---------------------------------------------------------------------------
CREATE TYPE rider_type AS ENUM ('single', 'double');
CREATE TYPE booking_option AS ENUM ('bike', 'cab');

CREATE TABLE IF NOT EXISTS bookings (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER        REFERENCES trip_dates(id) ON DELETE SET NULL,
  -- 'bike' = riding a motorcycle; 'cab' = shared support-cab seat(s).
  option        booking_option NOT NULL DEFAULT 'bike',
  bike_model_id INTEGER        REFERENCES bike_models(id) ON DELETE SET NULL,
  rider         rider_type,    -- only for option = 'bike'
  residence     TEXT           NOT NULL DEFAULT 'IN', -- 'IN' (INR) | 'INTL' (USD)
  name          TEXT           NOT NULL,
  email         TEXT           NOT NULL,
  phone         TEXT           NOT NULL,
  trip_date     DATE           NOT NULL,
  -- For 'bike': number of riders on the bike (1–2). For 'cab': cab seats.
  seats         INTEGER        NOT NULL DEFAULT 1,
  message       TEXT,
  status        TEXT           NOT NULL DEFAULT 'new', -- new | confirmed | cancelled
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_trip_date ON bookings(trip_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- ---------------------------------------------------------------------------
-- Testimonials (published rider reviews).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS testimonials (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  location    TEXT,
  content     TEXT        NOT NULL,
  rating      INTEGER     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  is_published BOOLEAN    NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Referral + "adv cash" system.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_users (
  id                    SERIAL PRIMARY KEY,
  email                 TEXT        NOT NULL UNIQUE,
  phone                 TEXT        NOT NULL,
  name                  TEXT,
  referral_code         TEXT        NOT NULL UNIQUE,
  adv_cash              INTEGER     NOT NULL DEFAULT 0,
  referral_earned       INTEGER     NOT NULL DEFAULT 0,
  reward_per_conversion INTEGER     NOT NULL DEFAULT 500,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  email_verified        BOOLEAN     NOT NULL DEFAULT FALSE,
  signup_credited       BOOLEAN     NOT NULL DEFAULT FALSE,
  password_hash         TEXT,
  otp_code              TEXT,
  otp_expires_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_users_code ON referral_users(referral_code);

CREATE TABLE IF NOT EXISTS adv_cash_ledger (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     REFERENCES referral_users(id) ON DELETE CASCADE,
  amount     INTEGER     NOT NULL,
  reason     TEXT        NOT NULL,
  booking_id INTEGER,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adv_cash_ledger_user ON adv_cash_ledger(user_id, created_at DESC);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referral_code     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referred_by       INTEGER REFERENCES referral_users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adv_cash_discount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referrer_rewarded BOOLEAN NOT NULL DEFAULT FALSE;
