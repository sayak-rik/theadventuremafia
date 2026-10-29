-- Seed data for The Adventure Mafia.

-- ---------------------------------------------------------------------------
-- Marketplace core: shared taxonomy + Company #1 (the dogfooded Adventure
-- Mafia business). Everything below this backfills company_id onto it.
-- ---------------------------------------------------------------------------
INSERT INTO adventure_categories (slug, name, icon, sort_order, booking_model) VALUES
  ('bike-rental',            'Bike Rentals',            'bike',    1,  'rental_day'),
  ('scooty-rental',          'Scooty Rentals',          'scooter', 2,  'rental_day'),
  ('rafting',                'River Rafting',           'waves',   3,  'session'),
  ('paragliding',            'Paragliding',             'wind',    4,  'session'),
  ('motorcycle-expeditions', 'Motorcycle Expeditions',  NULL,      11, 'enquiry'),
  ('trekking',               'Trekking',                NULL,      12, 'enquiry'),
  ('camping',                'Camping',                 NULL,      13, 'enquiry'),
  ('scuba-diving',           'Scuba Diving',            NULL,      16, 'enquiry'),
  ('atv-off-roading',        'ATV & Off-Roading',       NULL,      17, 'enquiry')
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
  ('south-sikkim', 'South Sikkim', 'Sikkim', 11),
  ('jorethang',    'Jorethang',    'Sikkim', 12),
  ('legship',      'Legship',      'Sikkim', 13),
  ('melli',        'Melli',        'Sikkim', 14),
  ('rangpo',       'Rangpo',       'Sikkim', 15),
  ('singtam',      'Singtam',      'Sikkim', 16),
  ('siliguri',     'Siliguri',     'West Bengal', 20)
ON CONFLICT (slug) DO NOTHING;

-- Standardized driver routes (placeholder distance/duration — confirm with
-- the first driver/operator).
INSERT INTO vehicle_route_catalog (origin_region_id, destination_region_id, distance_km, duration_minutes, sort_order)
SELECT o.id, d.id, 115, 240, 1 FROM regions o, regions d WHERE o.slug = 'siliguri' AND d.slug = 'pelling'
ON CONFLICT (origin_region_id, destination_region_id) DO NOTHING;

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

-- Bike models. Pricing rule encoded by the data itself:
--   single = double + 10,000 ; each step down in engine size = -2,000 / rider.
INSERT INTO bike_models (company_id, name, engine_cc, price_double, price_single, sort_order)
SELECT (SELECT id FROM companies WHERE slug = 'the-adventure-mafia'), name, engine_cc, price_double, price_single, sort_order
FROM (VALUES
  ('Himalayan 450', 450, 45000, 55000, 1),
  ('Himalayan 411', 411, 43000, 53000, 2),
  ('Scram 411',     411, 41000, 51000, 3),
  ('Classic 350',   350, 39000, 49000, 4),
  ('Hunter 350',    350, 37000, 47000, 5)
) AS v(name, engine_cc, price_double, price_single, sort_order)
ON CONFLICT DO NOTHING;

-- Treks / day hikes. Daily availability, simple per-person price.
INSERT INTO treks (company_id, slug, name, price_per_person, taxi_fare_extra, sort_order)
SELECT (SELECT id FROM companies WHERE slug = 'the-adventure-mafia'), slug, name, price_per_person, taxi_fare_extra, sort_order
FROM (VALUES
  ('rani-dhunga-day-trek', 'Rani Dhunga Day Trek', 1200, FALSE, 1),
  ('yuksom-day-hike',      'Yuksom Day Hike',        600, TRUE,  2)
) AS v(slug, name, price_per_person, taxi_fare_extra, sort_order)
ON CONFLICT (slug) DO NOTHING;

-- Departure dates: every Sunday in the Sep–May season for the upcoming season.
-- Generated from the date series, keeping only Sundays (DOW = 0) that fall in
-- September–December or January–May.
INSERT INTO trip_dates (company_id, depart_on, bikes_total, bikes_booked, cab_seats_total, cab_seats_booked)
SELECT (SELECT id FROM companies WHERE slug = 'the-adventure-mafia'), d::date, 20, 0, 10, 0
FROM generate_series('2026-09-01'::date, '2027-05-31'::date, '1 day') AS d
WHERE EXTRACT(DOW FROM d) = 0
  AND EXTRACT(MONTH FROM d) IN (9, 10, 11, 12, 1, 2, 3, 4, 5)
ON CONFLICT (depart_on) DO NOTHING;

-- Testimonials.
INSERT INTO testimonials (name, location, content, rating) VALUES
  ('Aditya Menon', 'Bengaluru',
   'Gurudongmar at sunrise genuinely stopped me cold. The crew sorted every permit and the one breakdown we had, so all I had to do was ride. Hard days, but I''d do it again tomorrow.', 5),
  ('Priya Nair', 'Mumbai',
   'Did the trip two-up with my husband. The altitude days are no joke — having the backup vehicle close by meant we never felt stuck. West Sikkim is so much quieter than I expected.', 5),
  ('Rahul Deshpande', 'Pune',
   'The monasteries around Pelling and Yuksom were the real highlight for me, not just the big-name viewpoints. Roads up to Lachen are rough and a couple of days ran long, but the mechanic was always close behind. Worth it.', 4),
  ('Sneha Iyer', 'Hyderabad',
   'Glad it wasn''t just a checklist of photo stops. The Temi tea garden break and the climb up to Dubdi monastery in Yuksom are what stuck with me.', 5),
  ('Vikram Rathore', 'Delhi',
   'Seven days and I barely thought about logistics once — fuel, stays, permits, all handled. The Himalayan 450 was the right bike for those climbs.', 5),
  ('Ananya Bose', 'Kolkata',
   'Rode solo and never once felt out of place. The marshal kept an eye on the group without hovering. Honestly Rinchenpong and the Dentam valley were the surprise of the whole trip.', 5),
  ('Karan Gill', 'Chandigarh',
   'The Scram handled the gorge roads to Lachen better than I expected. Thangu valley and the snowfields before Gurudongmar were unreal. Only wish we''d had an extra day to acclimatise.', 4),
  ('Meera Pillai', 'Kochi',
   'I don''t ride, so I took a shared-cab seat while my husband did. Turned out to be the best of both — comfortable over the high passes and still there for every stop.', 5)
ON CONFLICT DO NOTHING;
