-- The Adventure Mafia — Postgres schema
-- Auto-loaded by the postgres container on first boot.

-- ---------------------------------------------------------------------------
-- Companies (adventure operators) + their staff logins. Every other company-
-- scoped table below references this. The seeded Adventure Mafia business is
-- Company #1 (is_seed = TRUE) — see 02-seed.sql.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id                    SERIAL PRIMARY KEY,
  slug                  TEXT        NOT NULL UNIQUE,
  name                  TEXT        NOT NULL,
  description           TEXT,
  logo_url              TEXT,
  cover_image_url       TEXT,
  contact_email         TEXT        NOT NULL,
  contact_phone         TEXT        NOT NULL,
  website_url           TEXT,
  instagram_url         TEXT,
  status                TEXT        NOT NULL DEFAULT 'pending'
                        CONSTRAINT companies_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  platform_fee_amount   INTEGER,
  platform_fee_status   TEXT        NOT NULL DEFAULT 'unpaid',  -- unpaid | invoiced | waived | paid (manual, no gateway)
  commission_percent    NUMERIC(4,2) NOT NULL DEFAULT 0
                        CONSTRAINT companies_commission_percent_check CHECK (commission_percent >= 0 AND commission_percent <= 100),
  company_type          TEXT        NOT NULL DEFAULT 'operator'
                        CONSTRAINT companies_company_type_check CHECK (company_type IN ('operator', 'driver')),
  is_verified           BOOLEAN     NOT NULL DEFAULT FALSE,     -- "Mafia Verified" badge, admin-controlled
  is_seed               BOOLEAN     NOT NULL DEFAULT FALSE,
  auto_publish_listings BOOLEAN     NOT NULL DEFAULT FALSE,     -- admin trust flag: skip per-listing review
  whatsapp_number       TEXT,
  address               TEXT,
  maps_url              TEXT,
  rejection_reason      TEXT,
  terms_accepted_at     TIMESTAMPTZ,
  terms_version         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at           TIMESTAMPTZ
);
COMMENT ON COLUMN companies.commission_percent IS
  'Inert groundwork for a future platform commission. Not collected, not enforced, not shown to customers. Payments remain direct operator/driver UPI.';

-- Membership table (not owner_id) so multi-staff-per-company is a future row,
-- not a future migration.
CREATE TABLE IF NOT EXISTS company_users (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER     NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL UNIQUE,
  phone          TEXT        NOT NULL,
  name           TEXT,
  role           TEXT        NOT NULL DEFAULT 'owner',          -- owner | staff
  password_hash  TEXT,
  otp_code       TEXT,
  otp_expires_at TIMESTAMPTZ,
  email_verified BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  token_version  INTEGER     NOT NULL DEFAULT 0,           -- bump to invalidate every session
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id);

-- ---------------------------------------------------------------------------
-- Shared taxonomy: adventure categories + regions (cities).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adventure_categories (
  id         SERIAL PRIMARY KEY,
  slug       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  icon       TEXT,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Which booking mechanics this category uses.
  booking_model TEXT     NOT NULL DEFAULT 'enquiry'
                 CONSTRAINT adventure_categories_booking_model_check CHECK (booking_model IN ('rental_day', 'session', 'departure', 'route_trip', 'enquiry'))
);

CREATE TABLE IF NOT EXISTS regions (
  id         SERIAL PRIMARY KEY,
  slug       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  state      TEXT,
  country    TEXT        NOT NULL DEFAULT 'IN',
  sort_order INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS company_categories (
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES adventure_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, category_id)
);

CREATE TABLE IF NOT EXISTS company_regions (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  region_id  INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, region_id)
);

-- ---------------------------------------------------------------------------
-- Adventure listings. Structured fields (difficulty/duration/group size/
-- season/inclusions) exist specifically so later natural-language search can
-- filter real rows instead of asking an LLM to reason over free text.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adventure_listings (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER     NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id           INTEGER     NOT NULL REFERENCES adventure_categories(id),
  region_id             INTEGER     NOT NULL REFERENCES regions(id),
  slug                  TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  description           TEXT,
  unit_price            INTEGER,                                    -- per person, or per unit per day for rentals
  currency              TEXT        NOT NULL DEFAULT 'INR',
  pricing_type          TEXT        NOT NULL DEFAULT 'per_person'
                        CONSTRAINT adventure_listings_pricing_type_check CHECK (pricing_type IN ('per_person', 'per_group', 'per_vehicle', 'per_unit_day')),
  advance_type          TEXT        NOT NULL DEFAULT 'percent'
                        CONSTRAINT adventure_listings_advance_type_check CHECK (advance_type IN ('percent', 'flat')),
  advance_value         INTEGER     NOT NULL DEFAULT 30
                        CONSTRAINT adventure_listings_advance_value_check CHECK (advance_value > 0),
  min_notice_hours      INTEGER     NOT NULL DEFAULT 2,
  duration_hours        INTEGER,
  duration_days         INTEGER,
  duration_nights       INTEGER,
  group_min             INTEGER,
  group_max             INTEGER,
  difficulty            TEXT        CHECK (difficulty IN ('easy','moderate','difficult','extreme')),
  beginner_friendly     BOOLEAN     NOT NULL DEFAULT FALSE,
  family_friendly       BOOLEAN     NOT NULL DEFAULT FALSE,
  min_age               INTEGER,
  physical_requirements TEXT,
  meeting_point         TEXT,
  start_time            TIME,
  season                TEXT,
  weather_dependent     BOOLEAN     NOT NULL DEFAULT FALSE,
  inclusions            TEXT[],
  exclusions            TEXT[],
  safety_notes          TEXT,
  cancellation_policy   TEXT,
  availability_type     TEXT        NOT NULL DEFAULT 'open'       -- open (daily, no cap) | scheduled
                        CONSTRAINT adventure_listings_availability_type_check CHECK (availability_type IN ('open', 'scheduled')),
  status                TEXT        NOT NULL DEFAULT 'draft'
                        CONSTRAINT adventure_listings_status_check CHECK (status IN ('draft', 'pending_review', 'published', 'changes_requested', 'rejected', 'deactivated')),
  moderation_note       TEXT,
  published_at          TIMESTAMPTZ,
  -- Paid placement (the actual v1 revenue lever — bookings themselves stay
  -- free). Admin-set, manually invoiced like platform_fee_amount, no gateway.
  is_featured           BOOLEAN     NOT NULL DEFAULT FALSE,
  featured_until        DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_adventure_listings_company ON adventure_listings(company_id);
CREATE INDEX IF NOT EXISTS idx_adventure_listings_category_region ON adventure_listings(category_id, region_id);
CREATE INDEX IF NOT EXISTS idx_adventure_listings_status ON adventure_listings(status);
CREATE INDEX IF NOT EXISTS idx_adventure_listings_featured ON adventure_listings(is_featured) WHERE is_featured;

CREATE TABLE IF NOT EXISTS listing_images (
  id               SERIAL PRIMARY KEY,
  listing_id       INTEGER     NOT NULL REFERENCES adventure_listings(id) ON DELETE CASCADE,
  url              TEXT        NOT NULL,
  thumb_url        TEXT,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  alt_text         TEXT,
  width            INTEGER,
  height           INTEGER,
  media_type       TEXT        NOT NULL DEFAULT 'photo'
                   CONSTRAINT listing_images_media_type_check CHECK (media_type IN ('photo', 'video')),
  duration_seconds INTEGER,                                          -- video only
  poster_url       TEXT,                                             -- static thumbnail frame for the video
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id);

-- Only used when availability_type = 'scheduled'. Mirrors trip_dates' own
-- capacity-lock CHECK pattern below.
CREATE TABLE IF NOT EXISTS listing_availability (
  id              SERIAL PRIMARY KEY,
  listing_id      INTEGER     NOT NULL REFERENCES adventure_listings(id) ON DELETE CASCADE,
  slot_date       DATE        NOT NULL,
  capacity_total  INTEGER     NOT NULL,
  capacity_booked INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (listing_id, slot_date),
  CONSTRAINT listing_availability_within_capacity CHECK (capacity_booked BETWEEN 0 AND capacity_total)
);

-- ---------------------------------------------------------------------------
-- Bike models + dynamic pricing. Admins edit prices here; the site reads them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bike_models (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER     REFERENCES companies(id) ON DELETE CASCADE,
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
  company_id       INTEGER     REFERENCES companies(id) ON DELETE CASCADE,
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
-- Treks / day-hike experiences. Daily availability, simple per-person price.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treks (
  id               SERIAL PRIMARY KEY,
  company_id       INTEGER     REFERENCES companies(id) ON DELETE CASCADE,
  slug             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  price_per_person INTEGER     NOT NULL,            -- INR, per person
  taxi_fare_extra  BOOLEAN     NOT NULL DEFAULT FALSE, -- "+ taxi fare" on the day
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Bookings / lead capture.
-- ---------------------------------------------------------------------------
CREATE TYPE rider_type AS ENUM ('single', 'double');
-- 'bike'/'cab' apply to the expedition; 'trek' to day-trek bookings.
CREATE TYPE booking_option AS ENUM ('bike', 'cab', 'trek');

CREATE TABLE IF NOT EXISTS bookings (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER        REFERENCES trip_dates(id) ON DELETE SET NULL,
  -- 'expedition' = the 7-day bike tour; 'trek' = a day-trek booking.
  product_type  TEXT           NOT NULL DEFAULT 'expedition',
  -- 'bike' = riding a motorcycle; 'cab' = shared support-cab seat(s); 'trek' = day trek.
  option        booking_option NOT NULL DEFAULT 'bike',
  bike_model_id INTEGER        REFERENCES bike_models(id) ON DELETE SET NULL,
  trek_id       INTEGER        REFERENCES treks(id) ON DELETE SET NULL,
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
-- Customer accounts (formerly "referral_users") + the customer referral /
-- "adv cash" wallet program. Table name is generalized since this is now the
-- base customer identity table; the referral/wallet mechanics themselves are
-- unchanged and keep working exactly as before.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_users (
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
-- Kept as its historical name (this table was originally "referral_users")
-- so replaying migration 001 against an already-current schema, or against a
-- database that still has the old table name, both hit the same index.
CREATE INDEX IF NOT EXISTS idx_referral_users_code ON customer_users(referral_code);

CREATE TABLE IF NOT EXISTS adv_cash_ledger (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     REFERENCES customer_users(id) ON DELETE CASCADE,
  amount     INTEGER     NOT NULL,
  reason     TEXT        NOT NULL,
  booking_id INTEGER,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adv_cash_ledger_user ON adv_cash_ledger(user_id, created_at DESC);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referral_code     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referred_by       INTEGER REFERENCES customer_users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adv_cash_discount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referrer_rewarded BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Multi-tenant marketplace columns on bookings: which company/listing/
-- customer this booking belongs to, plus the amount actually charged (never
-- persisted before — needed for GMV/revenue-equivalent analytics).
-- ---------------------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS company_id   INTEGER REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS listing_id   INTEGER REFERENCES adventure_listings(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id  INTEGER REFERENCES customer_users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency     TEXT NOT NULL DEFAULT 'INR';

-- ---------------------------------------------------------------------------
-- Durable rate-limit counters (login / OTP / booking abuse caps).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT        PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count        INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- ===========================================================================
-- Rentals, sessions & operator-direct payments (mirrors migration 006).
-- ===========================================================================
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
  company_id             INTEGER     PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  business_type          TEXT,
  trade_licence_no       TEXT,
  address                TEXT,
  maps_url               TEXT,
  phone_verified_at      TIMESTAMPTZ,
  visited_at             TIMESTAMPTZ,
  documents_note         TEXT,
  admin_notes            TEXT,
  driving_licence_number TEXT,          -- drivers only
  driving_licence_expiry DATE,          -- drivers only
  reviewed_at            TIMESTAMPTZ
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

-- ===========================================================================
-- Guided tours & cars/drivers (mirrors migration 007).
-- ===========================================================================
-- Tours: multi-day itinerary details. duration_days/duration_nights,
-- group_min/max, difficulty, season, weather_dependent live on
-- adventure_listings and are reused as-is.
CREATE TABLE IF NOT EXISTS listing_tour_details (
  listing_id         INTEGER  PRIMARY KEY REFERENCES adventure_listings(id) ON DELETE CASCADE,
  trip_type          TEXT     NOT NULL DEFAULT 'circuit' CHECK (trip_type IN ('circuit', 'point_to_point')),
  end_region_id      INTEGER  REFERENCES regions(id),               -- only for point_to_point
  itinerary          JSONB    NOT NULL DEFAULT '[]',                -- [{day, title, description}]
  highlights         TEXT[]   NOT NULL DEFAULT '{}',
  accommodation_type TEXT,
  meal_plan          TEXT,
  transport_included BOOLEAN  NOT NULL DEFAULT TRUE,
  max_altitude_m     INTEGER,
  docs_required      TEXT[]   NOT NULL DEFAULT '{}'
);

-- Admin-curated standardized routes (e.g. "Siliguri -> Pelling"). A driver's
-- listing either points here (origin/destination copied into
-- listing_vehicle_details at save time, so deactivating a catalog row never
-- retroactively breaks an existing listing) or sets a fully custom route.
CREATE TABLE IF NOT EXISTS vehicle_route_catalog (
  id                     SERIAL      PRIMARY KEY,
  origin_region_id       INTEGER     NOT NULL REFERENCES regions(id),
  destination_region_id  INTEGER     NOT NULL REFERENCES regions(id),
  distance_km            NUMERIC(5,1),
  duration_minutes       INTEGER,
  is_active              BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order             INTEGER     NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (origin_region_id, destination_region_id)
);

-- Cars: driver's vehicle offered on a route. Capacity math = units_total,
-- same shape as listing_rental_details (no slot_time).
CREATE TABLE IF NOT EXISTS listing_vehicle_details (
  listing_id             INTEGER  PRIMARY KEY REFERENCES adventure_listings(id) ON DELETE CASCADE,
  vehicle_type           TEXT     NOT NULL,     -- 'hatchback' | 'sedan' | 'suv' | 'innova' | 'traveller' ...
  seats                  INTEGER  NOT NULL CHECK (seats BETWEEN 1 AND 30),
  ac                     BOOLEAN  NOT NULL DEFAULT TRUE,
  luggage_note           TEXT,
  units_total            INTEGER  NOT NULL CHECK (units_total >= 1),
  one_way                BOOLEAN  NOT NULL DEFAULT TRUE,
  pickup_time            TIME,
  route_catalog_id       INTEGER  REFERENCES vehicle_route_catalog(id) ON DELETE SET NULL,
  origin_region_id       INTEGER  NOT NULL REFERENCES regions(id),
  destination_region_id  INTEGER  NOT NULL REFERENCES regions(id),
  registration_number    TEXT,     -- vehicle RC belongs to the specific vehicle/listing
  rc_expiry              DATE
);
CREATE INDEX IF NOT EXISTS idx_listing_vehicle_route ON listing_vehicle_details(origin_region_id, destination_region_id);

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
