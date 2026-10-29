-- Migration 006: day rentals (bike/scooty), time-slotted sessions (rafting,
-- paragliding) and operator-direct UPI payments.
--
-- Availability is DERIVED from bookings (see src/lib/booking/availability.ts),
-- not counted in a counter table, so the Phase-0 `listing_availability` table
-- is left untouched and is no longer used.
--
-- Idempotent, and already reflected in db/init/01-schema.sql + 02-seed.sql so it
-- is a harmless no-op on a fresh install. No PG enums (TEXT + CHECK) so values
-- can change in a plain transactional migration.

-- ---------------------------------------------------------------------------
-- Categories: which booking mechanics a category uses.
-- ---------------------------------------------------------------------------
ALTER TABLE adventure_categories ADD COLUMN IF NOT EXISTS booking_model TEXT NOT NULL DEFAULT 'enquiry';
ALTER TABLE adventure_categories DROP CONSTRAINT IF EXISTS adventure_categories_booking_model_check;
ALTER TABLE adventure_categories ADD CONSTRAINT adventure_categories_booking_model_check
  CHECK (booking_model IN ('rental_day', 'session', 'enquiry'));

INSERT INTO adventure_categories (slug, name, icon, sort_order, booking_model) VALUES
  ('bike-rental',   'Bike Rentals',   'bike',    1, 'rental_day'),
  ('scooty-rental', 'Scooty Rentals', 'scooter', 2, 'rental_day')
ON CONFLICT (slug) DO NOTHING;

UPDATE adventure_categories SET booking_model = 'session' WHERE slug IN ('rafting', 'paragliding') AND booking_model = 'enquiry';
UPDATE adventure_categories SET icon = 'waves' WHERE slug = 'rafting' AND icon IS NULL;
UPDATE adventure_categories SET icon = 'wind'  WHERE slug = 'paragliding' AND icon IS NULL;
UPDATE adventure_categories SET sort_order = 3 WHERE slug = 'rafting';
UPDATE adventure_categories SET sort_order = 4 WHERE slug = 'paragliding';
UPDATE adventure_categories SET sort_order = sort_order + 10
 WHERE slug IN ('motorcycle-expeditions', 'trekking', 'camping', 'scuba-diving', 'atv-off-roading') AND sort_order < 10;

-- ---------------------------------------------------------------------------
-- Listings: unit price + advance policy + moderation constraints.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'adventure_listings' AND column_name = 'price_per_person')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'adventure_listings' AND column_name = 'unit_price') THEN
    ALTER TABLE adventure_listings RENAME COLUMN price_per_person TO unit_price;
  END IF;
END $$;

ALTER TABLE adventure_listings ADD COLUMN IF NOT EXISTS advance_type     TEXT    NOT NULL DEFAULT 'percent';
ALTER TABLE adventure_listings ADD COLUMN IF NOT EXISTS advance_value    INTEGER NOT NULL DEFAULT 30;
ALTER TABLE adventure_listings ADD COLUMN IF NOT EXISTS min_notice_hours INTEGER NOT NULL DEFAULT 2;
ALTER TABLE adventure_listings ADD COLUMN IF NOT EXISTS published_at     TIMESTAMPTZ;

ALTER TABLE adventure_listings DROP CONSTRAINT IF EXISTS adventure_listings_advance_type_check;
ALTER TABLE adventure_listings ADD CONSTRAINT adventure_listings_advance_type_check CHECK (advance_type IN ('percent', 'flat'));
ALTER TABLE adventure_listings DROP CONSTRAINT IF EXISTS adventure_listings_advance_value_check;
ALTER TABLE adventure_listings ADD CONSTRAINT adventure_listings_advance_value_check CHECK (advance_value > 0);
ALTER TABLE adventure_listings DROP CONSTRAINT IF EXISTS adventure_listings_pricing_type_check;
ALTER TABLE adventure_listings ADD CONSTRAINT adventure_listings_pricing_type_check
  CHECK (pricing_type IN ('per_person', 'per_group', 'per_vehicle', 'per_unit_day'));
ALTER TABLE adventure_listings DROP CONSTRAINT IF EXISTS adventure_listings_status_check;
ALTER TABLE adventure_listings ADD CONSTRAINT adventure_listings_status_check
  CHECK (status IN ('draft', 'pending_review', 'published', 'changes_requested', 'rejected', 'deactivated'));
ALTER TABLE adventure_listings DROP CONSTRAINT IF EXISTS adventure_listings_availability_type_check;
ALTER TABLE adventure_listings ADD CONSTRAINT adventure_listings_availability_type_check
  CHECK (availability_type IN ('open', 'scheduled'));

ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS width  INTEGER;
ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS height INTEGER;

-- ---------------------------------------------------------------------------
-- Companies (operators): admin approval, trust flag, contact + terms.
-- ---------------------------------------------------------------------------
ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_publish_listings BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_number  TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address          TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS maps_url         TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS terms_version     TEXT;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies ADD CONSTRAINT companies_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE company_users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Payout details live apart from `companies` so public company queries can
-- never touch them. The platform never holds money: customers pay these
-- details directly.
CREATE TABLE IF NOT EXISTS company_payment_settings (
  company_id   INTEGER     PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  payee_name   TEXT        NOT NULL,
  upi_vpa      TEXT        CHECK (upi_vpa IS NULL OR upi_vpa ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,30}$'),
  upi_number   TEXT,
  qr_image_url TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin's verification checklist for an operator (text fields only).
CREATE TABLE IF NOT EXISTS company_verification (
  company_id       INTEGER     PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  business_type    TEXT,
  trade_licence_no TEXT,
  address          TEXT,
  maps_url         TEXT,
  phone_verified_at TIMESTAMPTZ,
  visited_at       TIMESTAMPTZ,
  documents_note   TEXT,
  admin_notes      TEXT,
  reviewed_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Category-specific listing details (typed + queryable, no jsonb drift).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing_rental_details (
  listing_id        INTEGER  PRIMARY KEY REFERENCES adventure_listings(id) ON DELETE CASCADE,
  make_model        TEXT     NOT NULL,
  engine_cc         INTEGER,
  transmission      TEXT     CHECK (transmission IN ('gear', 'automatic')),
  fuel_type         TEXT     NOT NULL DEFAULT 'petrol' CHECK (fuel_type IN ('petrol', 'electric')),
  units_total       INTEGER  NOT NULL CHECK (units_total >= 1),
  security_deposit  INTEGER  NOT NULL DEFAULT 0 CHECK (security_deposit >= 0), -- collected in person, never online
  helmets_included  SMALLINT NOT NULL DEFAULT 2,
  km_limit_per_day  INTEGER,
  fuel_policy       TEXT,
  docs_required     TEXT[]   NOT NULL DEFAULT '{}',
  pickup_time       TIME,
  return_by_time    TIME,
  late_fee_per_hour INTEGER,
  area_restrictions TEXT
);

CREATE TABLE IF NOT EXISTS listing_session_details (
  listing_id         INTEGER  PRIMARY KEY REFERENCES adventure_listings(id) ON DELETE CASCADE,
  rapids_grade       SMALLINT CHECK (rapids_grade BETWEEN 1 AND 6),
  stretch_name       TEXT,
  distance_km        NUMERIC(5,1),
  flight_minutes     INTEGER,
  takeoff_altitude_m INTEGER,
  min_weight_kg      INTEGER,
  max_weight_kg      INTEGER,
  max_age            INTEGER,
  swim_required      BOOLEAN  NOT NULL DEFAULT FALSE,
  certification      TEXT,
  equipment_notes    TEXT,
  waiver_required    BOOLEAN  NOT NULL DEFAULT TRUE
);

-- Recurring time slots for sessions (capacity = persons per slot).
-- days_of_week uses Postgres DOW numbering: 0 = Sunday.
CREATE TABLE IF NOT EXISTS listing_slot_templates (
  id           SERIAL   PRIMARY KEY,
  listing_id   INTEGER  NOT NULL REFERENCES adventure_listings(id) ON DELETE CASCADE,
  slot_time    TIME     NOT NULL,
  capacity     INTEGER  NOT NULL CHECK (capacity >= 1),
  days_of_week SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  valid_from   DATE,
  valid_to     DATE,
  is_active    BOOLEAN  NOT NULL DEFAULT TRUE,
  UNIQUE (listing_id, slot_time)
);

-- Operator-declared closures: maintenance, weather, off-season. slot_time NULL
-- = every slot; units_blocked NULL = closed entirely, otherwise that many units
-- (or persons) are unavailable.
CREATE TABLE IF NOT EXISTS listing_blackouts (
  id            SERIAL      PRIMARY KEY,
  listing_id    INTEGER     NOT NULL REFERENCES adventure_listings(id) ON DELETE CASCADE,
  date_from     DATE        NOT NULL,
  date_to       DATE        NOT NULL,
  slot_time     TIME,
  units_blocked INTEGER     CHECK (units_blocked IS NULL OR units_blocked >= 1),
  reason        TEXT,
  created_by    INTEGER     REFERENCES company_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT listing_blackouts_range_ok CHECK (date_to >= date_from)
);
CREATE INDEX IF NOT EXISTS idx_listing_blackouts_listing ON listing_blackouts(listing_id, date_from, date_to);

-- Where a pickup/hub town (e.g. Pelling) also serves an activity that happens
-- elsewhere (e.g. rafting at a river-access town). UI comes later.
CREATE TABLE IF NOT EXISTS listing_pickup_regions (
  listing_id INTEGER NOT NULL REFERENCES adventure_listings(id) ON DELETE CASCADE,
  region_id  INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  extra_fee  INTEGER NOT NULL DEFAULT 0,
  note       TEXT,
  PRIMARY KEY (listing_id, region_id)
);

-- ---------------------------------------------------------------------------
-- Marketplace bookings (legacy `bookings` is untouched).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing_bookings (
  id                    BIGSERIAL   PRIMARY KEY,
  token                 TEXT        NOT NULL UNIQUE,   -- unguessable URL credential
  code                  TEXT        NOT NULL UNIQUE,   -- short human code (display only)
  company_id            INTEGER     NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  listing_id            INTEGER     NOT NULL REFERENCES adventure_listings(id) ON DELETE RESTRICT,
  customer_id           INTEGER     REFERENCES customer_users(id) ON DELETE SET NULL,
  source                TEXT        NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'walk_in')),
  status                TEXT        NOT NULL DEFAULT 'pending_payment'
                        CHECK (status IN ('pending_payment', 'payment_submitted', 'confirmed', 'picked_up',
                                          'completed', 'no_show', 'cancelled', 'expired', 'needs_reschedule')),
  customer_name         TEXT        NOT NULL,
  customer_phone        TEXT        NOT NULL,
  customer_email        TEXT,
  start_date            DATE        NOT NULL,
  end_date              DATE        NOT NULL,
  slot_time             TIME,
  quantity              INTEGER     NOT NULL CHECK (quantity >= 1),   -- units (rentals) / persons (sessions)
  unit_price            INTEGER     NOT NULL,
  total_amount          INTEGER     NOT NULL,
  advance_amount        INTEGER     NOT NULL,
  balance_due           INTEGER     NOT NULL,
  deposit_amount        INTEGER     NOT NULL DEFAULT 0,               -- collected in person
  title_snapshot        TEXT        NOT NULL,
  policy_snapshot       TEXT,
  pay_to_snapshot       JSONB,                                        -- payee details at booking time
  hold_expires_at       TIMESTAMPTZ,
  payment_ref           TEXT,                                         -- UTR entered by the customer
  payer_name            TEXT,
  payment_attempts      SMALLINT    NOT NULL DEFAULT 0,
  payment_submitted_at  TIMESTAMPTZ,
  payment_verified_at   TIMESTAMPTZ,
  payment_verified_by   INTEGER     REFERENCES company_users(id) ON DELETE SET NULL,
  assigned_vehicle_reg  TEXT,
  picked_up_at          TIMESTAMPTZ,
  returned_at           TIMESTAMPTZ,
  deposit_collected_at  TIMESTAMPTZ,
  deposit_returned_at   TIMESTAMPTZ,
  ops_note              TEXT,
  participants          JSONB,                                        -- [{name, age, weight_kg}] for sessions
  waiver_accepted_at    TIMESTAMPTZ,
  cancelled_by          TEXT        CHECK (cancelled_by IN ('customer', 'operator', 'admin', 'system')),
  cancel_reason         TEXT,
  refund_status         TEXT        NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'due', 'done')),
  ip_hash               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT listing_bookings_dates_ok CHECK (end_date >= start_date),
  CONSTRAINT listing_bookings_money_ok CHECK (advance_amount >= 0 AND advance_amount <= total_amount
                                              AND balance_due = total_amount - advance_amount)
);

-- Availability lookups scan only bookings that can still hold capacity.
CREATE INDEX IF NOT EXISTS idx_listing_bookings_holding ON listing_bookings(listing_id, start_date, end_date)
  WHERE status IN ('pending_payment', 'payment_submitted', 'confirmed', 'picked_up', 'needs_reschedule');
CREATE INDEX IF NOT EXISTS idx_listing_bookings_company ON listing_bookings(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_bookings_phone   ON listing_bookings(customer_phone, created_at DESC);
-- One UTR can only back one live booking per operator.
CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_bookings_payment_ref ON listing_bookings(company_id, payment_ref)
  WHERE payment_ref IS NOT NULL AND status NOT IN ('cancelled', 'expired');

-- Dispute / support audit trail for every status change.
CREATE TABLE IF NOT EXISTS booking_events (
  id          BIGSERIAL   PRIMARY KEY,
  booking_id  BIGINT      NOT NULL REFERENCES listing_bookings(id) ON DELETE CASCADE,
  actor_type  TEXT        NOT NULL CHECK (actor_type IN ('admin', 'operator', 'customer', 'system')),
  actor_id    INTEGER,
  from_status TEXT,
  to_status   TEXT,
  note        TEXT,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id, created_at);

-- Sensitive account actions: approvals, payment-detail changes, publishes.
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL   PRIMARY KEY,
  actor_type TEXT        NOT NULL,
  actor_id   INTEGER,
  company_id INTEGER     REFERENCES companies(id) ON DELETE SET NULL,
  action     TEXT        NOT NULL,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_company ON audit_log(company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed: river-access / hub towns for rafting (placeholders — confirm with the
-- first rafting operator).
-- ---------------------------------------------------------------------------
INSERT INTO regions (slug, name, state, sort_order) VALUES
  ('jorethang', 'Jorethang', 'Sikkim', 12),
  ('legship',   'Legship',   'Sikkim', 13),
  ('melli',     'Melli',     'Sikkim', 14),
  ('rangpo',    'Rangpo',    'Sikkim', 15),
  ('singtam',   'Singtam',   'Sikkim', 16)
ON CONFLICT (slug) DO NOTHING;
