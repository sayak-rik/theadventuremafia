import { query } from "./db";

export type CategoryOption = { slug: string; name: string; bookingModel: "rental_day" | "session" | "departure" | "route_trip" | "enquiry"; icon: string | null };
export type RegionOption = { slug: string; name: string };

// Fallbacks keep the sign-up form usable when the database is unreachable
// (e.g. during `next build`).
const FALLBACK_CATEGORIES: CategoryOption[] = [
  { slug: "bike-rental", name: "Bike Rentals", bookingModel: "rental_day", icon: "bike" },
  { slug: "scooty-rental", name: "Scooty Rentals", bookingModel: "rental_day", icon: "scooter" },
  { slug: "rafting", name: "River Rafting", bookingModel: "session", icon: "waves" },
  { slug: "paragliding", name: "Paragliding", bookingModel: "session", icon: "wind" },
];
const FALLBACK_REGIONS: RegionOption[] = [{ slug: "pelling", name: "Pelling" }];

/** Categories operators can currently list (bookable models only). */
export async function getLaunchCategories(): Promise<CategoryOption[]> {
  const rows = await query<{ slug: string; name: string; booking_model: CategoryOption["bookingModel"]; icon: string | null }>(
    `SELECT slug, name, booking_model, icon FROM adventure_categories
      WHERE is_active AND booking_model <> 'enquiry' ORDER BY sort_order`,
  );
  return rows && rows.length ? rows.map((r) => ({ slug: r.slug, name: r.name, bookingModel: r.booking_model, icon: r.icon })) : FALLBACK_CATEGORIES;
}

export async function getRegions(): Promise<RegionOption[]> {
  const rows = await query<{ slug: string; name: string }>(`SELECT slug, name FROM regions ORDER BY (slug = 'pelling') DESC, sort_order`);
  return rows && rows.length ? rows : FALLBACK_REGIONS;
}

export type RouteCatalogOption = {
  id: number; originSlug: string; originName: string; destinationSlug: string; destinationName: string;
  distanceKm: number | null; durationMinutes: number | null;
};

/** Admin-curated standardized routes a driver can pick instead of setting a custom origin/destination. */
export async function getRouteCatalog(): Promise<RouteCatalogOption[]> {
  const rows = await query<{
    id: number; origin_slug: string; origin_name: string; destination_slug: string; destination_name: string;
    distance_km: string | null; duration_minutes: number | null;
  }>(
    `SELECT vc.id, o.slug AS origin_slug, o.name AS origin_name, d.slug AS destination_slug, d.name AS destination_name,
            vc.distance_km, vc.duration_minutes
       FROM vehicle_route_catalog vc JOIN regions o ON o.id = vc.origin_region_id JOIN regions d ON d.id = vc.destination_region_id
      WHERE vc.is_active ORDER BY vc.sort_order, o.name`,
  );
  return (rows ?? []).map((r) => ({
    id: r.id, originSlug: r.origin_slug, originName: r.origin_name, destinationSlug: r.destination_slug, destinationName: r.destination_name,
    distanceKm: r.distance_km === null ? null : Number(r.distance_km), durationMinutes: r.duration_minutes,
  }));
}
