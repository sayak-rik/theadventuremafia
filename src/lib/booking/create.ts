import type { PoolClient } from "pg";
import { withTx } from "../db";
import { HttpError } from "../api";
import { addDaysISO, diffDaysISO, nowISTParts, todayIST } from "../dates";
import { getAvailability } from "./availability";
import { advanceFor } from "./pricing";
import { newBookingCode, newBookingToken } from "./tokens";
import { BOOKING_HORIZON_DAYS, HOLD_MINUTES, timeToMinutes } from "./time";
import type { CreateBookingInput, WalkInInput } from "../validation/booking";

type ListingForBooking = {
  id: number; company_id: number; title: string; unit_price: number | null; advance_type: "percent" | "flat"; advance_value: number;
  min_notice_hours: number; cancellation_policy: string | null; min_age: number | null; group_min: number | null; group_max: number | null;
  booking_model: "rental_day" | "session" | "departure" | "route_trip" | "enquiry";
  units_total: number | null; security_deposit: number | null; pickup_time: string | null;
  min_weight_kg: number | null; max_weight_kg: number | null; max_age: number | null; waiver_required: boolean | null;
  duration_days: number | null;
};

export type CreatedBooking = { id: number; token: string; code: string; companyId: number; listingId: number };

/** Lock the listing row (the per-listing mutex) and load what pricing/validation needs. Public bookings need a live listing. */
async function lockListing(client: PoolClient, listingId: number, opts: { publicOnly: boolean; companyId?: number }): Promise<ListingForBooking> {
  const res = await client.query<ListingForBooking>(
    `SELECT l.id, l.company_id, l.title, l.unit_price, l.advance_type, l.advance_value, l.min_notice_hours, l.cancellation_policy,
            l.min_age, l.group_min, l.group_max, l.duration_days, ac.booking_model,
            COALESCE(rd.units_total, vd.units_total) AS units_total, rd.security_deposit,
            COALESCE(rd.pickup_time, vd.pickup_time)::text AS pickup_time,
            sd.min_weight_kg, sd.max_weight_kg, sd.max_age, sd.waiver_required
       FROM adventure_listings l
       JOIN companies c ON c.id = l.company_id
       JOIN adventure_categories ac ON ac.id = l.category_id
       LEFT JOIN listing_rental_details rd ON rd.listing_id = l.id
       LEFT JOIN listing_session_details sd ON sd.listing_id = l.id
       LEFT JOIN listing_vehicle_details vd ON vd.listing_id = l.id
      WHERE l.id = $1
        AND ($2::int IS NULL OR l.company_id = $2)
        AND (NOT $3 OR (l.status = 'published' AND c.status = 'approved'))
      FOR NO KEY UPDATE OF l`,
    [listingId, opts.companyId ?? null, opts.publicOnly],
  );
  const l = res.rows[0];
  if (!l || l.booking_model === "enquiry") throw new HttpError(404, "That isn't available to book.");
  return l;
}

function assertDateAllowed(l: ListingForBooking, date: string, slotTime: string | null | undefined, enforceNotice: boolean) {
  const today = todayIST();
  if (date < today) throw new HttpError(422, "Pick a date from today onward.");
  if (diffDaysISO(today, date) > BOOKING_HORIZON_DAYS) throw new HttpError(422, `Bookings open up to ${BOOKING_HORIZON_DAYS} days ahead.`);
  if (!enforceNotice || date !== today) return;
  const usesSlot = l.booking_model === "session" || l.booking_model === "departure";
  const startMin = timeToMinutes(usesSlot ? (slotTime ?? "00:00") : (l.pickup_time ?? "08:00"));
  const { minutes } = nowISTParts();
  if (startMin - minutes < l.min_notice_hours * 60) {
    throw new HttpError(409, l.min_notice_hours > 0
      ? `This needs ${l.min_notice_hours} ${l.min_notice_hours === 1 ? "hour" : "hours"} notice, so it's too late for today. Try tomorrow.`
      : "That time has already passed today.");
  }
}

async function payeeSnapshot(client: PoolClient, companyId: number) {
  const res = await client.query<{ payee_name: string; upi_vpa: string | null; upi_number: string | null; qr_image_url: string | null }>(
    `SELECT payee_name, upi_vpa, upi_number, qr_image_url FROM company_payment_settings WHERE company_id = $1`, [companyId]);
  const p = res.rows[0];
  if (!p || (!p.upi_vpa && !p.upi_number && !p.qr_image_url)) throw new HttpError(409, "This operator can't take online bookings yet. Please contact them directly.");
  return { payeeName: p.payee_name, upiVpa: p.upi_vpa, upiNumber: p.upi_number, qrImageUrl: p.qr_image_url };
}

/** Availability for exactly one (date, slot); throws a friendly 409 if it can't fit `quantity`. */
async function assertFits(client: PoolClient, l: ListingForBooking, date: string, slotTime: string | null | undefined, quantity: number) {
  const usesSlot = l.booking_model === "session" || l.booking_model === "departure";
  if (usesSlot && !slotTime) throw new HttpError(422, l.booking_model === "departure" ? "Choose a departure." : "Choose a time slot.");
  const heldMode = l.booking_model === "departure" ? "exact_start" : "overlap";
  const rows = await getAvailability(client, l.id, date, date, usesSlot ? slotTime : null, heldMode);
  const row = rows[0];
  if (!row) throw new HttpError(409, usesSlot ? "That isn't offered on that day." : "Not available on that date.");
  if (row.available < quantity) {
    const noun = l.booking_model === "session" ? "seat" : l.booking_model === "departure" ? "spot" : l.booking_model === "route_trip" ? "vehicle" : "vehicle";
    throw new HttpError(409, row.available === 0
      ? "Sorry, that's fully booked. Try another date or time."
      : `Only ${row.available} ${row.available === 1 ? noun : `${noun}s`} left for that.`,
      { remaining: row.available });
  }
}

/**
 * Create an online booking: validates, locks the listing, checks derived
 * availability, prices it on the server, and holds the units for HOLD_MINUTES
 * while the customer pays the operator's UPI.
 */
export async function createBooking(input: CreateBookingInput, ctx: { listingId: number; ipHash: string }): Promise<CreatedBooking> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withTx(async (client) => {
        const l = await lockListing(client, ctx.listingId, { publicOnly: true });
        const usesSlot = l.booking_model === "session" || l.booking_model === "departure";
        const slot = usesSlot ? input.slotTime ?? null : null;

        assertDateAllowed(l, input.date, slot, true);

        if (l.booking_model === "rental_day" && !input.hasLicence) throw new HttpError(422, "Please confirm you'll bring your original driving licence.");
        if (l.booking_model === "session" || l.booking_model === "departure") {
          const ps = input.participants ?? [];
          if (ps.length !== input.quantity) throw new HttpError(422, "Add the name and age of everyone joining.");
          if (l.group_min && input.quantity < l.group_min) throw new HttpError(422, `This needs at least ${l.group_min} people.`);
          if (l.group_max && input.quantity > l.group_max) throw new HttpError(422, `This takes at most ${l.group_max} people per booking.`);
          for (const p of ps) {
            if (l.booking_model === "session") {
              if (l.min_weight_kg && p.weightKg < l.min_weight_kg) throw new HttpError(422, `${p.name}: minimum weight is ${l.min_weight_kg} kg.`);
              if (l.max_weight_kg && p.weightKg > l.max_weight_kg) throw new HttpError(422, `${p.name}: maximum weight is ${l.max_weight_kg} kg.`);
            }
            if (l.min_age && p.age < l.min_age) throw new HttpError(422, `${p.name}: minimum age is ${l.min_age}.`);
            if (l.max_age && p.age > l.max_age) throw new HttpError(422, `${p.name}: maximum age is ${l.max_age}.`);
          }
          if (l.booking_model === "session" && l.waiver_required && !input.waiverAccepted) {
            throw new HttpError(422, "Everyone joining needs to accept the safety waiver.");
          }
        }

        // Abuse caps: unpaid holds can't be used to hoard inventory.
        const caps = await client.query<{ by_phone: number; by_ip: number }>(
          `SELECT count(*) FILTER (WHERE customer_phone = $1)::int AS by_phone, count(*) FILTER (WHERE ip_hash = $2)::int AS by_ip
             FROM listing_bookings WHERE status = 'pending_payment' AND hold_expires_at > now()`,
          [input.phone, ctx.ipHash],
        );
        if (caps.rows[0].by_phone >= 2 || caps.rows[0].by_ip >= 4) {
          throw new HttpError(429, "You already have unpaid bookings on hold. Pay for those or wait for them to expire first.");
        }

        await assertFits(client, l, input.date, slot, input.quantity);

        const unitPrice = l.unit_price ?? 0;
        if (unitPrice <= 0) throw new HttpError(409, "This listing doesn't have a price yet.");
        const total = unitPrice * input.quantity;
        const advance = advanceFor(total, l.advance_type, l.advance_value);
        const deposit = (l.security_deposit ?? 0) * (l.booking_model === "rental_day" ? input.quantity : 0);
        const payTo = await payeeSnapshot(client, l.company_id);
        // Tour cohorts span duration_days from their departure date; every other
        // booking model is a single calendar day (end_date = start_date).
        const endDate = l.booking_model === "departure" ? addDaysISO(input.date, Math.max(1, l.duration_days ?? 1) - 1) : input.date;
        const hasParticipants = l.booking_model === "session" || l.booking_model === "departure";

        const ins = await client.query<{ id: number; token: string; code: string }>(
          `INSERT INTO listing_bookings
             (token, code, company_id, listing_id, source, status, customer_name, customer_phone, customer_email, start_date, end_date, slot_time,
              quantity, unit_price, total_amount, advance_amount, balance_due, deposit_amount, title_snapshot, policy_snapshot, pay_to_snapshot,
              hold_expires_at, participants, waiver_accepted_at, ip_hash)
           VALUES ($1,$2,$3,$4,'online','pending_payment',$5,$6,$7,$8,$9,$10::time,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                   now() + make_interval(mins => $20), $21, $22, $23)
           RETURNING id, token, code`,
          [newBookingToken(), newBookingCode(), l.company_id, l.id, input.name, input.phone, input.email, input.date, endDate, slot,
            input.quantity, unitPrice, total, advance, total - advance, deposit, l.title, l.cancellation_policy, JSON.stringify(payTo),
            HOLD_MINUTES, hasParticipants ? JSON.stringify(input.participants) : null,
            l.booking_model === "session" && input.waiverAccepted ? new Date().toISOString() : null, ctx.ipHash],
        );
        const b = ins.rows[0];
        await client.query(
          `INSERT INTO booking_events (booking_id, actor_type, from_status, to_status, note) VALUES ($1,'customer',NULL,'pending_payment','Booking created')`,
          [b.id],
        );
        return { id: b.id, token: b.token, code: b.code, companyId: l.company_id, listingId: l.id };
      });
    } catch (err) {
      // A (very unlikely) collision on the short display code: just try again.
      const e = err as { code?: string; constraint?: string };
      if (e.code === "23505" && e.constraint?.includes("code") && attempt < 4) continue;
      throw err;
    }
  }
}

/**
 * Operator-entered booking (walk-in, phone or WhatsApp). It reserves real
 * inventory so the shop's physical bookings and online bookings can't collide.
 * No payment step — the operator handles money themselves.
 */
export async function createWalkInBooking(companyId: number, input: WalkInInput): Promise<CreatedBooking> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withTx(async (client) => {
        const l = await lockListing(client, input.listingId, { publicOnly: false, companyId });
        const usesSlot = l.booking_model === "session" || l.booking_model === "departure";
        const slot = usesSlot ? input.slotTime ?? null : null;
        assertDateAllowed(l, input.date, slot, false);
        await assertFits(client, l, input.date, slot, input.quantity);

        const unitPrice = l.unit_price ?? 0;
        const total = unitPrice * input.quantity;
        const deposit = (l.security_deposit ?? 0) * (l.booking_model === "rental_day" ? input.quantity : 0);
        const endDate = l.booking_model === "departure" ? addDaysISO(input.date, Math.max(1, l.duration_days ?? 1) - 1) : input.date;
        const ins = await client.query<{ id: number; token: string; code: string }>(
          `INSERT INTO listing_bookings
             (token, code, company_id, listing_id, source, status, customer_name, customer_phone, start_date, end_date, slot_time,
              quantity, unit_price, total_amount, advance_amount, balance_due, deposit_amount, title_snapshot, policy_snapshot, payment_verified_at, ops_note)
           VALUES ($1,$2,$3,$4,'walk_in','confirmed',$5,$6,$7,$8,$9::time,$10,$11,$12,0,$12,$13,$14,$15,now(),$16)
           RETURNING id, token, code`,
          [newBookingToken(), newBookingCode(), companyId, l.id, input.name, input.phone, input.date, endDate, slot, input.quantity, unitPrice, total,
            deposit, l.title, l.cancellation_policy, input.note ?? null],
        );
        const b = ins.rows[0];
        await client.query(
          `INSERT INTO booking_events (booking_id, actor_type, from_status, to_status, note) VALUES ($1,'operator',NULL,'confirmed','Added by operator (walk-in)')`,
          [b.id],
        );
        return { id: b.id, token: b.token, code: b.code, companyId, listingId: l.id };
      });
    } catch (err) {
      const e = err as { code?: string; constraint?: string };
      if (e.code === "23505" && e.constraint?.includes("code") && attempt < 4) continue;
      throw err;
    }
  }
}

