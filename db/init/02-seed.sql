-- Seed data for The Adventure Mafia.

-- Bike models. Pricing rule encoded by the data itself:
--   single = double + 10,000 ; each step down in engine size = -2,000 / rider.
INSERT INTO bike_models (name, engine_cc, price_double, price_single, sort_order) VALUES
  ('Himalayan 450', 450, 45000, 55000, 1),
  ('Himalayan 411', 411, 43000, 53000, 2),
  ('Scram 411',     411, 41000, 51000, 3),
  ('Classic 350',   350, 39000, 49000, 4),
  ('Hunter 350',    350, 37000, 47000, 5)
ON CONFLICT DO NOTHING;

-- Departure dates: every Sunday in the Sep–May season for the upcoming season.
-- Generated from the date series, keeping only Sundays (DOW = 0) that fall in
-- September–December or January–May.
INSERT INTO trip_dates (depart_on, bikes_total, bikes_booked, cab_seats_total, cab_seats_booked)
SELECT d::date, 20, 0, 10, 0
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
