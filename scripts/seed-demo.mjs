// DEV ONLY: fills a local database with demo operators, listings and generated
// photos so the marketplace can be clicked through end to end.
//
//   ALLOW_DEMO_SEED=1 DATABASE_URL=postgres://… UPLOAD_DIR=/tmp/tam-uploads node scripts/seed-demo.mjs
//
// Refuses to run unless ALLOW_DEMO_SEED=1 and the database host is local.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";

const url = process.env.DATABASE_URL;
if (process.env.ALLOW_DEMO_SEED !== "1") { console.error("Set ALLOW_DEMO_SEED=1 to seed demo data."); process.exit(1); }
if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("Refusing to seed: DATABASE_URL must point at a local database."); process.exit(1); }
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? ".uploads");
const pool = new Pool({ connectionString: url });

const PALETTES = {
  scooter: ["#bfe3f5", "#7fb8d8", "#2d5f7e", "#0e1a24", "#5bb02e"],
  bike: ["#f6d9b0", "#e0a064", "#8a4a2b", "#1d1a17", "#c69c6d"],
  river: ["#cfeee0", "#6cc4a1", "#1f7a63", "#0b2b2a", "#5bb02e"],
  sky: ["#ffd6e0", "#f79fb5", "#8c5aa8", "#1c1636", "#ffe27a"],
};

function scene(kind, seed) {
  const [a, b, c, d, accent] = PALETTES[kind];
  const r = (n) => ((Math.sin(seed * 9301 + n * 49297) + 1) / 2);
  const peaks = (base, amp, color, off) => {
    let pts = `0,900 `;
    for (let x = 0; x <= 1600; x += 160) pts += `${x},${base - amp * (0.4 + r(x + off) * 0.9)} `;
    return `<polygon points="${pts}1600,900" fill="${color}"/>`;
  };
  const extra =
    kind === "river" ? `<path d="M0 760 C 400 700 800 820 1600 740 L1600 900 L0 900Z" fill="${accent}" opacity=".55"/>`
    : kind === "sky" ? `<circle cx="1180" cy="230" r="90" fill="${accent}" opacity=".9"/><path d="M420 420 q60 -70 120 0 q-60 30 -120 0z" fill="${d}"/>`
    : `<rect x="0" y="780" width="1600" height="120" fill="${d}"/><rect x="0" y="835" width="1600" height="8" fill="${accent}" opacity=".7"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="1600" height="900" fill="url(#g)"/>${peaks(520, 260, c, 1)}${peaks(640, 200, d, 7)}${extra}</svg>`);
}

async function savePhotos(companyId, kind, seed, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const src = scene(kind, seed * 10 + i);
    const key = () => `c/${companyId}/${crypto.randomBytes(12).toString("hex")}`;
    const kd = key(), kt = key() + "-t";
    const detail = await sharp(src).resize({ width: 1200, height: 900, fit: "cover" }).webp({ quality: 65 }).toBuffer({ resolveWithObject: true });
    const thumb = await sharp(src).resize({ width: 400, height: 300, fit: "cover" }).webp({ quality: 60 }).toBuffer();
    for (const [k, buf] of [[`${kd}.webp`, detail.data], [`${kt}.webp`, thumb]]) {
      await fs.mkdir(path.dirname(path.join(uploadDir, k)), { recursive: true });
      await fs.writeFile(path.join(uploadDir, k), buf);
    }
    out.push({ url: `/media/${kd}.webp`, thumb: `/media/${kt}.webp`, w: detail.info.width, h: detail.info.height });
  }
  return out;
}

async function id(sql, params) { return (await pool.query(sql, params)).rows[0]?.id; }

async function operator(o) {
  const existing = await id(`SELECT id FROM companies WHERE slug = $1`, [o.slug]);
  if (existing) { console.log(`• ${o.name} already exists`); return existing; }
  const cid = await id(
    `INSERT INTO companies (slug, name, description, contact_email, contact_phone, whatsapp_number, address, maps_url, status, is_verified, auto_publish_listings, approved_at, terms_accepted_at, terms_version)
     VALUES ($1,$2,$3,$4,$5,$5,$6,$7,'approved',$8,TRUE,now(),now(),'2026-10-v1') RETURNING id`,
    [o.slug, o.name, o.description, o.email, o.phone, o.address, o.maps, o.verified]);
  await pool.query(`INSERT INTO company_users (company_id, email, phone, name, role, email_verified) VALUES ($1,$2,$3,$4,'owner',TRUE)`, [cid, o.email, o.phone, o.owner]);
  await pool.query(`INSERT INTO company_payment_settings (company_id, payee_name, upi_vpa, upi_number) VALUES ($1,$2,$3,$4)`, [cid, o.name, o.vpa, o.phone.replace("+91", "")]);
  const region = await id(`SELECT id FROM regions WHERE slug = 'pelling'`);
  await pool.query(`INSERT INTO company_regions (company_id, region_id) VALUES ($1,$2)`, [cid, region]);
  return cid;
}

async function listing(cid, cat, l) {
  const catId = await id(`SELECT id FROM adventure_categories WHERE slug = $1`, [cat]);
  const regionId = await id(`SELECT id FROM regions WHERE slug = 'pelling'`);
  const lid = await id(
    `INSERT INTO adventure_listings (company_id, category_id, region_id, slug, title, description, unit_price, pricing_type, advance_type, advance_value, min_notice_hours,
        meeting_point, cancellation_policy, safety_notes, inclusions, exclusions, availability_type, status, published_at, duration_hours, difficulty, group_min, group_max, min_age, weather_dependent, season, start_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'percent',30,$9,$10,$11,$12,$13,$14,$15,'published',now(),$16,$17,$18,$19,$20,$21,$22,$23) RETURNING id`,
    [cid, catId, regionId, l.slug, l.title, l.description, l.price, l.rental ? "per_unit_day" : "per_person", l.notice ?? 2, l.meeting, l.cancel, l.safety ?? null,
     l.inc ?? [], l.exc ?? [], l.rental ? "open" : "scheduled", l.hours ?? null, l.difficulty ?? null, l.gmin ?? null, l.gmax ?? null, l.minAge ?? null, !l.rental, l.season ?? null, l.rental ? "08:00" : null]);
  if (l.rental) {
    const r = l.rental;
    await pool.query(
      `INSERT INTO listing_rental_details (listing_id, make_model, engine_cc, transmission, fuel_type, units_total, security_deposit, helmets_included, km_limit_per_day, fuel_policy, docs_required, pickup_time, return_by_time, late_fee_per_hour)
       VALUES ($1,$2,$3,$4,$5,$6,$7,2,$8,$9,$10,'08:00','19:00',$11)`,
      [lid, l.title, r.cc, r.gears, r.fuel ?? "petrol", r.units, r.deposit, r.km, "Return with the same fuel level", ["Original driving licence", "Government photo ID (Aadhaar, passport or voter ID)"], r.late]);
  } else {
    const s = l.session;
    await pool.query(
      `INSERT INTO listing_session_details (listing_id, rapids_grade, stretch_name, distance_km, flight_minutes, takeoff_altitude_m, min_weight_kg, max_weight_kg, max_age, swim_required, certification, equipment_notes, waiver_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)`,
      [lid, s.grade ?? null, s.stretch ?? null, s.km ?? null, s.flight ?? null, s.alt ?? null, s.minW, s.maxW, s.maxAge, s.swim ?? false, s.cert, s.gear]);
    for (const slot of s.slots) await pool.query(`INSERT INTO listing_slot_templates (listing_id, slot_time, capacity) VALUES ($1,$2::time,$3)`, [lid, slot[0], slot[1]]);
  }
  const photos = await savePhotos(cid, l.kind, l.seed, 3);
  let i = 0;
  for (const p of photos) await pool.query(`INSERT INTO listing_images (listing_id, url, thumb_url, width, height, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`, [lid, p.url, p.thumb, p.w, p.h, i++]);
  console.log(`  + ${l.title}`);
}

const CANCEL_R = "Free cancellation up to 24 hours before pickup. After that the advance is not refunded.";
const CANCEL_S = "Full refund or a free reschedule if we cancel for weather or safety. Otherwise the advance is not refunded within 24 hours of the slot.";

console.log("Seeding demo operators…");
const himal = await operator({ slug: "himal-rentals", name: "Himal Rentals", owner: "Tashi Sherpa", email: "himal@example.com", phone: "+919800000001", vpa: "himal.rentals@okaxis", verified: true,
  description: "Family-run rental shop near the Pelling helipad since 2016. Well-kept scooties and Royal Enfields, helmets included.", address: "Opposite the helipad, Upper Pelling, West Sikkim", maps: "https://maps.google.com/?q=Pelling+Helipad" });
const kanch = await operator({ slug: "kanchenjunga-wheels", name: "Kanchenjunga Wheels", owner: "Pema Lhamo", email: "wheels@example.com", phone: "+919800000002", vpa: "kwheels@ybl", verified: false,
  description: "Budget scooties and bikes in Lower Pelling. Friendly, no-fuss, WhatsApp us anytime.", address: "Lower Pelling bazaar, West Sikkim", maps: null });
const teesta = await operator({ slug: "teesta-river-runners", name: "Teesta River Runners", owner: "Dorjee Bhutia", email: "runners@example.com", phone: "+919800000003", vpa: "trr@oksbi", verified: true,
  description: "Certified rafting guides on the Teesta and Rangit. Safety kayakers on every run.", address: "Pelling taxi stand (pickup point)", maps: null });
const skyfly = await operator({ slug: "sikkim-sky-flyers", name: "Sikkim Sky Flyers", owner: "Karma Gurung", email: "sky@example.com", phone: "+919800000004", vpa: "skyflyers@okhdfcbank", verified: true,
  description: "Tandem paragliding with experienced, licensed pilots. Photos and video included.", address: "Pelling helipad ground", maps: null });

const have = await id(`SELECT 1 AS id FROM adventure_listings WHERE company_id = $1 LIMIT 1`, [himal]);
if (!have) {
  await listing(himal, "scooty-rental", { slug: "honda-activa-6g", title: "Honda Activa 6G", kind: "scooter", seed: 1, price: 800, meeting: "Opposite the helipad, Upper Pelling", cancel: CANCEL_R,
    description: "Easy automatic scooter — the simplest way to get around Pelling and out to Pemayangtse, Rabdentse and the viewpoints. Light, reliable and fuel-efficient.",
    inc: ["2 helmets", "Basic toolkit", "Phone holder"], exc: ["Fuel"], rental: { cc: 110, gears: "automatic", units: 4, deposit: 1500, km: 80, late: 100 } });
  await listing(himal, "bike-rental", { slug: "royal-enfield-classic-350", title: "Royal Enfield Classic 350", kind: "bike", seed: 2, price: 1800, meeting: "Opposite the helipad, Upper Pelling", cancel: CANCEL_R,
    description: "The classic thump for the Pelling–Geyzing and Khecheopalri roads. Regularly serviced, riding-gear friendly.", inc: ["2 helmets", "Toolkit"], exc: ["Fuel", "Riding gear"], rental: { cc: 350, gears: "gear", units: 3, deposit: 3000, km: 120, late: 200 } });
  await listing(kanch, "scooty-rental", { slug: "suzuki-access-125", title: "Suzuki Access 125", kind: "scooter", seed: 3, price: 700, meeting: "Lower Pelling bazaar, next to the petrol pump", cancel: CANCEL_R,
    description: "Comfortable 125cc automatic with under-seat storage. Good for two on town roads. Cheap, clean and ready to go.", inc: ["1 helmet"], exc: ["Fuel"], rental: { cc: 125, gears: "automatic", units: 6, deposit: 1000, km: 70, late: 80 } });
  await listing(kanch, "bike-rental", { slug: "bajaj-pulsar-150", title: "Bajaj Pulsar 150", kind: "bike", seed: 4, price: 1200, meeting: "Lower Pelling bazaar, next to the petrol pump", cancel: CANCEL_R,
    description: "A dependable geared 150cc for confident riders. Light enough for the hill roads.", inc: ["2 helmets"], exc: ["Fuel"], rental: { cc: 150, gears: "gear", units: 2, deposit: 2000, km: 100, late: 150 } });
  await listing(teesta, "rafting", { slug: "teesta-grade-3-rafting", title: "Teesta river rafting, Grade III", kind: "river", seed: 5, price: 1500, hours: 3, difficulty: "moderate", gmin: 1, gmax: 8, minAge: 12, notice: 6, meeting: "Pelling taxi stand — we drive you to the river", cancel: CANCEL_S,
    description: "A 12 km run through Grade III–IV rapids with certified guides and a safety kayaker. Gear, briefing and a hot chai at the end are all included. No experience needed, but you must be a reasonably confident swimmer.",
    safety: "Life jackets and helmets are mandatory. We do not run in high water.", inc: ["Life jacket and helmet", "Certified guide", "Transfers from Pelling", "Hot chai"], exc: ["Lunch", "Photos"],
    session: { grade: 3, stretch: "Teesta, Melli to Sirwani", km: 12, minW: 35, maxW: 120, maxAge: 65, swim: true, cert: "Guides hold IMF-certified rafting guide licences; a safety kayaker follows every raft", gear: "Life jackets, helmets, paddles, safety kayak", slots: [["09:00", 12], ["13:00", 12]] } });
  await listing(skyfly, "paragliding", { slug: "tandem-paragliding-pelling", title: "Tandem paragliding over the valley", kind: "sky", seed: 6, price: 3500, hours: 2, difficulty: "easy", gmin: 1, gmax: 2, minAge: 10, notice: 6, meeting: "Pelling helipad ground", cancel: CANCEL_S,
    description: "Fly tandem with an experienced pilot over the green valley with Kanchenjunga on the horizon. About 15 minutes in the air, with a short briefing first. No experience needed — you just run a few steps and lift off.",
    safety: "Maximum passenger weight is strictly enforced for safety. Flights depend on wind and visibility.", inc: ["Licensed tandem pilot", "Helmet and harness", "Photos and video"], exc: ["Transport to the take-off point"],
    session: { flight: 15, alt: 2150, minW: 25, maxW: 95, maxAge: 70, cert: "Pilots hold PAI/APPI tandem licences with 500+ flights each", gear: "Wing, harness and helmet provided", slots: [["08:00", 4], ["10:30", 4], ["15:00", 4]] } });
}
await pool.end();
console.log("Done. Operator logins use email OTP; in dev the code is printed in the server log.");
