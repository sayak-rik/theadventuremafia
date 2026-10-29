import type { Pool, PoolClient } from "pg";

export type Queryable = Pick<Pool | PoolClient, "query">;

/** Statuses that always hold capacity. `pending_payment` holds only while its timer runs. */
export const HOLDING_STATUSES = ["payment_submitted", "confirmed", "picked_up", "needs_reschedule"] as const;

// Reused SQL fragment: does booking alias `b` currently hold capacity?
// (`now()` is the transaction start time, which is what we want inside createBooking.)
export const HOLDING_SQL = `(b.status IN ('payment_submitted','confirmed','picked_up','needs_reschedule')
  OR (b.status = 'pending_payment' AND b.hold_expires_at > now()))`;

export type SlotAvailability = {
  date: string; // YYYY-MM-DD
  slotTime: string | null; // HH:MM for sessions, null for day rentals
  capacity: number;
  blocked: number;
  held: number;
  available: number;
};

/**
 * Availability is DERIVED from bookings and blackouts — there is no counter to
 * drift out of sync:
 *   available = capacity − blocked − held
 *   capacity  = units_total (rentals, cars) | slot template capacity (sessions, tours)
 *   held      = Σ quantity of bookings that currently hold capacity
 * An unpaid hold stops counting the instant its timer lapses, so no sweeper
 * is needed for correctness.
 *
 * `heldMode` controls how a booking's `start_date..end_date` span is matched
 * against a candidate day:
 *   'overlap'     — any day in the span holds capacity (rentals/sessions: a
 *                   multi-day rental or a session slot is contended per day).
 *   'exact_start' — only the booking's own start_date holds capacity (tours:
 *                   a 7-day cohort departing Monday must NOT consume a
 *                   different cohort's Thursday-departure capacity just
 *                   because the date ranges overlap).
 */
export async function getAvailability(
  q: Queryable,
  listingId: number,
  from: string,
  to: string,
  slotTime?: string | null,
  heldMode: "overlap" | "exact_start" = "overlap",
): Promise<SlotAvailability[]> {
  const res = await q.query<{
    day: string; slot_time: string | null; capacity: number; blocked: number; held: number;
  }>(
    `WITH days AS (
       SELECT d::date AS day FROM generate_series($2::date, $3::date, '1 day') AS d
     ),
     cand AS (
       SELECT d.day, NULL::time AS slot_time, rd.units_total AS capacity
         FROM days d JOIN listing_rental_details rd ON rd.listing_id = $1
       UNION ALL
       SELECT d.day, NULL::time AS slot_time, vd.units_total AS capacity
         FROM days d JOIN listing_vehicle_details vd ON vd.listing_id = $1
       UNION ALL
       SELECT d.day, t.slot_time, t.capacity
         FROM days d JOIN listing_slot_templates t
           ON t.listing_id = $1 AND t.is_active
          AND EXTRACT(DOW FROM d.day)::int = ANY (t.days_of_week)
          AND (t.valid_from IS NULL OR d.day >= t.valid_from)
          AND (t.valid_to   IS NULL OR d.day <= t.valid_to)
     )
     SELECT to_char(c.day, 'YYYY-MM-DD') AS day,
            to_char(c.slot_time, 'HH24:MI') AS slot_time,
            c.capacity,
            CASE WHEN EXISTS (
                   SELECT 1 FROM listing_blackouts x
                    WHERE x.listing_id = $1 AND c.day BETWEEN x.date_from AND x.date_to
                      AND (x.slot_time IS NULL OR x.slot_time IS NOT DISTINCT FROM c.slot_time)
                      AND x.units_blocked IS NULL)
                 THEN c.capacity
                 ELSE LEAST(c.capacity, COALESCE((
                   SELECT SUM(x.units_blocked) FROM listing_blackouts x
                    WHERE x.listing_id = $1 AND c.day BETWEEN x.date_from AND x.date_to
                      AND (x.slot_time IS NULL OR x.slot_time IS NOT DISTINCT FROM c.slot_time)), 0))
            END::int AS blocked,
            COALESCE((SELECT SUM(b.quantity) FROM listing_bookings b
                       WHERE b.listing_id = $1
                         AND (CASE WHEN $5 = 'exact_start' THEN c.day = b.start_date ELSE c.day BETWEEN b.start_date AND b.end_date END)
                         AND b.slot_time IS NOT DISTINCT FROM c.slot_time
                         AND ${HOLDING_SQL}), 0)::int AS held
       FROM cand c
      WHERE ($4::time IS NULL OR c.slot_time = $4::time)
      ORDER BY c.day, c.slot_time NULLS FIRST`,
    [listingId, from, to, slotTime ?? null, heldMode],
  );
  return res.rows.map((r) => ({
    date: r.day,
    slotTime: r.slot_time,
    capacity: r.capacity,
    blocked: r.blocked,
    held: r.held,
    available: Math.max(0, r.capacity - r.blocked - r.held),
  }));
}

/** Highest number of units/persons already held on any future date (for capacity edits). */
export async function peakFutureHeld(q: Queryable, listingId: number, today: string, slotTime?: string | null): Promise<number> {
  const res = await q.query<{ peak: number }>(
    `SELECT COALESCE(MAX(s), 0)::int AS peak FROM (
       SELECT SUM(b.quantity) AS s
         FROM listing_bookings b
         CROSS JOIN LATERAL generate_series(GREATEST(b.start_date, $2::date), b.end_date, '1 day') AS d(day)
        WHERE b.listing_id = $1 AND b.end_date >= $2::date AND ${HOLDING_SQL}
          AND ($3::time IS NULL OR b.slot_time = $3::time)
        GROUP BY d.day) x`,
    [listingId, today, slotTime ?? null],
  );
  return res.rows[0].peak;
}

/** Does any future holding booking use this slot time? (blocks deleting a slot) */
export async function slotHasFutureBookings(q: Queryable, listingId: number, today: string, slotTime: string): Promise<boolean> {
  const res = await q.query(
    `SELECT 1 FROM listing_bookings b
      WHERE b.listing_id = $1 AND b.slot_time = $3::time AND b.end_date >= $2::date AND ${HOLDING_SQL} LIMIT 1`,
    [listingId, today, slotTime],
  );
  return (res.rowCount ?? 0) > 0;
}
