// Data-access layer. Each getter tries Postgres first, then falls back to the
// seeded constants below so the site renders even without a running database
// (e.g. during `next build` static generation or a first local run).

import { query } from "./db";
import { TREKS } from "@/data/treks";

export type BikeModel = {
  id: number;
  name: string;
  engine_cc: number;
  price_double: number;
  price_single: number;
  sort_order: number;
};

export type Testimonial = {
  id: number;
  name: string;
  location: string | null;
  content: string;
  rating: number;
};

export type Trek = {
  id: number;
  slug: string;
  name: string;
  price_per_person: number;
  taxi_fare_extra: boolean;
  sort_order: number;
};

// --- Seed fallbacks (mirror db/init/02-seed.sql) ---------------------------
const SEED_BIKES: BikeModel[] = [
  { id: 1, name: "Himalayan 450", engine_cc: 450, price_double: 45000, price_single: 55000, sort_order: 1 },
  { id: 2, name: "Himalayan 411", engine_cc: 411, price_double: 43000, price_single: 53000, sort_order: 2 },
  { id: 3, name: "Scram 411", engine_cc: 411, price_double: 41000, price_single: 51000, sort_order: 3 },
  { id: 4, name: "Classic 350", engine_cc: 350, price_double: 39000, price_single: 49000, sort_order: 4 },
  { id: 5, name: "Hunter 350", engine_cc: 350, price_double: 37000, price_single: 47000, sort_order: 5 },
];

const SEED_TESTIMONIALS: Testimonial[] = [
  { id: 1, name: "Aditya Menon", location: "Bengaluru", rating: 5, content: "Gurudongmar at sunrise genuinely stopped me cold. The crew sorted every permit and the one breakdown we had, so all I had to do was ride. Hard days, but I'd do it again tomorrow." },
  { id: 2, name: "Priya Nair", location: "Mumbai", rating: 5, content: "Did the trip two-up with my husband. The altitude days are no joke — having the backup vehicle close by meant we never felt stuck. West Sikkim is so much quieter than I expected." },
  { id: 3, name: "Rahul Deshpande", location: "Pune", rating: 4, content: "The monasteries around Pelling and Yuksom were the real highlight for me, not just the big-name viewpoints. Roads up to Lachen are rough and a couple of days ran long, but the mechanic was always close behind. Worth it." },
  { id: 4, name: "Sneha Iyer", location: "Hyderabad", rating: 5, content: "Glad it wasn't just a checklist of photo stops. The Temi tea garden break and the climb up to Dubdi monastery in Yuksom are what stuck with me." },
  { id: 5, name: "Vikram Rathore", location: "Delhi", rating: 5, content: "Seven days and I barely thought about logistics once — fuel, stays, permits, all handled. The Himalayan 450 was the right bike for those climbs." },
  { id: 6, name: "Ananya Bose", location: "Kolkata", rating: 5, content: "Rode solo and never once felt out of place. The marshal kept an eye on the group without hovering. Honestly Rinchenpong and the Dentam valley were the surprise of the whole trip." },
  { id: 7, name: "Karan Gill", location: "Chandigarh", rating: 4, content: "The Scram handled the gorge roads to Lachen better than I expected. Thangu valley and the snowfields before Gurudongmar were unreal. Only wish we'd had an extra day to acclimatise." },
  { id: 8, name: "Meera Pillai", location: "Kochi", rating: 5, content: "I don't ride, so I took a shared-cab seat while my husband did. Turned out to be the best of both — comfortable over the high passes and still there for every stop." },
];

// Seed fallback for treks, derived from the editorial content so price and
// availability have a single source of truth (mirrors db/init/02-seed.sql).
const SEED_TREKS: Trek[] = TREKS.map((t, i) => ({
  id: i + 1,
  slug: t.slug,
  name: t.name,
  price_per_person: t.pricePerPerson,
  taxi_fare_extra: t.taxiFareExtra,
  sort_order: i + 1,
}));

export async function getBikeModels(): Promise<BikeModel[]> {
  const rows = await query<BikeModel>(
    `SELECT id, name, engine_cc, price_double, price_single, sort_order
       FROM bike_models WHERE is_active = TRUE ORDER BY sort_order ASC`,
  );
  return rows && rows.length ? rows : SEED_BIKES;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const rows = await query<Testimonial>(
    `SELECT id, name, location, content, rating
       FROM testimonials WHERE is_published = TRUE ORDER BY created_at DESC`,
  );
  return rows && rows.length ? rows : SEED_TESTIMONIALS;
}

export async function getTreks(): Promise<Trek[]> {
  const rows = await query<Trek>(
    `SELECT id, slug, name, price_per_person, taxi_fare_extra, sort_order
       FROM treks WHERE is_active = TRUE ORDER BY sort_order ASC`,
  );
  return rows && rows.length ? rows : SEED_TREKS;
}

export async function getTrekById(id: number): Promise<Trek | undefined> {
  const treks = await getTreks();
  return treks.find((t) => t.id === id);
}

export async function getOpenDepartures(): Promise<string[]> {
  const rows = await query<{ depart_on: string }>(
    `SELECT to_char(depart_on, 'YYYY-MM-DD') AS depart_on
       FROM trip_dates
      WHERE is_open = TRUE
        AND (bikes_booked < bikes_total OR cab_seats_booked < cab_seats_total)
        AND depart_on >= CURRENT_DATE
      ORDER BY depart_on ASC`,
  );
  return rows && rows.length ? rows.map((r) => r.depart_on) : [];
}
