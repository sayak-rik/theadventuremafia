-- Migration 003: treks / day-hike experiences + booking discriminator.
-- Lets the existing bookings table & /api/bookings handle day treks alongside
-- the 7-day motorcycle expedition.

CREATE TABLE IF NOT EXISTS treks (
  id               SERIAL PRIMARY KEY,
  slug             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  price_per_person INTEGER     NOT NULL,
  taxi_fare_extra  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO treks (slug, name, price_per_person, taxi_fare_extra, sort_order) VALUES
  ('rani-dhunga-day-trek', 'Rani Dhunga Day Trek', 1200, FALSE, 1),
  ('yuksom-day-hike',      'Yuksom Day Hike',        600, TRUE,  2)
ON CONFLICT (slug) DO NOTHING;

-- Discriminate the product on each booking ('expedition' keeps prior behaviour).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'expedition';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trek_id INTEGER REFERENCES treks(id) ON DELETE SET NULL;

-- Allow option='trek'. ADD VALUE must NOT be used in the same transaction it is
-- created in, so run this statement on its own.
ALTER TYPE booking_option ADD VALUE IF NOT EXISTS 'trek';
