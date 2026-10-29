import { requirePool, withTx } from "../db";
import { HttpError } from "../api";
import { diffDaysISO, todayIST } from "../dates";
import { getAvailability, HOLDING_SQL } from "./availability";
import type { BlackoutInput } from "../validation/booking";

export type BlackoutRow = { id: number; dateFrom: string; dateTo: string; slotTime: string | null; unitsBlocked: number | null; reason: string | null };

export async function listBlackouts(companyId: number, listingId: number): Promise<BlackoutRow[]> {
  const res = await requirePool().query(
    `SELECT x.id, to_char(x.date_from, 'YYYY-MM-DD') AS date_from, to_char(x.date_to, 'YYYY-MM-DD') AS date_to,
            to_char(x.slot_time, 'HH24:MI') AS slot_time, x.units_blocked, x.reason
       FROM listing_blackouts x JOIN adventure_listings l ON l.id = x.listing_id
      WHERE x.listing_id = $1 AND l.company_id = $2 AND x.date_to >= CURRENT_DATE - 1
      ORDER BY x.date_from, x.slot_time NULLS FIRST`,
    [listingId, companyId],
  );
  return res.rows.map((r) => ({ id: r.id, dateFrom: r.date_from, dateTo: r.date_to, slotTime: r.slot_time, unitsBlocked: r.units_blocked, reason: r.reason }));
}

export type BlackoutResult = { id: number; flagged: number; releasedHolds: number; flaggedIds: number[]; releasedIds: number[] };

/**
 * Close dates (or slots / some units) — maintenance, weather, off-season.
 *  - A full closure moves bookings that already hold capacity to `needs_reschedule`
 *    (the operator then moves or refunds them) and releases unpaid holds.
 *  - A partial block is refused if existing bookings wouldn't fit in what's left,
 *    so we never silently oversell.
 */
export async function addBlackout(companyId: number, listingId: number, input: BlackoutInput, actorId: number): Promise<BlackoutResult> {
  const today = todayIST();
  if (input.dateTo < input.dateFrom) throw new HttpError(422, "The end date can't be before the start date.");
  if (input.dateTo < today) throw new HttpError(422, "That period is already over.");
  if (diffDaysISO(input.dateFrom, input.dateTo) > 366) throw new HttpError(422, "Block up to a year at a time.");

  return withTx(async (client) => {
    const l = await client.query<{ booking_model: string }>(
      `SELECT ac.booking_model FROM adventure_listings l JOIN adventure_categories ac ON ac.id = l.category_id
        WHERE l.id = $1 AND l.company_id = $2 FOR NO KEY UPDATE OF l`,
      [listingId, companyId],
    );
    if (!l.rows[0]) throw new HttpError(404, "Listing not found.");
    const slot = input.slotTime ?? null;
    if (slot && l.rows[0].booking_model !== "session") throw new HttpError(422, "Only trips with time slots can block a single slot.");

    const ins = await client.query<{ id: number }>(
      `INSERT INTO listing_blackouts (listing_id, date_from, date_to, slot_time, units_blocked, reason, created_by)
       VALUES ($1,$2,$3,$4::time,$5,$6,$7) RETURNING id`,
      [listingId, input.dateFrom, input.dateTo, slot, input.unitsBlocked ?? null, input.reason ?? null, actorId],
    );
    const id = ins.rows[0].id;

    if (input.unitsBlocked) {
      // Partial: make sure what's booked still fits in what's left.
      const rows = await getAvailability(client, listingId, input.dateFrom, input.dateTo, slot);
      const over = rows.find((r) => r.held > r.capacity - r.blocked);
      if (over) {
        const left = Math.max(0, over.capacity - over.blocked);
        throw new HttpError(409, `${over.held} are already booked on ${over.date}${over.slotTime ? ` at ${over.slotTime}` : ""}, which wouldn't fit in the ${left} you'd have left. Move or cancel some bookings first.`);
      }
      return { id, flagged: 0, releasedHolds: 0, flaggedIds: [], releasedIds: [] };
    }

    // Full closure: flag paid/confirmed bookings, release unpaid holds.
    const flagged = await client.query<{ id: number; from_status: string }>(
      `WITH hit AS (
         SELECT b.id, b.status AS from_status FROM listing_bookings b
          WHERE b.listing_id = $1 AND b.end_date >= $2::date AND b.start_date <= $3::date
            AND ($4::time IS NULL OR b.slot_time = $4::time) AND b.status IN ('payment_submitted','confirmed') FOR UPDATE),
       upd AS (UPDATE listing_bookings b SET status = 'needs_reschedule', updated_at = now() FROM hit WHERE b.id = hit.id RETURNING b.id, hit.from_status)
       SELECT id, from_status FROM upd`,
      [listingId, input.dateFrom, input.dateTo, slot],
    );
    for (const f of flagged.rows) {
      await client.query(
        `INSERT INTO booking_events (booking_id, actor_type, actor_id, from_status, to_status, note) VALUES ($1,'operator',$2,$3,'needs_reschedule',$4)`,
        [f.id, actorId, f.from_status, `Closed${input.reason ? `: ${input.reason}` : ""}`],
      );
    }

    const released = await client.query<{ id: number }>(
      `UPDATE listing_bookings b SET status = 'cancelled', cancelled_by = 'system', cancel_reason = 'The operator closed those dates', hold_expires_at = NULL, updated_at = now()
        WHERE b.listing_id = $1 AND b.end_date >= $2::date AND b.start_date <= $3::date AND ($4::time IS NULL OR b.slot_time = $4::time)
          AND ${HOLDING_SQL} AND b.status = 'pending_payment'
        RETURNING b.id`,
      [listingId, input.dateFrom, input.dateTo, slot],
    );
    for (const r of released.rows) {
      await client.query(`INSERT INTO booking_events (booking_id, actor_type, from_status, to_status, note) VALUES ($1,'system','pending_payment','cancelled','Dates closed by the operator')`, [r.id]);
    }
    return { id, flagged: flagged.rows.length, releasedHolds: released.rows.length, flaggedIds: flagged.rows.map((f) => f.id), releasedIds: released.rows.map((r) => r.id) };
  });
}

export async function removeBlackout(companyId: number, listingId: number, blackoutId: number): Promise<void> {
  const res = await requirePool().query(
    `DELETE FROM listing_blackouts x USING adventure_listings l
      WHERE x.id = $1 AND x.listing_id = $2 AND l.id = x.listing_id AND l.company_id = $3`,
    [blackoutId, listingId, companyId],
  );
  if (!res.rowCount) throw new HttpError(404, "Closure not found.");
}
