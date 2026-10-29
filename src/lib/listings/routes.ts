import { requirePool } from "../db";
import { HttpError } from "../api";

export type RouteCatalogRow = {
  id: number; originSlug: string; originName: string; destinationSlug: string; destinationName: string;
  distanceKm: number | null; durationMinutes: number | null; isActive: boolean; sortOrder: number; listingCount: number;
};

/** Admin view of every standardized route, including inactive ones and how many listings use each. */
export async function listRouteCatalog(): Promise<RouteCatalogRow[]> {
  const res = await requirePool().query(
    `SELECT vc.id, o.slug AS origin_slug, o.name AS origin_name, d.slug AS destination_slug, d.name AS destination_name,
            vc.distance_km, vc.duration_minutes, vc.is_active, vc.sort_order,
            (SELECT count(*) FROM listing_vehicle_details vd WHERE vd.route_catalog_id = vc.id)::int AS listing_count
       FROM vehicle_route_catalog vc JOIN regions o ON o.id = vc.origin_region_id JOIN regions d ON d.id = vc.destination_region_id
      ORDER BY vc.sort_order, o.name`,
  );
  return res.rows.map((r) => ({
    id: r.id, originSlug: r.origin_slug, originName: r.origin_name, destinationSlug: r.destination_slug, destinationName: r.destination_name,
    distanceKm: r.distance_km === null ? null : Number(r.distance_km), durationMinutes: r.duration_minutes,
    isActive: r.is_active, sortOrder: r.sort_order, listingCount: r.listing_count,
  }));
}

export async function createRoute(input: { originSlug: string; destinationSlug: string; distanceKm: number | null; durationMinutes: number | null }): Promise<{ id: number }> {
  const origin = await requirePool().query<{ id: number }>(`SELECT id FROM regions WHERE slug = $1`, [input.originSlug]);
  const dest = await requirePool().query<{ id: number }>(`SELECT id FROM regions WHERE slug = $1`, [input.destinationSlug]);
  if (!origin.rows[0] || !dest.rows[0]) throw new HttpError(422, "Unknown region.");
  if (origin.rows[0].id === dest.rows[0].id) throw new HttpError(422, "Origin and destination must differ.");
  const res = await requirePool().query<{ id: number }>(
    `INSERT INTO vehicle_route_catalog (origin_region_id, destination_region_id, distance_km, duration_minutes)
     VALUES ($1,$2,$3,$4) ON CONFLICT (origin_region_id, destination_region_id) DO UPDATE SET is_active = TRUE RETURNING id`,
    [origin.rows[0].id, dest.rows[0].id, input.distanceKm, input.durationMinutes],
  );
  return { id: res.rows[0].id };
}

export async function setRouteActive(id: number, isActive: boolean): Promise<void> {
  const res = await requirePool().query(`UPDATE vehicle_route_catalog SET is_active = $2 WHERE id = $1`, [id, isActive]);
  if (!res.rowCount) throw new HttpError(404, "Route not found.");
}

export async function updateRouteDetails(id: number, input: { distanceKm: number | null; durationMinutes: number | null }): Promise<void> {
  const res = await requirePool().query(
    `UPDATE vehicle_route_catalog SET distance_km = $2, duration_minutes = $3 WHERE id = $1`,
    [id, input.distanceKm, input.durationMinutes],
  );
  if (!res.rowCount) throw new HttpError(404, "Route not found.");
}
