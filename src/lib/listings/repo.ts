import type { PoolClient } from "pg";
import { requirePool, withTx } from "../db";
import { HttpError } from "../api";
import { todayIST } from "../dates";
import { slugify } from "../operators/service";
import { peakFutureHeld, slotHasFutureBookings } from "../booking/availability";
import type { ListingInput, RentalListingInput, SessionListingInput, TourListingInput, VehicleListingInput } from "../validation/listing";

async function regionIdForSlug(client: PoolClient, slug: string | null | undefined): Promise<number | null> {
  if (!slug) return null;
  const r = await client.query<{ id: number }>(`SELECT id FROM regions WHERE slug = $1`, [slug]);
  if (!r.rows[0]) throw new HttpError(422, "Unknown region.");
  return r.rows[0].id;
}

/**
 * Sync recurring time slots (sessions: time-of-day capacity; tours:
 * departure-day capacity) against what's already saved. Never silently
 * orphans or squeezes a slot that an upcoming booking already holds.
 */
async function syncSlotTemplates(
  client: PoolClient,
  listingId: number,
  slots: { time: string; capacity: number; daysOfWeek: number[]; validFrom: string | null; validTo: string | null }[],
  today: string,
) {
  const existing = await client.query<{ slot_time: string; capacity: number }>(
    `SELECT to_char(slot_time, 'HH24:MI') AS slot_time, capacity FROM listing_slot_templates WHERE listing_id = $1`,
    [listingId],
  );
  const wanted = new Map(slots.map((s) => [s.time, s]));
  for (const e of existing.rows) {
    const w = wanted.get(e.slot_time);
    if (!w) {
      if (await slotHasFutureBookings(client, listingId, today, e.slot_time)) {
        throw new HttpError(409, `The ${e.slot_time} slot has upcoming bookings, so it can't be removed. Block dates instead, or move those bookings first.`);
      }
      await client.query(`DELETE FROM listing_slot_templates WHERE listing_id = $1 AND slot_time = $2::time`, [listingId, e.slot_time]);
    } else if (w.capacity < e.capacity) {
      const peak = await peakFutureHeld(client, listingId, today, e.slot_time);
      if (w.capacity < peak) throw new HttpError(409, `The ${e.slot_time} slot already has ${peak} people booked on an upcoming day, so you can't go below ${peak}.`);
    }
  }
  for (const s of slots) {
    await client.query(
      `INSERT INTO listing_slot_templates (listing_id, slot_time, capacity, days_of_week, valid_from, valid_to, is_active)
       VALUES ($1,$2::time,$3,$4,$5,$6,TRUE)
       ON CONFLICT (listing_id, slot_time) DO UPDATE SET capacity = EXCLUDED.capacity, days_of_week = EXCLUDED.days_of_week,
          valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, is_active = TRUE`,
      [listingId, s.time, s.capacity, s.daysOfWeek, s.validFrom, s.validTo],
    );
  }
}

export const MAX_IMAGES_PER_LISTING = 8;

export type ListingStatus = "draft" | "pending_review" | "published" | "changes_requested" | "rejected" | "deactivated";

export type ListingSummary = {
  id: number;
  slug: string;
  title: string;
  status: ListingStatus;
  moderationNote: string | null;
  unitPrice: number | null;
  categorySlug: string;
  categoryName: string;
  bookingModel: "rental_day" | "session" | "departure" | "route_trip" | "enquiry";
  regionName: string;
  unitsTotal: number | null;
  makeModel: string | null;
  cover: string | null;
  imageCount: number;
  slotCount: number;
  updatedAt: string;
};

export type ListingImage = {
  id: number; url: string; thumbUrl: string | null; width: number | null; height: number | null; sortOrder: number;
  mediaType: "photo" | "video"; durationSeconds: number | null; posterUrl: string | null;
};

export type ListingDetail = {
  id: number;
  slug: string;
  status: ListingStatus;
  moderationNote: string | null;
  bookingModel: "rental_day" | "session" | "departure" | "route_trip";
  images: ListingImage[];
  /** Shaped like the editor form / listingSchema input. */
  form: ListingInput;
};

const toHHMM = (t: string | null) => (t ? t.slice(0, 5) : null);

async function uniqueListingSlug(client: PoolClient, companyId: number, title: string): Promise<string> {
  const base = slugify(title) || "listing";
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await client.query(`SELECT 1 FROM adventure_listings WHERE company_id = $1 AND slug = $2`, [companyId, candidate]);
    if (!taken.rowCount) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Every query here is scoped by `companyId`, which callers take from the
 * authenticated session (getOperatorSession) — never from a request body or
 * URL. Child tables are reached only through a listing owned by the company.
 */
export function forCompany(companyId: number) {
  const pool = () => requirePool();

  /** 404 unless the listing belongs to this company. */
  async function assertOwned(client: Pick<PoolClient, "query">, listingId: number, lock = false) {
    const res = await client.query<{ id: number; status: ListingStatus; category_id: number; moderation_note: string | null; booking_model: string }>(
      `SELECT l.id, l.status, l.category_id, l.moderation_note, ac.booking_model
         FROM adventure_listings l JOIN adventure_categories ac ON ac.id = l.category_id
        WHERE l.id = $1 AND l.company_id = $2 ${lock ? "FOR NO KEY UPDATE OF l" : ""}`,
      [listingId, companyId],
    );
    if (!res.rows[0]) throw new HttpError(404, "Listing not found.");
    return res.rows[0];
  }

  return {
    assertOwned: (listingId: number) => assertOwned(pool(), listingId),

    async list(): Promise<ListingSummary[]> {
      const res = await pool().query(
        `SELECT l.id, l.slug, l.title, l.status, l.unit_price, l.moderation_note, l.updated_at,
                ac.slug AS category_slug, ac.name AS category_name, ac.booking_model, r.name AS region_name,
                COALESCE(rd.units_total, vd.units_total) AS units_total, rd.make_model,
                (SELECT i.thumb_url FROM listing_images i WHERE i.listing_id = l.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover,
                (SELECT count(*) FROM listing_images i WHERE i.listing_id = l.id)::int AS image_count,
                (SELECT count(*) FROM listing_slot_templates t WHERE t.listing_id = l.id AND t.is_active)::int AS slot_count
           FROM adventure_listings l
           JOIN adventure_categories ac ON ac.id = l.category_id
           JOIN regions r ON r.id = l.region_id
           LEFT JOIN listing_rental_details rd ON rd.listing_id = l.id
           LEFT JOIN listing_vehicle_details vd ON vd.listing_id = l.id
          WHERE l.company_id = $1
          ORDER BY l.updated_at DESC`,
        [companyId],
      );
      return res.rows.map((r) => ({
        id: r.id, slug: r.slug, title: r.title, status: r.status, moderationNote: r.moderation_note,
        unitPrice: r.unit_price, categorySlug: r.category_slug, categoryName: r.category_name, bookingModel: r.booking_model,
        regionName: r.region_name, unitsTotal: r.units_total, makeModel: r.make_model, cover: r.cover,
        imageCount: r.image_count, slotCount: r.slot_count, updatedAt: new Date(r.updated_at).toISOString(),
      }));
    },

    async get(listingId: number): Promise<ListingDetail> {
      const res = await pool().query(
        `SELECT l.*, ac.slug AS category_slug, ac.booking_model, r.slug AS region_slug,
                rd.make_model, rd.engine_cc, rd.transmission, rd.fuel_type, rd.units_total, rd.security_deposit, rd.helmets_included,
                rd.km_limit_per_day, rd.fuel_policy, rd.docs_required, rd.pickup_time, rd.return_by_time, rd.late_fee_per_hour, rd.area_restrictions,
                sd.rapids_grade, sd.stretch_name, sd.distance_km, sd.flight_minutes, sd.takeoff_altitude_m, sd.min_weight_kg, sd.max_weight_kg,
                sd.max_age, sd.swim_required, sd.certification, sd.equipment_notes, sd.waiver_required,
                td.trip_type, end_r.slug AS end_region_slug, td.itinerary, td.highlights, td.accommodation_type, td.meal_plan,
                td.transport_included, td.max_altitude_m, td.docs_required AS tour_docs_required,
                vd.vehicle_type, vd.seats, vd.ac AS vehicle_ac, vd.luggage_note, vd.units_total AS vehicle_units_total, vd.one_way,
                vd.pickup_time AS vehicle_pickup_time, vd.route_catalog_id, origin_r.slug AS origin_region_slug,
                dest_r.slug AS destination_region_slug, vd.registration_number, vd.rc_expiry
           FROM adventure_listings l
           JOIN adventure_categories ac ON ac.id = l.category_id
           JOIN regions r ON r.id = l.region_id
           LEFT JOIN listing_rental_details rd ON rd.listing_id = l.id
           LEFT JOIN listing_session_details sd ON sd.listing_id = l.id
           LEFT JOIN listing_tour_details td ON td.listing_id = l.id
           LEFT JOIN regions end_r ON end_r.id = td.end_region_id
           LEFT JOIN listing_vehicle_details vd ON vd.listing_id = l.id
           LEFT JOIN regions origin_r ON origin_r.id = vd.origin_region_id
           LEFT JOIN regions dest_r ON dest_r.id = vd.destination_region_id
          WHERE l.id = $1 AND l.company_id = $2`,
        [listingId, companyId],
      );
      const l = res.rows[0];
      if (!l) throw new HttpError(404, "Listing not found.");

      const [imgs, slots] = await Promise.all([
        pool().query(`SELECT id, url, thumb_url, width, height, sort_order, media_type, duration_seconds, poster_url FROM listing_images WHERE listing_id = $1 ORDER BY sort_order, id`, [listingId]),
        pool().query(`SELECT slot_time, capacity, days_of_week, valid_from, valid_to FROM listing_slot_templates WHERE listing_id = $1 AND is_active ORDER BY slot_time`, [listingId]),
      ]);

      const common = {
        title: l.title, description: l.description ?? "", regionSlug: l.region_slug, unitPrice: l.unit_price ?? 0,
        advanceType: l.advance_type, advanceValue: l.advance_value, minNoticeHours: l.min_notice_hours,
        meetingPoint: l.meeting_point ?? undefined, cancellationPolicy: l.cancellation_policy ?? "",
        safetyNotes: l.safety_notes ?? undefined, inclusions: l.inclusions ?? [], exclusions: l.exclusions ?? [],
      };
      const slotForms = slots.rows.map((s) => ({
        time: toHHMM(s.slot_time)!, capacity: s.capacity, daysOfWeek: s.days_of_week,
        validFrom: s.valid_from ? new Date(s.valid_from).toISOString().slice(0, 10) : null,
        validTo: s.valid_to ? new Date(s.valid_to).toISOString().slice(0, 10) : null,
      }));

      let form: ListingInput;
      if (l.booking_model === "rental_day") {
        form = {
          ...common, kind: "rental_day", categorySlug: l.category_slug,
          makeModel: l.make_model ?? "", engineCc: l.engine_cc, transmission: l.transmission ?? "gear", fuelType: l.fuel_type ?? "petrol",
          unitsTotal: l.units_total ?? 1, securityDeposit: l.security_deposit ?? 0, helmetsIncluded: l.helmets_included ?? 2,
          kmLimitPerDay: l.km_limit_per_day, fuelPolicy: l.fuel_policy ?? undefined, docsRequired: l.docs_required ?? [],
          pickupTime: toHHMM(l.pickup_time) ?? "08:00", returnByTime: toHHMM(l.return_by_time) ?? "19:00",
          lateFeePerHour: l.late_fee_per_hour, areaRestrictions: l.area_restrictions ?? undefined,
        };
      } else if (l.booking_model === "session") {
        form = {
          ...common, kind: "session", categorySlug: l.category_slug,
          durationHours: l.duration_hours ?? 2, difficulty: l.difficulty, groupMin: l.group_min, groupMax: l.group_max,
          minAge: l.min_age, maxAge: l.max_age, minWeightKg: l.min_weight_kg, maxWeightKg: l.max_weight_kg,
          rapidsGrade: l.rapids_grade, stretchName: l.stretch_name ?? undefined,
          distanceKm: l.distance_km === null ? null : Number(l.distance_km), flightMinutes: l.flight_minutes,
          takeoffAltitudeM: l.takeoff_altitude_m, swimRequired: l.swim_required ?? false,
          certification: l.certification ?? "", equipmentNotes: l.equipment_notes ?? undefined,
          waiverRequired: l.waiver_required ?? true, weatherDependent: l.weather_dependent, season: l.season ?? undefined,
          slots: slotForms,
        };
      } else if (l.booking_model === "departure") {
        form = {
          ...common, kind: "departure", categorySlug: l.category_slug,
          durationDays: l.duration_days ?? 1, durationNights: l.duration_nights ?? 0, difficulty: l.difficulty,
          groupMin: l.group_min, groupMax: l.group_max, minAge: l.min_age, season: l.season ?? undefined,
          weatherDependent: l.weather_dependent, tripType: l.trip_type ?? "circuit", endRegionSlug: l.end_region_slug ?? null,
          itinerary: l.itinerary ?? [], highlights: l.highlights ?? [], accommodationType: l.accommodation_type ?? undefined,
          mealPlan: l.meal_plan ?? undefined, transportIncluded: l.transport_included ?? true,
          maxAltitudeM: l.max_altitude_m, docsRequired: l.tour_docs_required ?? [], slots: slotForms,
        };
      } else {
        form = {
          ...common, kind: "route_trip", categorySlug: l.category_slug,
          vehicleType: l.vehicle_type ?? "sedan", seats: l.seats ?? 4, ac: l.vehicle_ac ?? true,
          luggageNote: l.luggage_note ?? undefined, unitsTotal: l.vehicle_units_total ?? 1, oneWay: l.one_way ?? true,
          pickupTime: toHHMM(l.vehicle_pickup_time), routeCatalogId: l.route_catalog_id,
          originRegionSlug: l.origin_region_slug ?? null, destinationRegionSlug: l.destination_region_slug ?? null,
          registrationNumber: l.registration_number ?? undefined, rcExpiry: l.rc_expiry ? new Date(l.rc_expiry).toISOString().slice(0, 10) : null,
        };
      }

      return {
        id: l.id, slug: l.slug, status: l.status, moderationNote: l.moderation_note, bookingModel: l.booking_model, form,
        images: imgs.rows.map((i) => ({
          id: i.id, url: i.url, thumbUrl: i.thumb_url, width: i.width, height: i.height, sortOrder: i.sort_order,
          mediaType: i.media_type, durationSeconds: i.duration_seconds, posterUrl: i.poster_url,
        })),
      };
    },

    /** Create (listingId = null) or update a listing and its category-specific details. */
    async save(listingId: number | null, input: ListingInput): Promise<{ id: number; slug: string }> {
      return withTx(async (client) => {
        const cat = await client.query<{ id: number; booking_model: string }>(
          `SELECT id, booking_model FROM adventure_categories WHERE slug = $1 AND is_active`,
          [input.categorySlug],
        );
        if (!cat.rows[0] || cat.rows[0].booking_model !== input.kind) throw new HttpError(422, "That category doesn't match this kind of listing.");
        const region = await client.query<{ id: number }>(`SELECT id FROM regions WHERE slug = $1`, [input.regionSlug]);
        if (!region.rows[0]) throw new HttpError(422, "Choose where this happens.");
        const categoryId = cat.rows[0].id;

        // An operator listing a new kind of thing implicitly offers that category.
        await client.query(`INSERT INTO company_categories (company_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [companyId, categoryId]);

        const rental = input.kind === "rental_day" ? (input as RentalListingInput) : null;
        const session = input.kind === "session" ? (input as SessionListingInput) : null;
        const tour = input.kind === "departure" ? (input as TourListingInput) : null;
        const vehicle = input.kind === "route_trip" ? (input as VehicleListingInput) : null;

        const difficulty = session?.difficulty ?? tour?.difficulty ?? null;
        const groupMin = session?.groupMin ?? tour?.groupMin ?? null;
        const groupMax = session?.groupMax ?? tour?.groupMax ?? null;
        const minAge = session?.minAge ?? tour?.minAge ?? null;
        const weatherDependent = session?.weatherDependent ?? tour?.weatherDependent ?? false;
        const season = session?.season ?? tour?.season ?? null;
        const pricingType = rental ? "per_unit_day" : vehicle ? "per_vehicle" : "per_person";
        const availabilityType = rental || vehicle ? "open" : "scheduled";

        let id: number;
        let slug: string;
        if (listingId === null) {
          slug = await uniqueListingSlug(client, companyId, input.title);
          const ins = await client.query<{ id: number }>(
            `INSERT INTO adventure_listings (company_id, category_id, region_id, slug, title, description, unit_price, pricing_type,
                advance_type, advance_value, min_notice_hours, meeting_point, cancellation_policy, safety_notes, inclusions, exclusions,
                availability_type, status, duration_hours, duration_days, duration_nights, difficulty, group_min, group_max, min_age,
                weather_dependent, season, start_time)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'draft',$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING id`,
            [companyId, categoryId, region.rows[0].id, slug, input.title, input.description, input.unitPrice,
              pricingType, input.advanceType, input.advanceValue, input.minNoticeHours,
              input.meetingPoint ?? null, input.cancellationPolicy, input.safetyNotes ?? null, input.inclusions, input.exclusions,
              availabilityType,
              session?.durationHours ?? null, tour?.durationDays ?? null, tour?.durationNights ?? null,
              difficulty, groupMin, groupMax, minAge, weatherDependent, season, rental?.pickupTime ?? null],
          );
          id = ins.rows[0].id;
        } else {
          const owned = await assertOwned(client, listingId, true); // per-listing mutex, same one bookings take
          if (owned.category_id !== categoryId) throw new HttpError(422, "A listing's category can't be changed — create a new listing instead.");
          id = listingId;
          const cur = await client.query<{ slug: string }>(`SELECT slug FROM adventure_listings WHERE id = $1`, [id]);
          slug = cur.rows[0].slug;
          await client.query(
            `UPDATE adventure_listings SET region_id = $2, title = $3, description = $4, unit_price = $5,
                advance_type = $6, advance_value = $7, min_notice_hours = $8, meeting_point = $9, cancellation_policy = $10,
                safety_notes = $11, inclusions = $12, exclusions = $13,
                duration_hours = $14, duration_days = $15, duration_nights = $16, difficulty = $17, group_min = $18, group_max = $19,
                min_age = $20, weather_dependent = $21, season = $22, start_time = $23, updated_at = now()
              WHERE id = $1 AND company_id = $24`,
            [id, region.rows[0].id, input.title, input.description, input.unitPrice, input.advanceType, input.advanceValue,
              input.minNoticeHours, input.meetingPoint ?? null, input.cancellationPolicy, input.safetyNotes ?? null,
              input.inclusions, input.exclusions,
              session?.durationHours ?? null, tour?.durationDays ?? null, tour?.durationNights ?? null,
              difficulty, groupMin, groupMax, minAge, weatherDependent, season, rental?.pickupTime ?? null, companyId],
          );
        }

        const today = todayIST();
        if (rental) {
          if (listingId !== null) {
            const peak = await peakFutureHeld(client, id, today);
            if (rental.unitsTotal < peak) {
              throw new HttpError(409, `You already have ${peak} units booked on an upcoming day, so you can't go below ${peak}.`);
            }
          }
          await client.query(
            `INSERT INTO listing_rental_details (listing_id, make_model, engine_cc, transmission, fuel_type, units_total, security_deposit,
                helmets_included, km_limit_per_day, fuel_policy, docs_required, pickup_time, return_by_time, late_fee_per_hour, area_restrictions)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             ON CONFLICT (listing_id) DO UPDATE SET make_model = EXCLUDED.make_model, engine_cc = EXCLUDED.engine_cc,
                transmission = EXCLUDED.transmission, fuel_type = EXCLUDED.fuel_type, units_total = EXCLUDED.units_total,
                security_deposit = EXCLUDED.security_deposit, helmets_included = EXCLUDED.helmets_included,
                km_limit_per_day = EXCLUDED.km_limit_per_day, fuel_policy = EXCLUDED.fuel_policy, docs_required = EXCLUDED.docs_required,
                pickup_time = EXCLUDED.pickup_time, return_by_time = EXCLUDED.return_by_time,
                late_fee_per_hour = EXCLUDED.late_fee_per_hour, area_restrictions = EXCLUDED.area_restrictions`,
            [id, rental.makeModel, rental.engineCc, rental.transmission, rental.fuelType, rental.unitsTotal, rental.securityDeposit,
              rental.helmetsIncluded, rental.kmLimitPerDay, rental.fuelPolicy ?? null, rental.docsRequired, rental.pickupTime,
              rental.returnByTime, rental.lateFeePerHour, rental.areaRestrictions ?? null],
          );
        }

        if (session) {
          await client.query(
            `INSERT INTO listing_session_details (listing_id, rapids_grade, stretch_name, distance_km, flight_minutes, takeoff_altitude_m,
                min_weight_kg, max_weight_kg, max_age, swim_required, certification, equipment_notes, waiver_required)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (listing_id) DO UPDATE SET rapids_grade = EXCLUDED.rapids_grade, stretch_name = EXCLUDED.stretch_name,
                distance_km = EXCLUDED.distance_km, flight_minutes = EXCLUDED.flight_minutes, takeoff_altitude_m = EXCLUDED.takeoff_altitude_m,
                min_weight_kg = EXCLUDED.min_weight_kg, max_weight_kg = EXCLUDED.max_weight_kg, max_age = EXCLUDED.max_age,
                swim_required = EXCLUDED.swim_required, certification = EXCLUDED.certification,
                equipment_notes = EXCLUDED.equipment_notes, waiver_required = EXCLUDED.waiver_required`,
            [id, session.rapidsGrade, session.stretchName ?? null, session.distanceKm, session.flightMinutes, session.takeoffAltitudeM,
              session.minWeightKg, session.maxWeightKg, session.maxAge, session.swimRequired, session.certification,
              session.equipmentNotes ?? null, session.waiverRequired],
          );
          await syncSlotTemplates(client, id, session.slots, today);
        }

        if (tour) {
          const endRegionId = await regionIdForSlug(client, tour.endRegionSlug);
          await client.query(
            `INSERT INTO listing_tour_details (listing_id, trip_type, end_region_id, itinerary, highlights, accommodation_type,
                meal_plan, transport_included, max_altitude_m, docs_required)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (listing_id) DO UPDATE SET trip_type = EXCLUDED.trip_type, end_region_id = EXCLUDED.end_region_id,
                itinerary = EXCLUDED.itinerary, highlights = EXCLUDED.highlights, accommodation_type = EXCLUDED.accommodation_type,
                meal_plan = EXCLUDED.meal_plan, transport_included = EXCLUDED.transport_included,
                max_altitude_m = EXCLUDED.max_altitude_m, docs_required = EXCLUDED.docs_required`,
            [id, tour.tripType, endRegionId, JSON.stringify(tour.itinerary), tour.highlights, tour.accommodationType ?? null,
              tour.mealPlan ?? null, tour.transportIncluded, tour.maxAltitudeM, tour.docsRequired],
          );
          await syncSlotTemplates(client, id, tour.slots, today);
        }

        if (vehicle) {
          let originRegionId: number | null;
          let destinationRegionId: number | null;
          if (vehicle.routeCatalogId !== null) {
            const route = await client.query<{ origin_region_id: number; destination_region_id: number }>(
              `SELECT origin_region_id, destination_region_id FROM vehicle_route_catalog WHERE id = $1 AND is_active`,
              [vehicle.routeCatalogId],
            );
            if (!route.rows[0]) throw new HttpError(422, "That standardized route isn't available anymore. Pick another, or set a custom route.");
            originRegionId = route.rows[0].origin_region_id;
            destinationRegionId = route.rows[0].destination_region_id;
          } else {
            originRegionId = await regionIdForSlug(client, vehicle.originRegionSlug);
            destinationRegionId = await regionIdForSlug(client, vehicle.destinationRegionSlug);
          }
          if (listingId !== null) {
            const peak = await peakFutureHeld(client, id, today);
            if (vehicle.unitsTotal < peak) {
              throw new HttpError(409, `You already have ${peak} vehicles booked on an upcoming day, so you can't go below ${peak}.`);
            }
          }
          await client.query(
            `INSERT INTO listing_vehicle_details (listing_id, vehicle_type, seats, ac, luggage_note, units_total, one_way, pickup_time,
                route_catalog_id, origin_region_id, destination_region_id, registration_number, rc_expiry)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (listing_id) DO UPDATE SET vehicle_type = EXCLUDED.vehicle_type, seats = EXCLUDED.seats, ac = EXCLUDED.ac,
                luggage_note = EXCLUDED.luggage_note, units_total = EXCLUDED.units_total, one_way = EXCLUDED.one_way,
                pickup_time = EXCLUDED.pickup_time, route_catalog_id = EXCLUDED.route_catalog_id,
                origin_region_id = EXCLUDED.origin_region_id, destination_region_id = EXCLUDED.destination_region_id,
                registration_number = EXCLUDED.registration_number, rc_expiry = EXCLUDED.rc_expiry`,
            [id, vehicle.vehicleType, vehicle.seats, vehicle.ac, vehicle.luggageNote ?? null, vehicle.unitsTotal, vehicle.oneWay,
              vehicle.pickupTime, vehicle.routeCatalogId, originRegionId, destinationRegionId,
              vehicle.registrationNumber ?? null, vehicle.rcExpiry],
          );
        }
        return { id, slug };
      });
    },

    /**
     * Send a draft for review (or publish it straight away for trusted
     * operators). Returns the resulting status.
     */
    async submit(listingId: number): Promise<ListingStatus> {
      return withTx(async (client) => {
        const owned = await assertOwned(client, listingId, true);
        if (!["draft", "changes_requested", "rejected"].includes(owned.status)) {
          throw new HttpError(409, owned.status === "pending_review" ? "It's already waiting for review." : "This listing can't be submitted right now.");
        }

        const missing: string[] = [];
        // Sequential on purpose: a transaction client runs one query at a time.
        const images = await client.query(`SELECT 1 FROM listing_images WHERE listing_id = $1 AND media_type = 'photo' LIMIT 1`, [listingId]);
        const pay = await client.query(`SELECT 1 FROM company_payment_settings WHERE company_id = $1 AND (upi_vpa IS NOT NULL OR upi_number IS NOT NULL OR qr_image_url IS NOT NULL)`, [companyId]);
        const slots = await client.query(`SELECT 1 FROM listing_slot_templates WHERE listing_id = $1 AND is_active LIMIT 1`, [listingId]);
        const company = await client.query<{ status: string; auto_publish_listings: boolean }>(`SELECT status, auto_publish_listings FROM companies WHERE id = $1`, [companyId]);
        if (!images.rowCount) missing.push("Add at least one photo");
        if (!pay.rowCount) missing.push("Add your UPI details under Payments so customers know where to pay");
        if (owned.booking_model === "session" && !slots.rowCount) missing.push("Add at least one time slot");
        if (missing.length) throw new HttpError(422, "Almost there — finish these first.", { missing });

        const co = company.rows[0];
        const next: ListingStatus = co.status === "approved" && co.auto_publish_listings ? "published" : "pending_review";
        await client.query(
          `UPDATE adventure_listings SET status = $2, moderation_note = NULL, updated_at = now(),
                  published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
            WHERE id = $1 AND company_id = $3`,
          [listingId, next, companyId],
        );
        await client.query(`INSERT INTO audit_log (actor_type, company_id, action, meta) VALUES ('operator', $1, 'listing.submit', $2)`, [companyId, JSON.stringify({ listingId, next })]);
        return next;
      });
    },

    /** Operator pause / resume. A listing an admin took down can't be resumed by the operator. */
    async setActive(listingId: number, active: boolean): Promise<ListingStatus> {
      return withTx(async (client) => {
        const owned = await assertOwned(client, listingId, true);
        if (!active) {
          if (!["published", "pending_review"].includes(owned.status)) throw new HttpError(409, "Only live listings can be paused.");
          await client.query(`UPDATE adventure_listings SET status = 'deactivated', moderation_note = NULL, updated_at = now() WHERE id = $1 AND company_id = $2`, [listingId, companyId]);
          return "deactivated";
        }
        if (owned.status !== "deactivated") throw new HttpError(409, "This listing isn't paused.");
        if (owned.moderation_note) throw new HttpError(403, "This listing was taken down by our team. Contact us to get it reinstated.");
        await client.query(`UPDATE adventure_listings SET status = 'published', updated_at = now() WHERE id = $1 AND company_id = $2`, [listingId, companyId]);
        return "published";
      });
    },

    async addImage(
      listingId: number,
      img: { url: string; thumbUrl: string | null; width: number | null; height: number | null; mediaType?: "photo" | "video"; durationSeconds?: number; posterUrl?: string },
    ): Promise<ListingImage> {
      return withTx(async (client) => {
        await assertOwned(client, listingId, true);
        const mediaType = img.mediaType ?? "photo";
        const count = await client.query<{ n: number; next: number; videos: number }>(
          `SELECT count(*)::int AS n, COALESCE(MAX(sort_order), -1) + 1 AS next,
                  count(*) FILTER (WHERE media_type = 'video')::int AS videos
             FROM listing_images WHERE listing_id = $1`,
          [listingId],
        );
        if (mediaType === "photo" && count.rows[0].n - count.rows[0].videos >= MAX_IMAGES_PER_LISTING) {
          throw new HttpError(409, `You can add up to ${MAX_IMAGES_PER_LISTING} photos.`);
        }
        if (mediaType === "video" && count.rows[0].videos >= 1) throw new HttpError(409, "You can add one short video per listing.");
        const ins = await client.query<{ id: number }>(
          `INSERT INTO listing_images (listing_id, url, thumb_url, width, height, sort_order, media_type, duration_seconds, poster_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [listingId, img.url, img.thumbUrl, img.width, img.height, count.rows[0].next, mediaType, img.durationSeconds ?? null, img.posterUrl ?? null],
        );
        await client.query(`UPDATE adventure_listings SET updated_at = now() WHERE id = $1`, [listingId]);
        return {
          id: ins.rows[0].id, url: img.url, thumbUrl: img.thumbUrl, width: img.width, height: img.height, sortOrder: count.rows[0].next,
          mediaType, durationSeconds: img.durationSeconds ?? null, posterUrl: img.posterUrl ?? null,
        };
      });
    },

    /** Returns the removed URLs so the caller can delete the stored objects. */
    async removeImage(listingId: number, imageId: number): Promise<{ url: string; thumbUrl: string | null }> {
      return withTx(async (client) => {
        const owned = await assertOwned(client, listingId, true);
        const imgs = await client.query<{ id: number; url: string; thumb_url: string | null }>(
          `SELECT id, url, thumb_url FROM listing_images WHERE listing_id = $1`, [listingId]);
        const target = imgs.rows.find((i) => i.id === imageId);
        if (!target) throw new HttpError(404, "Photo not found.");
        if (owned.status === "published" && imgs.rowCount === 1) throw new HttpError(409, "A live listing needs at least one photo. Add another first.");
        await client.query(`DELETE FROM listing_images WHERE id = $1 AND listing_id = $2`, [imageId, listingId]);
        return { url: target.url, thumbUrl: target.thumb_url };
      });
    },

    async reorderImages(listingId: number, orderedIds: number[]): Promise<void> {
      await withTx(async (client) => {
        await assertOwned(client, listingId, true);
        for (let i = 0; i < orderedIds.length; i++) {
          await client.query(`UPDATE listing_images SET sort_order = $3 WHERE id = $1 AND listing_id = $2`, [orderedIds[i], listingId, i]);
        }
      });
    },
  };
}
