import type { PoolClient } from "pg";
import { withTx } from "../db";
import { HttpError } from "../api";
import { getAvailability } from "./availability";
import { HOLD_MINUTES } from "./time";

export type Actor = { type: "customer" | "operator" | "admin" | "system"; id?: number };

export type BookingStatus =
  | "pending_payment" | "payment_submitted" | "confirmed" | "picked_up" | "completed" | "no_show" | "cancelled" | "expired" | "needs_reschedule";

type Scope = { companyId?: number; token?: string; id?: number };

type Locked = {
  id: number; company_id: number; listing_id: number; status: BookingStatus; start_date: string; slot_time: string | null; quantity: number;
  payment_submitted_at: string | null; payment_attempts: number; hold_expires_at: string | null; source: string;
};

/**
 * Load + lock the booking row (scoped to its owner), or 404. Every operator
 * path passes `companyId` (from the session); customers use their token.
 */
async function lockBooking(client: PoolClient, scope: Scope): Promise<Locked> {
  const res = await client.query<Locked>(
    `SELECT id, company_id, listing_id, status, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(slot_time, 'HH24:MI') AS slot_time,
            quantity, payment_submitted_at, payment_attempts, hold_expires_at, source
       FROM listing_bookings
      WHERE ($1::bigint IS NULL OR id = $1) AND ($2::text IS NULL OR token = $2) AND ($3::int IS NULL OR company_id = $3)
        AND ($1::bigint IS NOT NULL OR $2::text IS NOT NULL)
      FOR UPDATE`,
    [scope.id ?? null, scope.token ?? null, scope.companyId ?? null],
  );
  if (!res.rows[0]) throw new HttpError(404, "Booking not found.");
  return res.rows[0];
}

/** Take the per-listing mutex — same lock createBooking uses — for transitions that can claim capacity. */
async function lockListingRow(client: PoolClient, listingId: number) {
  await client.query(`SELECT 1 FROM adventure_listings WHERE id = $1 FOR NO KEY UPDATE`, [listingId]);
}

async function logEvent(client: PoolClient, bookingId: number, actor: Actor, from: string | null, to: string | null, note?: string | null, meta?: unknown) {
  await client.query(
    `INSERT INTO booking_events (booking_id, actor_type, actor_id, from_status, to_status, note, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [bookingId, actor.type, actor.id ?? null, from, to, note ?? null, meta === undefined ? null : JSON.stringify(meta)],
  );
}

const stale = () => new HttpError(409, "This booking has just changed. Refresh to see its latest status.");

/** Guarded status change. Zero rows updated ⇒ someone else got there first (double-tap safe). */
async function setStatus(
  client: PoolClient, b: Locked, allowedFrom: BookingStatus[], to: BookingStatus, setSql: string, params: unknown[], actor: Actor, note?: string,
) {
  if (!allowedFrom.includes(b.status)) throw stale();
  const res = await client.query(
    `UPDATE listing_bookings SET status = $1, updated_at = now()${setSql ? `, ${setSql}` : ""} WHERE id = $2 AND status = ANY($3::text[])`,
    [to, b.id, allowedFrom, ...params],
  );
  if (!res.rowCount) throw stale();
  await logEvent(client, b.id, actor, b.status, to, note);
}

// ---------------------------------------------------------------------------
// Customer: "I've paid" — attach the UPI reference.
// ---------------------------------------------------------------------------
export async function submitPayment(token: string, utr: string, payerName: string | undefined): Promise<{ status: BookingStatus }> {
  return withTx(async (client) => {
    const b = await lockBooking(client, { token });
    const actor: Actor = { type: "customer" };

    if (b.status === "payment_submitted") throw new HttpError(409, "We already have your payment reference. The operator will confirm it shortly.");
    if (b.status !== "pending_payment" && b.status !== "expired") throw new HttpError(409, "This booking isn't waiting for payment.");

    let to: BookingStatus = "payment_submitted";
    let note = "Customer submitted a UPI reference";
    if (b.status === "expired") {
      // The hold lapsed but the customer says they paid. Never auto-reject a possible real payment:
      // revive it if the units are still free, otherwise flag it for the operator to sort out.
      await lockListingRow(client, b.listing_id);
      const row = (await getAvailability(client, b.listing_id, b.start_date, b.start_date, b.slot_time))[0];
      if (row && row.available >= b.quantity) note = "Paid after the hold expired — units were still free";
      else { to = "needs_reschedule"; note = "Paid after the hold expired and those units were taken — needs rescheduling or a refund"; }
    }

    try {
      await setStatus(client, b, ["pending_payment", "expired"], to,
        `payment_ref = $4, payer_name = $5, payment_submitted_at = now(), hold_expires_at = NULL`, [utr, payerName ?? null], actor, note);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw new HttpError(409, "That reference number was already used on another booking. Please check it.");
      throw err;
    }
    return { status: to };
  });
}

export type OperatorOp =
  | { action: "confirm_payment" }
  | { action: "reject_payment" }
  | { action: "cancel"; reason?: string; noRefund?: boolean }
  | { action: "pickup"; vehicleReg?: string; depositCollected?: boolean }
  | { action: "return"; depositReturned?: boolean }
  | { action: "complete" }
  | { action: "no_show" }
  | { action: "move"; date: string; slotTime?: string | null }
  | { action: "refund_done" }
  | { action: "note"; note: string };

/** Everything an operator (or admin, with no company scope) can do to a booking. */
export async function operatorTransition(scope: { id: number; companyId?: number }, op: OperatorOp, actor: Actor): Promise<{ status: BookingStatus }> {
  return withTx(async (client) => {
    const b = await lockBooking(client, scope);
    switch (op.action) {
      case "confirm_payment":
        await setStatus(client, b, ["payment_submitted"], "confirmed", `payment_verified_at = now(), payment_verified_by = $4`, [actor.type === "operator" ? actor.id ?? null : null], actor, "Payment confirmed");
        return { status: "confirmed" };

      case "reject_payment": {
        // Back to "awaiting payment" with a fresh timer so the customer can correct the reference.
        // The second failed attempt cancels instead of looping forever.
        if (b.payment_attempts + 1 >= 2) {
          await setStatus(client, b, ["payment_submitted"], "cancelled",
            `cancelled_by = $4, cancel_reason = 'Payment not received', payment_attempts = payment_attempts + 1, hold_expires_at = NULL`, [actor.type], actor, "Payment not received (second attempt) — cancelled");
          return { status: "cancelled" };
        }
        await setStatus(client, b, ["payment_submitted"], "pending_payment",
          `payment_ref = NULL, payment_submitted_at = NULL, payment_attempts = payment_attempts + 1, hold_expires_at = now() + make_interval(mins => $4)`,
          [HOLD_MINUTES], actor, "Operator couldn't see the payment — asked customer to re-check");
        return { status: "pending_payment" };
      }

      case "cancel": {
        const paid = b.payment_submitted_at !== null && !op.noRefund;
        await setStatus(client, b, ["pending_payment", "payment_submitted", "confirmed", "needs_reschedule"], "cancelled",
          `cancelled_by = $4, cancel_reason = $5, hold_expires_at = NULL, refund_status = $6`,
          [actor.type, op.reason ?? null, paid ? "due" : "none"], actor, op.reason ?? "Cancelled");
        return { status: "cancelled" };
      }

      case "pickup":
        await setStatus(client, b, ["confirmed"], "picked_up",
          `picked_up_at = now(), assigned_vehicle_reg = $4, deposit_collected_at = CASE WHEN $5 THEN now() END`,
          [op.vehicleReg ?? null, Boolean(op.depositCollected)], actor, "Vehicle handed over");
        return { status: "picked_up" };

      case "return":
        await setStatus(client, b, ["picked_up"], "completed",
          `returned_at = now(), deposit_returned_at = CASE WHEN $4 THEN now() END`, [Boolean(op.depositReturned)], actor, "Vehicle returned");
        return { status: "completed" };

      case "complete":
        await setStatus(client, b, ["confirmed"], "completed", "", [], actor, "Marked completed");
        return { status: "completed" };

      case "no_show":
        await setStatus(client, b, ["confirmed"], "no_show", "", [], actor, "Customer didn't show up");
        return { status: "no_show" };

      case "move": {
        if (!["payment_submitted", "confirmed", "needs_reschedule"].includes(b.status)) throw stale();
        await lockListingRow(client, b.listing_id);
        const slot = op.slotTime ?? null;
        if (op.date === b.start_date && (slot ?? null) === (b.slot_time ?? null)) throw new HttpError(422, "That's the same date and time it's already on.");
        const row = (await getAvailability(client, b.listing_id, op.date, op.date, slot))[0];
        if (!row) throw new HttpError(409, "That date or time isn't offered.");
        // This booking only holds capacity on its old date, so the new date's `held` never includes it.
        if (row.available < b.quantity) throw new HttpError(409, `Only ${row.available} left on that date.`, { remaining: row.available });
        const to: BookingStatus = b.status === "needs_reschedule" ? "confirmed" : b.status;
        await client.query(`UPDATE listing_bookings SET start_date = $2, end_date = $2, slot_time = $3::time, status = $4, updated_at = now() WHERE id = $1`, [b.id, op.date, slot, to]);
        await logEvent(client, b.id, actor, b.status, to, `Moved to ${op.date}${slot ? ` ${slot}` : ""}`);
        return { status: to };
      }

      case "refund_done": {
        const res = await client.query(`UPDATE listing_bookings SET refund_status = 'done', updated_at = now() WHERE id = $1 AND refund_status = 'due'`, [b.id]);
        if (!res.rowCount) throw new HttpError(409, "No refund is pending on this booking.");
        await logEvent(client, b.id, actor, b.status, b.status, "Refund marked as done");
        return { status: b.status };
      }

      case "note":
        await client.query(`UPDATE listing_bookings SET ops_note = $2, updated_at = now() WHERE id = $1`, [b.id, op.note || null]);
        return { status: b.status };
    }
  });
}

/** Customer cancels their own booking — only while it's still an unpaid hold. */
export async function customerCancel(token: string, reason?: string): Promise<{ status: BookingStatus }> {
  return withTx(async (client) => {
    const b = await lockBooking(client, { token });
    await setStatus(client, b, ["pending_payment"], "cancelled", `cancelled_by = 'customer', cancel_reason = $4, hold_expires_at = NULL`, [reason ?? null], { type: "customer" }, reason ?? "Cancelled by customer");
    return { status: "cancelled" };
  });
}

/**
 * Cosmetic label sync: mark lapsed unpaid holds as `expired`. Availability
 * already ignores them, so this only affects what people see — call it freely.
 */
export async function expireLapsedHolds(client: Pick<PoolClient, "query">, scope: { companyId?: number; listingId?: number } = {}): Promise<number> {
  const res = await client.query(
    `WITH gone AS (
       UPDATE listing_bookings SET status = 'expired', updated_at = now()
        WHERE status = 'pending_payment' AND hold_expires_at < now()
          AND ($1::int IS NULL OR company_id = $1) AND ($2::int IS NULL OR listing_id = $2)
        RETURNING id)
     INSERT INTO booking_events (booking_id, actor_type, from_status, to_status, note)
     SELECT id, 'system', 'pending_payment', 'expired', 'Payment window ended' FROM gone`,
    [scope.companyId ?? null, scope.listingId ?? null],
  );
  return res.rowCount ?? 0;
}
