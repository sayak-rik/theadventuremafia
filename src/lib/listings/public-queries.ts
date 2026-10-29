import { requirePool } from "../db";
import { addDaysISO, todayIST } from "../dates";
import { getPublicAvailability } from "../booking/public";

// Uncached read queries for the public site. Pages use the cached wrappers in
// ./public.ts; these exist separately so they're easy to test and to call from
// places that must be fresh. Every query requires listing `published` AND the
// company `approved`.

const LIVE = `l.status = 'published' AND c.status = 'approved'`;

export type BookingModel = "rental_day" | "session" | "departure" | "route_trip";

export type ListingCardData = {
  id: number; slug: string; title: string; companySlug: string; companyName: string; companyVerified: boolean;
  categorySlug: string; categoryName: string; bookingModel: BookingModel; regionSlug: string; regionName: string;
  unitPrice: number; advanceType: "percent" | "flat"; advanceValue: number; isFeatured: boolean;
  cover: string | null; coverFull: string | null; coverWidth: number | null; coverHeight: number | null;
  makeModel: string | null; engineCc: number | null; transmission: string | null; fuelType: string | null; unitsTotal: number | null;
  helmets: number | null; securityDeposit: number | null;
  durationHours: number | null; difficulty: string | null; rapidsGrade: number | null; flightMinutes: number | null; slotTimes: string[];
  durationDays: number | null; durationNights: number | null;
  vehicleType: string | null; seats: number | null; originRegionName: string | null; destinationRegionName: string | null;
};

const CARD_SELECT = `
  SELECT l.id, l.slug, l.title, c.slug AS company_slug, c.name AS company_name, c.is_verified, ac.slug AS category_slug, ac.name AS category_name,
         ac.booking_model, r.slug AS region_slug, r.name AS region_name, l.unit_price, l.advance_type, l.advance_value,
         l.is_featured, l.featured_until,
         img.thumb_url AS cover, img.url AS cover_full, img.width AS cover_width, img.height AS cover_height,
         rd.make_model, rd.engine_cc, rd.transmission, rd.fuel_type, rd.units_total, rd.helmets_included, rd.security_deposit,
         l.duration_hours, l.difficulty, sd.rapids_grade, sd.flight_minutes,
         l.duration_days, l.duration_nights,
         vd.vehicle_type, vd.seats, origin_r.name AS origin_region_name, dest_r.name AS destination_region_name,
         ARRAY(SELECT to_char(t.slot_time, 'HH24:MI') FROM listing_slot_templates t WHERE t.listing_id = l.id AND t.is_active ORDER BY t.slot_time) AS slot_times
    FROM adventure_listings l
    JOIN companies c ON c.id = l.company_id
    JOIN adventure_categories ac ON ac.id = l.category_id
    JOIN regions r ON r.id = l.region_id
    LEFT JOIN listing_rental_details rd ON rd.listing_id = l.id
    LEFT JOIN listing_session_details sd ON sd.listing_id = l.id
    LEFT JOIN listing_vehicle_details vd ON vd.listing_id = l.id
    LEFT JOIN regions origin_r ON origin_r.id = vd.origin_region_id
    LEFT JOIN regions dest_r ON dest_r.id = vd.destination_region_id
    LEFT JOIN LATERAL (SELECT thumb_url, url, width, height FROM listing_images i WHERE i.listing_id = l.id AND i.media_type = 'photo' ORDER BY i.sort_order, i.id LIMIT 1) img ON TRUE`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isCurrentlyFeatured = (r: Record<string, any>): boolean =>
  Boolean(r.is_featured) && (!r.featured_until || new Date(r.featured_until) >= new Date(todayIST()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCard = (r: Record<string, any>): ListingCardData => ({
  id: r.id, slug: r.slug, title: r.title, companySlug: r.company_slug, companyName: r.company_name, companyVerified: r.is_verified,
  categorySlug: r.category_slug, categoryName: r.category_name, bookingModel: r.booking_model, regionSlug: r.region_slug, regionName: r.region_name,
  unitPrice: r.unit_price ?? 0, advanceType: r.advance_type, advanceValue: r.advance_value, isFeatured: isCurrentlyFeatured(r),
  cover: r.cover, coverFull: r.cover_full, coverWidth: r.cover_width, coverHeight: r.cover_height,
  makeModel: r.make_model, engineCc: r.engine_cc, transmission: r.transmission, fuelType: r.fuel_type, unitsTotal: r.units_total,
  helmets: r.helmets_included, securityDeposit: r.security_deposit, durationHours: r.duration_hours, difficulty: r.difficulty,
  rapidsGrade: r.rapids_grade, flightMinutes: r.flight_minutes, slotTimes: r.slot_times ?? [],
  durationDays: r.duration_days, durationNights: r.duration_nights,
  vehicleType: r.vehicle_type, seats: r.seats, originRegionName: r.origin_region_name, destinationRegionName: r.destination_region_name,
});

export async function queryPublished(
  opts: { categorySlug?: string; regionSlug?: string; limit?: number; originSlug?: string; destinationSlug?: string } = {},
): Promise<ListingCardData[]> {
  const res = await requirePool().query(
    `${CARD_SELECT}
      WHERE ${LIVE} AND ($1::text IS NULL OR ac.slug = $1)
        AND ($2::text IS NULL OR r.slug = $2 OR EXISTS (
              SELECT 1 FROM listing_pickup_regions pr JOIN regions pr2 ON pr2.id = pr.region_id WHERE pr.listing_id = l.id AND pr2.slug = $2))
        AND ($4::text IS NULL OR origin_r.slug = $4)
        AND ($5::text IS NULL OR dest_r.slug = $5)
      ORDER BY (l.is_featured AND (l.featured_until IS NULL OR l.featured_until >= current_date)) DESC,
               c.is_verified DESC, l.published_at DESC NULLS LAST, l.id
      LIMIT $3`,
    [opts.categorySlug ?? null, opts.regionSlug ?? null, opts.limit ?? 60, opts.originSlug ?? null, opts.destinationSlug ?? null],
  );
  return res.rows.map(toCard);
}

/** A handful of currently-featured listings across categories, for the homepage rail. Paid placement — see migration 007. */
export async function queryFeatured(limit = 6): Promise<ListingCardData[]> {
  const res = await requirePool().query(
    `${CARD_SELECT}
      WHERE ${LIVE} AND l.is_featured AND (l.featured_until IS NULL OR l.featured_until >= current_date)
      ORDER BY l.published_at DESC NULLS LAST, l.id
      LIMIT $1`,
    [limit],
  );
  return res.rows.map(toCard);
}

export type CategorySummary = { slug: string; name: string; bookingModel: BookingModel; icon: string | null; listings: number; fromPrice: number | null };

export async function queryCategories(): Promise<CategorySummary[]> {
  const res = await requirePool().query(
    `SELECT ac.slug, ac.name, ac.booking_model, ac.icon,
            count(l.id)::int AS listings, min(l.unit_price) AS from_price
       FROM adventure_categories ac
       LEFT JOIN adventure_listings l ON l.category_id = ac.id AND l.status = 'published'
            AND EXISTS (SELECT 1 FROM companies c WHERE c.id = l.company_id AND c.status = 'approved')
      WHERE ac.is_active AND ac.booking_model <> 'enquiry'
      GROUP BY ac.id ORDER BY ac.sort_order`,
  );
  return res.rows.map((r) => ({ slug: r.slug, name: r.name, bookingModel: r.booking_model as BookingModel, icon: r.icon, listings: r.listings, fromPrice: r.from_price }));
}

export type RegionSummary = { slug: string; name: string; state: string | null };
export async function queryRegionBySlug(slug: string): Promise<RegionSummary | null> {
  const r = await requirePool().query(`SELECT slug, name, state FROM regions WHERE slug = $1`, [slug]);
  return r.rows[0] ?? null;
}

export type CompanyPublic = {
  id: number; slug: string; name: string; description: string | null; verified: boolean; phone: string; whatsapp: string | null;
  address: string | null; mapsUrl: string | null; websiteUrl: string | null; instagramUrl: string | null;
  companyType: string; logoUrl: string | null; coverImageUrl: string | null;
};

export type ListingDetailData = ListingCardData & {
  description: string; inclusions: string[]; exclusions: string[]; cancellationPolicy: string | null; safetyNotes: string | null;
  meetingPoint: string | null; minNoticeHours: number; minAge: number | null; groupMin: number | null; groupMax: number | null;
  season: string | null; weatherDependent: boolean;
  rental: { kmLimitPerDay: number | null; fuelPolicy: string | null; docsRequired: string[]; pickupTime: string | null; returnByTime: string | null; lateFeePerHour: number | null; areaRestrictions: string | null } | null;
  session: { minWeightKg: number | null; maxWeightKg: number | null; maxAge: number | null; swimRequired: boolean; certification: string | null; equipmentNotes: string | null; waiverRequired: boolean; stretchName: string | null; distanceKm: number | null; takeoffAltitudeM: number | null } | null;
  tour: { tripType: string; endRegionName: string | null; itinerary: { day: number; title: string; description?: string }[]; highlights: string[]; accommodationType: string | null; mealPlan: string | null; transportIncluded: boolean; maxAltitudeM: number | null; docsRequired: string[] } | null;
  vehicle: { ac: boolean; luggageNote: string | null; oneWay: boolean; pickupTime: string | null; originRegionSlug: string | null; destinationRegionSlug: string | null } | null;
  images: { url: string; thumbUrl: string | null; width: number | null; height: number | null; mediaType: "photo" | "video"; posterUrl: string | null }[];
  company: CompanyPublic;
  moreFromCompany: ListingCardData[];
};

export async function queryListingDetail(companySlug: string, listingSlug: string): Promise<ListingDetailData | null> {
  const pool = requirePool();
  const res = await pool.query(
    `${CARD_SELECT.replace("l.duration_hours,", `l.description, l.inclusions, l.exclusions, l.cancellation_policy, l.safety_notes, l.meeting_point, l.min_notice_hours, l.min_age, l.group_min, l.group_max, l.season, l.weather_dependent,
         c.id AS company_id, c.description AS company_description, c.contact_phone, c.whatsapp_number, c.address, c.maps_url, c.website_url, c.instagram_url,
         c.company_type, c.logo_url, c.cover_image_url,
         rd.km_limit_per_day, rd.fuel_policy, rd.docs_required, to_char(rd.pickup_time, 'HH24:MI') AS pickup_time, to_char(rd.return_by_time, 'HH24:MI') AS return_by_time, rd.late_fee_per_hour, rd.area_restrictions,
         sd.min_weight_kg, sd.max_weight_kg, sd.max_age, sd.swim_required, sd.certification, sd.equipment_notes, sd.waiver_required, sd.stretch_name, sd.distance_km, sd.takeoff_altitude_m,
         td.trip_type, end_r.name AS end_region_name, td.itinerary, td.highlights, td.accommodation_type, td.meal_plan, td.transport_included, td.max_altitude_m, td.docs_required AS tour_docs_required,
         vd.ac AS vehicle_ac, vd.luggage_note, vd.one_way, to_char(vd.pickup_time, 'HH24:MI') AS vehicle_pickup_time, origin_r.slug AS origin_region_slug, dest_r.slug AS destination_region_slug,
         l.duration_hours,`)}
         LEFT JOIN listing_tour_details td ON td.listing_id = l.id
         LEFT JOIN regions end_r ON end_r.id = td.end_region_id
      WHERE ${LIVE} AND c.slug = $1 AND l.slug = $2`,
    [companySlug, listingSlug],
  );
  const r = res.rows[0];
  if (!r) return null;
  const [imgs, more] = await Promise.all([
    pool.query(`SELECT url, thumb_url, width, height, media_type, poster_url FROM listing_images WHERE listing_id = $1 ORDER BY sort_order, id`, [r.id]),
    pool.query(`${CARD_SELECT} WHERE ${LIVE} AND c.id = $1 AND l.id <> $2 ORDER BY l.published_at DESC NULLS LAST LIMIT 4`, [r.company_id, r.id]),
  ]);
  return {
    ...toCard(r),
    description: r.description ?? "", inclusions: r.inclusions ?? [], exclusions: r.exclusions ?? [], cancellationPolicy: r.cancellation_policy,
    safetyNotes: r.safety_notes, meetingPoint: r.meeting_point, minNoticeHours: r.min_notice_hours, minAge: r.min_age, groupMin: r.group_min,
    groupMax: r.group_max, season: r.season, weatherDependent: r.weather_dependent,
    rental: r.booking_model === "rental_day" ? {
      kmLimitPerDay: r.km_limit_per_day, fuelPolicy: r.fuel_policy, docsRequired: r.docs_required ?? [], pickupTime: r.pickup_time,
      returnByTime: r.return_by_time, lateFeePerHour: r.late_fee_per_hour, areaRestrictions: r.area_restrictions } : null,
    session: r.booking_model === "session" ? {
      minWeightKg: r.min_weight_kg, maxWeightKg: r.max_weight_kg, maxAge: r.max_age, swimRequired: r.swim_required ?? false,
      certification: r.certification, equipmentNotes: r.equipment_notes, waiverRequired: r.waiver_required ?? true, stretchName: r.stretch_name,
      distanceKm: r.distance_km === null ? null : Number(r.distance_km), takeoffAltitudeM: r.takeoff_altitude_m } : null,
    tour: r.booking_model === "departure" ? {
      tripType: r.trip_type ?? "circuit", endRegionName: r.end_region_name, itinerary: r.itinerary ?? [], highlights: r.highlights ?? [],
      accommodationType: r.accommodation_type, mealPlan: r.meal_plan, transportIncluded: r.transport_included ?? true,
      maxAltitudeM: r.max_altitude_m, docsRequired: r.tour_docs_required ?? [] } : null,
    vehicle: r.booking_model === "route_trip" ? {
      ac: r.vehicle_ac ?? true, luggageNote: r.luggage_note, oneWay: r.one_way ?? true, pickupTime: r.vehicle_pickup_time,
      originRegionSlug: r.origin_region_slug, destinationRegionSlug: r.destination_region_slug } : null,
    images: imgs.rows.map((i) => ({ url: i.url, thumbUrl: i.thumb_url, width: i.width, height: i.height, mediaType: i.media_type, posterUrl: i.poster_url })),
    company: {
      id: r.company_id, slug: r.company_slug, name: r.company_name, description: r.company_description, verified: r.is_verified, phone: r.contact_phone,
      whatsapp: r.whatsapp_number, address: r.address, mapsUrl: r.maps_url, websiteUrl: r.website_url, instagramUrl: r.instagram_url,
      companyType: r.company_type, logoUrl: r.logo_url, coverImageUrl: r.cover_image_url,
    },
    moreFromCompany: more.rows.map(toCard),
  };
}

export async function queryCompanyPage(slug: string): Promise<{ company: CompanyPublic; listings: ListingCardData[] } | null> {
  const pool = requirePool();
  const c = await pool.query(
    `SELECT id, slug, name, description, is_verified, contact_phone, whatsapp_number, address, maps_url, website_url, instagram_url,
            company_type, logo_url, cover_image_url
       FROM companies WHERE slug = $1 AND status = 'approved'`,
    [slug],
  );
  const r = c.rows[0];
  if (!r) return null;
  const listings = await pool.query(`${CARD_SELECT} WHERE ${LIVE} AND c.id = $1 ORDER BY l.published_at DESC NULLS LAST, l.id`, [r.id]);
  return {
    company: { id: r.id, slug: r.slug, name: r.name, description: r.description, verified: r.is_verified, phone: r.contact_phone, whatsapp: r.whatsapp_number,
      address: r.address, mapsUrl: r.maps_url, websiteUrl: r.website_url, instagramUrl: r.instagram_url,
      companyType: r.company_type, logoUrl: r.logo_url, coverImageUrl: r.cover_image_url },
    listings: listings.rows.map(toCard),
  };
}

export type BoardRow = {
  categorySlug: string; categoryName: string; bookingModel: BookingModel; icon: string | null; listings: number; fromPrice: number | null;
  /** Units (rentals) or seats (sessions) free today. */
  freeToday: number;
  /** Next day (within a week) with anything free, when today is full. */
  next: { date: string; slotTime: string | null; free: number } | null;
};

/** The "today board": what's actually free right now, per category. */
export async function queryTodayBoard(): Promise<BoardRow[]> {
  const today = todayIST();
  const end = addDaysISO(today, 6);
  const cats = await queryCategories();
  const out: BoardRow[] = [];
  for (const c of cats) {
    const listings = c.listings ? await queryPublished({ categorySlug: c.slug, limit: 40 }) : [];
    let freeToday = 0;
    let next: BoardRow["next"] = null;
    for (const l of listings) {
      const days = await getPublicAvailability(l.id, today, end);
      for (const d of days) {
        for (const s of d.slots) {
          if (s.available <= 0) continue;
          if (d.date === today) freeToday += s.available;
          else if (!next || d.date < next.date || (d.date === next.date && (s.slotTime ?? "") < (next.slotTime ?? ""))) next = { date: d.date, slotTime: s.slotTime, free: s.available };
        }
      }
    }
    out.push({ categorySlug: c.slug, categoryName: c.name, bookingModel: c.bookingModel, icon: c.icon, listings: c.listings, fromPrice: c.fromPrice, freeToday, next: freeToday > 0 ? null : next });
  }
  return out;
}

export type SitemapEntry = { companySlug: string; listingSlug: string; categorySlug: string; regionSlug: string; updatedAt: Date };

/** Everything that is live on the public site, for the sitemap. Same visibility rule as every other public query. */
export async function querySitemapEntries(): Promise<SitemapEntry[]> {
  const res = await requirePool().query(
    `SELECT c.slug AS company_slug, l.slug AS listing_slug, ac.slug AS category_slug, r.slug AS region_slug, l.updated_at
       FROM adventure_listings l
       JOIN companies c ON c.id = l.company_id
       JOIN adventure_categories ac ON ac.id = l.category_id
       JOIN regions r ON r.id = l.region_id
      WHERE ${LIVE}
      ORDER BY l.id`,
  );
  return res.rows.map((r) => ({ companySlug: r.company_slug, listingSlug: r.listing_slug, categorySlug: r.category_slug, regionSlug: r.region_slug, updatedAt: r.updated_at }));
}
