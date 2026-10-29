import { requirePool } from "../db";
import { HttpError } from "../api";
import { addDaysISO, nowISTParts, todayIST } from "../dates";
import { getAvailability } from "./availability";
import { BOOKING_HORIZON_DAYS, timeToMinutes } from "./time";

export type PublicDay = { date: string; slots: { slotTime: string | null; available: number; capacity: number }[] };

/**
 * Availability as a customer should see it: only live listings, only bookable
 * dates, and same-day slots already inside the operator's notice window show as full.
 */
export async function getPublicAvailability(listingId: number, from: string, to: string): Promise<PublicDay[]> {
  const pool = requirePool();
  const meta = await pool.query<{ booking_model: string; min_notice_hours: number; pickup_time: string | null }>(
    `SELECT ac.booking_model, l.min_notice_hours, COALESCE(rd.pickup_time, vd.pickup_time)::text AS pickup_time
       FROM adventure_listings l JOIN companies c ON c.id = l.company_id JOIN adventure_categories ac ON ac.id = l.category_id
       LEFT JOIN listing_rental_details rd ON rd.listing_id = l.id
       LEFT JOIN listing_vehicle_details vd ON vd.listing_id = l.id
      WHERE l.id = $1 AND l.status = 'published' AND c.status = 'approved'`,
    [listingId],
  );
  const l = meta.rows[0];
  if (!l) throw new HttpError(404, "That isn't available to book.");

  const today = todayIST();
  const start = from < today ? today : from;
  const horizon = addDaysISO(today, BOOKING_HORIZON_DAYS);
  let end = to > horizon ? horizon : to;
  const cap = addDaysISO(start, 61);
  if (end > cap) end = cap;
  if (end < start) return [];

  const heldMode = l.booking_model === "departure" ? "exact_start" : "overlap";
  const rows = await getAvailability(pool, listingId, start, end, undefined, heldMode);
  const { minutes } = nowISTParts();
  const usesSlot = l.booking_model === "session" || l.booking_model === "departure";
  const byDate = new Map<string, PublicDay>();
  for (const r of rows) {
    let available = r.available;
    if (r.date === today) {
      const startMin = timeToMinutes(usesSlot ? (r.slotTime ?? "00:00") : (l.pickup_time ?? "08:00"));
      if (startMin - minutes < l.min_notice_hours * 60) available = 0;
    }
    const day = byDate.get(r.date) ?? { date: r.date, slots: [] };
    day.slots.push({ slotTime: r.slotTime, available, capacity: r.capacity });
    byDate.set(r.date, day);
  }
  return [...byDate.values()];
}
