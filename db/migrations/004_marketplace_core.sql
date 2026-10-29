-- Migration 004: multi-tenant marketplace core.
-- Adds companies/operators, shared taxonomy (categories + regions), and
-- generic adventure listings, then tags the existing single-tenant tables
-- with company_id so the seeded Adventure Mafia business becomes Company #1
-- on the new marketplace. Safe to run against a fresh install too (everything
-- here is idempotent and already reflected in db/init/01-schema.sql +
-- 02-seed.sql, so it becomes a harmless no-op there).
--
--   docker compose exec -T db psql -U adventure -d adventuremafia < db/migrations/004_marketplace_core.sql
-- (or, once Drizzle is wired up: npm run db:migrate)

-- ---------------------------------------------------------------------------
-- Companies (adventure operators) + their staff logins.
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
  status                TEXT        NOT NULL DEFAULT 'pending', -- pending | approved | suspended
  platform_fee_amount   INTEGER,
  platform_fee_status   TEXT        NOT NULL DEFAULT 'unpaid',  -- unpaid | invoiced | waived | paid (manual, no gateway)
  is_verified           BOOLEAN     NOT NULL DEFAULT FALSE,     -- "Mafia Verified" badge, admin-controlled
  is_seed               BOOLEAN     NOT NULL DEFAULT FALSE,     -- flags the dogfooded Adventure Mafia row (Company #1)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at           TIMESTAMPTZ
);

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
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE
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
  price_per_person      INTEGER,
  currency              TEXT        NOT NULL DEFAULT 'INR',
  pricing_type          TEXT        NOT NULL DEFAULT 'per_person', -- per_person | per_group | per_vehicle
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
  availability_type     TEXT        NOT NULL DEFAULT 'open',      -- open (daily, no cap) | scheduled
  status                TEXT        NOT NULL DEFAULT 'draft',     -- draft|pending_review|published|changes_requested|rejected|deactivated
  moderation_note       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_adventure_listings_company ON adventure_listings(company_id);
CREATE INDEX IF NOT EXISTS idx_adventure_listings_category_region ON adventure_listings(category_id, region_id);
CREATE INDEX IF NOT EXISTS idx_adventure_listings_status ON adventure_listings(status);

CREATE TABLE IF NOT EXISTS listing_images (
  id         SERIAL PRIMARY KEY,
  listing_id INTEGER     NOT NULL REFERENCES adventure_listings(id) ON DELETE CASCADE,
  url        TEXT        NOT NULL,
  thumb_url  TEXT,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  alt_text   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id);

-- Only used when availability_type = 'scheduled'. Mirrors trip_dates' own
-- capacity-lock CHECK pattern.
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
-- Tag the existing single-tenant tables with company_id so the seeded
-- Adventure Mafia business becomes Company #1, without touching their
-- working booking/capacity-lock logic.
-- ---------------------------------------------------------------------------
ALTER TABLE bike_models ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE trip_dates  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE treks       ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS company_id  INTEGER REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS listing_id  INTEGER REFERENCES adventure_listings(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency     TEXT NOT NULL DEFAULT 'INR';

-- Note: referral_users was renamed to customer_users back in migration 001
-- (that's where the table is first created, so that's where the rename
-- guard lives — keeps this file from re-doing work 001 already handles).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customer_users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Seed: shared taxonomy + Company #1 (the dogfooded Adventure Mafia).
-- ---------------------------------------------------------------------------
INSERT INTO adventure_categories (slug, name, sort_order) VALUES
  ('motorcycle-expeditions', 'Motorcycle Expeditions', 1),
  ('trekking',               'Trekking',               2),
  ('camping',                'Camping',                3),
  ('rafting',                'River Rafting',          4),
  ('paragliding',            'Paragliding',            5),
  ('scuba-diving',           'Scuba Diving',           6),
  ('atv-off-roading',        'ATV & Off-Roading',      7)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO regions (slug, name, state, sort_order) VALUES
  ('gangtok',      'Gangtok',      'Sikkim', 1),
  ('pelling',      'Pelling',      'Sikkim', 2),
  ('yuksom',       'Yuksom',       'Sikkim', 3),
  ('lachung',      'Lachung',      'Sikkim', 4),
  ('lachen',       'Lachen',       'Sikkim', 5),
  ('dzongu',       'Dzongu',       'Sikkim', 6),
  ('ravangla',     'Ravangla',     'Sikkim', 7),
  ('namchi',       'Namchi',       'Sikkim', 8),
  ('west-sikkim',  'West Sikkim',  'Sikkim', 9),
  ('north-sikkim', 'North Sikkim', 'Sikkim', 10),
  ('south-sikkim', 'South Sikkim', 'Sikkim', 11)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO companies (slug, name, description, contact_email, contact_phone, status, is_verified, is_seed, approved_at)
VALUES (
  'the-adventure-mafia',
  'The Adventure Mafia',
  '7-day guided motorcycle expeditions through West & North Sikkim, plus day treks.',
  'contact@theadventuremafia.com',
  '+91 7003405268',
  'approved',
  TRUE,
  TRUE,
  now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO company_categories (company_id, category_id)
SELECT c.id, cat.id FROM companies c, adventure_categories cat
WHERE c.slug = 'the-adventure-mafia' AND cat.slug IN ('motorcycle-expeditions', 'trekking')
ON CONFLICT DO NOTHING;

INSERT INTO company_regions (company_id, region_id)
SELECT c.id, r.id FROM companies c, regions r
WHERE c.slug = 'the-adventure-mafia' AND r.slug IN ('west-sikkim', 'north-sikkim', 'yuksom', 'pelling')
ON CONFLICT DO NOTHING;

-- Backfill company_id onto every pre-existing row of the legacy single-tenant
-- tables and bookings, so Company #1 owns its own history from day one.
UPDATE bike_models SET company_id = (SELECT id FROM companies WHERE slug = 'the-adventure-mafia') WHERE company_id IS NULL;
UPDATE trip_dates  SET company_id = (SELECT id FROM companies WHERE slug = 'the-adventure-mafia') WHERE company_id IS NULL;
UPDATE treks       SET company_id = (SELECT id FROM companies WHERE slug = 'the-adventure-mafia') WHERE company_id IS NULL;
UPDATE bookings    SET company_id = (SELECT id FROM companies WHERE slug = 'the-adventure-mafia') WHERE company_id IS NULL;
