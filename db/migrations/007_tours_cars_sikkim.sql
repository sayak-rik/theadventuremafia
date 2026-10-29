-- Migration 007: guided tours (multi-day departures), cars/drivers
-- (point-to-point routes, incl. admin-curated standardized routes), short
-- video on listings, inert commission groundwork, and Sikkim-wide regions.
--
-- Idempotent, and already reflected in db/init/01-schema.sql + 02-seed.sql so
-- it is a harmless no-op on a fresh install. No PG enums (TEXT + CHECK) so
-- values can change in a plain transactional migration.

-- ---------------------------------------------------------------------------
-- Booking models: 'departure' (multi-day tours, capacity per cohort) and
-- 'route_trip' (cars/drivers, capacity per day like rental_day).
-- ---------------------------------------------------------------------------
ALTER TABLE adventure_categories DROP CONSTRAINT IF EXISTS adventure_categories_booking_model_check;
ALTER TABLE adventure_categories ADD CONSTRAINT adventure_categories_booking_model_check
  CHECK (booking_model IN ('rental_day', 'session', 'departure', 'route_trip', 'enquiry'));

INSERT INTO adventure_categories (slug, name, icon, sort_order, booking_model) VALUES
  ('guided-tours', 'Guided Tours', 'map', 5, 'departure'),
  ('car-hire',     'Car Hire',     'car', 6, 'route_trip')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Companies: a driver is the same tenant model as an operator (same signup,
-- session, approval, payment-settings, verification and listing/booking
-- pipeline) — just a different kind of thing they list.
-- ---------------------------------------------------------------------------
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type TEXT NOT NULL DEFAULT 'operator';
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_company_type_check;
ALTER TABLE companies ADD CONSTRAINT companies_company_type_check CHECK (company_type IN ('operator', 'driver'));

-- Inert groundwork for a future platform commission. Not collected, not
-- enforced, not shown to customers. Payments remain direct operator/driver
-- UPI exactly as today; nothing reads this column yet.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(4,2) NOT NULL DEFAULT 0;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_commission_percent_check;
ALTER TABLE companies ADD CONSTRAINT companies_commission_percent_check
  CHECK (commission_percent >= 0 AND commission_percent <= 100);
COMMENT ON COLUMN companies.commission_percent IS
  'Inert groundwork for a future platform commission. Not collected, not enforced, not shown to customers. Payments remain direct operator/driver UPI.';

-- Driver KYC: driving licence belongs to the person.
ALTER TABLE company_verification ADD COLUMN IF NOT EXISTS driving_licence_number TEXT;
ALTER TABLE company_verification ADD COLUMN IF NOT EXISTS driving_licence_expiry DATE;

-- Paid placement: the actual v1 revenue lever (bookings stay free/commission-
-- free). An admin marks a listing featured — manually invoiced the same way
-- platform_fee_amount already is, no gateway — and it's boosted in search
-- results / shown in a "Featured" rail on the category page and homepage.
-- featured_until lets a paid placement expire on its own without an admin
-- chasing every listing down by hand.
ALTER TABLE adventure_listings ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE adventure_listings ADD COLUMN IF NOT EXISTS featured_until DATE;
CREATE INDEX IF NOT EXISTS idx_adventure_listings_featured ON adventure_listings(is_featured) WHERE is_featured;

-- ---------------------------------------------------------------------------
-- Tours: multi-day itinerary details. duration_days/duration_nights,
-- group_min/max, difficulty, season, weather_dependent already exist on
-- adventure_listings and are reused as-is.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Admin-curated standardized routes (e.g. "Siliguri -> Pelling"). A driver's
-- listing either points here (origin/destination copied into
-- listing_vehicle_details at save time, so deactivating a catalog row never
-- retroactively breaks an existing listing) or sets a fully custom route.
-- ---------------------------------------------------------------------------
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
-- Short video on a listing: one row of listing_images becomes a video via
-- media_type. No new table — existing cover/count/moderation logic filters
-- on media_type = 'photo' where only photos are meant.
-- ---------------------------------------------------------------------------
ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'photo';
ALTER TABLE listing_images DROP CONSTRAINT IF EXISTS listing_images_media_type_check;
ALTER TABLE listing_images ADD CONSTRAINT listing_images_media_type_check CHECK (media_type IN ('photo', 'video'));
ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS poster_url TEXT;  -- static thumbnail frame for the video

-- ---------------------------------------------------------------------------
-- Sikkim-wide: Siliguri (West Bengal — outside Sikkim) as a representable
-- origin for standardized routes into Sikkim.
-- ---------------------------------------------------------------------------
INSERT INTO regions (slug, name, state, sort_order) VALUES
  ('siliguri', 'Siliguri', 'West Bengal', 20)
ON CONFLICT (slug) DO NOTHING;

-- Placeholder distance/duration — confirm with the first driver/operator.
INSERT INTO vehicle_route_catalog (origin_region_id, destination_region_id, distance_km, duration_minutes, sort_order)
SELECT o.id, d.id, 115, 240, 1 FROM regions o, regions d WHERE o.slug = 'siliguri' AND d.slug = 'pelling'
ON CONFLICT (origin_region_id, destination_region_id) DO NOTHING;
