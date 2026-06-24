import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getBikeModels, getTrekById } from "@/lib/data";
import { getTrekContent } from "@/data/treks";
import { priceFor, SHARED_CAB_PRICE, CAB_SEATS_PER_DEPARTURE, fareFor, type Residence } from "@/lib/pricing";
import { sendBookingEmails } from "@/lib/email";
import { isValidDeparture, isValidTrekDate } from "@/lib/dates";
import { REFERRAL_DISCOUNT, normalizeCode } from "@/lib/rewards";
import { findActiveByCode } from "@/lib/rewards-data";
import { getRewardsUserId } from "@/lib/rewards-auth";

type BookingPayload = {
  name?: string;
  email?: string;
  phone?: string;
  tripDate?: string;
  residence?: Residence;
  productType?: "expedition" | "trek";
  option?: "bike" | "cab";
  bikeModelId?: number | null;
  trekId?: number | null;
  riderType?: "single" | "double" | null;
  seats?: number;
  message?: string;
  referralCode?: string;
  applyAdvCash?: boolean;
};

// People on a trek booking is capped at a sane group size.
const MAX_TREK_PEOPLE = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: BookingPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const productType: "expedition" | "trek" = body.productType === "trek" ? "trek" : "expedition";

  // --- Validation ---
  const errors: string[] = [];
  if (!body.name?.trim()) errors.push("Name is required.");
  if (!body.email || !EMAIL_RE.test(body.email)) errors.push("A valid email is required.");
  if (!body.phone?.trim()) errors.push("Phone is required.");
  if (!body.tripDate) errors.push("Please choose a date.");

  if (body.tripDate) {
    const [y, m, d] = body.tripDate.split("-").map(Number);
    const date = new Date(y, (m ?? 1) - 1, d);
    if (productType === "trek") {
      if (!isValidTrekDate(date)) errors.push("Please choose a date from today onward.");
    } else if (Number.isNaN(date.getTime()) || !isValidDeparture(date)) {
      errors.push("Departures are only available on Sundays between September and May.");
    }
  }

  const residence: Residence = body.residence === "INTL" ? "INTL" : "IN";

  // --- Resolve the product (trek OR expedition bike/cab) ---
  const bikes = await getBikeModels();

  // Trek-specific fields.
  const trek = productType === "trek" ? await getTrekById(Number(body.trekId)) : undefined;
  const trekContent = trek ? getTrekContent(trek.slug) : undefined;
  if (productType === "trek" && !trek) errors.push("That trek is no longer available.");

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 422 });
  }

  // Expedition-only fields.
  const option: "bike" | "cab" = body.option === "cab" ? "cab" : "bike";
  const bike =
    productType === "expedition" && option === "bike"
      ? bikes.find((b) => b.id === body.bikeModelId) ?? bikes[0]
      : undefined;
  const rider: "single" | "double" =
    productType === "expedition" && option === "bike"
      ? body.riderType === "single" ? "single" : "double"
      : "double";

  // seats = people on the booking. Trek: party size. Bike: 1–2 riders. Cab: 1–10 seats.
  const seats =
    productType === "trek"
      ? Math.max(1, Math.min(MAX_TREK_PEOPLE, Number(body.seats) || 1))
      : option === "bike"
        ? rider === "double" ? 2 : 1
        : Math.max(1, Math.min(CAB_SEATS_PER_DEPARTURE, Number(body.seats) || 1));

  const baseUnitINR =
    productType === "trek"
      ? trek!.price_per_person
      : option === "cab"
        ? SHARED_CAB_PRICE
        : bike ? priceFor(bike, rider) : 0;
  const fare = fareFor(baseUnitINR, residence); // { amount, currency }
  // `seats` = people on the booking (2 for a two-up/pillion bike). Charge per person.
  const total = fare.amount * seats;

  // The currently signed-in reward user (if any), used to block self-referral
  // and to apply their own adv-cash balance.
  const signedInUserId = await getRewardsUserId();

  // Referral: tag the referrer and (for INR bookings) apply the adv-cash discount.
  // adv cash is a rupee credit, so the discount only applies to INR pricing.
  let referredBy: number | null = null;
  let referralCode: string | null = null;
  let advCashDiscount = 0;
  if (body.referralCode?.trim()) {
    const code = normalizeCode(body.referralCode);
    const referrer = await findActiveByCode(code);
    // No self-referral: not your own code (signed in) and not your own email.
    const isSelf =
      !referrer ||
      referrer.id === signedInUserId ||
      referrer.email === body.email!.trim().toLowerCase();
    if (referrer && !isSelf) {
      referredBy = referrer.id;
      referralCode = referrer.referral_code;
      // Discount is per person, so a pillion booking gets it for both riders.
      if (residence === "IN") advCashDiscount = Math.min(REFERRAL_DISCOUNT * seats, total);
    }
  }

  // Signed-in reward users can apply their own collected adv cash (INR only).
  const rewardUserId: number | null = body.applyAdvCash && residence === "IN" ? signedInUserId : null;
  let walletApplied = 0;

  const emailData = {
    name: body.name!.trim(),
    email: body.email!.trim(),
    phone: body.phone!.trim(),
    tripDate: body.tripDate!,
    productType,
    option: (productType === "trek" ? "trek" : option) as "bike" | "cab" | "trek",
    bikeName: bike?.name,
    trekName: trek?.name,
    priceNote: trekContent?.priceNote,
    rider: productType === "expedition" && option === "bike" ? rider : undefined,
    seats,
    residence,
    price: fare.amount, // per rider (bike), per seat (cab) or per person (trek)
    currency: fare.currency,
    advCashDiscount, // updated below once wallet redemption is computed
    message: body.message?.trim() || undefined,
  };

  const pool = getPool();
  // No DB configured (e.g. running the UI standalone) — accept the lead anyway
  // so the form flow can be demoed. Wire DATABASE_URL to persist for real.
  if (!pool) {
    console.warn("[bookings] DATABASE_URL not set — booking not persisted:", body.email);
    await sendBookingEmails(emailData);
    return NextResponse.json({ ok: true, persisted: false });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Treks have no fixed departures/capacity (daily, unlimited), so they skip
    // the trip_dates lock, capacity checks and per-departure dedup entirely.
    let tripId: number | null = null;
    if (productType === "expedition") {
      // Ensure a trip_date row exists and lock it so capacity checks are atomic.
      await client.query(
        `INSERT INTO trip_dates (depart_on) VALUES ($1) ON CONFLICT (depart_on) DO NOTHING`,
        [body.tripDate],
      );
      const tripRes = await client.query<{
        id: number;
        bikes_total: number;
        bikes_booked: number;
        cab_seats_total: number;
        cab_seats_booked: number;
      }>(
        `SELECT id, bikes_total, bikes_booked, cab_seats_total, cab_seats_booked
           FROM trip_dates WHERE depart_on = $1 FOR UPDATE`,
        [body.tripDate],
      );
      const trip = tripRes.rows[0];
      tripId = trip.id;

      // Capacity enforcement.
      if (option === "bike" && trip.bikes_booked + 1 > trip.bikes_total) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "All 20 motorbikes for this departure are booked. Try another Sunday or a shared cab seat." },
          { status: 409 },
        );
      }
      if (option === "cab" && trip.cab_seats_booked + seats > trip.cab_seats_total) {
        const left = trip.cab_seats_total - trip.cab_seats_booked;
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Only ${left} shared-cab seat${left === 1 ? "" : "s"} left for this departure.` },
          { status: 409 },
        );
      }

      // One motorbike per rider, per Sunday — matched by email OR phone number.
      if (option === "bike") {
        const dup = await client.query(
          `SELECT 1 FROM bookings
             WHERE trip_id = $1 AND option = 'bike' AND status <> 'cancelled'
               AND (lower(email) = lower($2)
                    OR regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace($3, '[^0-9]', '', 'g'))
             LIMIT 1`,
          [trip.id, body.email!.trim(), body.phone!.trim()],
        );
        if (dup.rows.length) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "This email or phone number already has a motorbike booked for this departure — only one motorbike per rider, per Sunday." },
            { status: 409 },
          );
        }
      }
    }

    const ins = await client.query<{ id: number }>(
      `INSERT INTO bookings
         (trip_id, product_type, option, bike_model_id, trek_id, rider, residence, name, email, phone, trip_date, seats, message,
          referral_code, referred_by, adv_cash_discount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        tripId,
        productType,
        productType === "trek" ? "trek" : option,
        productType === "expedition" && option === "bike" ? bike?.id ?? null : null,
        productType === "trek" ? trek?.id ?? null : null,
        productType === "expedition" && option === "bike" ? rider : null,
        residence,
        body.name!.trim(),
        body.email!.trim(),
        body.phone!.trim(),
        body.tripDate,
        seats,
        body.message?.trim() || null,
        referralCode,
        referredBy,
        advCashDiscount,
      ],
    );

    // Apply the signed-in user's own adv cash (locked, never over-spending).
    if (rewardUserId) {
      const ures = await client.query<{ adv_cash: number }>(
        `SELECT adv_cash FROM referral_users WHERE id = $1 FOR UPDATE`,
        [rewardUserId],
      );
      const balance = ures.rows[0]?.adv_cash ?? 0;
      walletApplied = Math.max(0, Math.min(balance, total - advCashDiscount));
      if (walletApplied > 0) {
        await client.query(`UPDATE referral_users SET adv_cash = adv_cash - $2 WHERE id = $1`, [rewardUserId, walletApplied]);
        await client.query(
          `INSERT INTO adv_cash_ledger (user_id, amount, reason, booking_id, note) VALUES ($1,$2,'redeemed',$3,$4)`,
          [rewardUserId, -walletApplied, ins.rows[0].id, `Applied to booking #${ins.rows[0].id}`],
        );
        await client.query(`UPDATE bookings SET adv_cash_discount = adv_cash_discount + $2 WHERE id = $1`, [ins.rows[0].id, walletApplied]);
      }
    }

    // Reserve capacity for the expedition: one motorbike per bike booking, or
    // N cab seats. Treks have no capacity to reserve.
    if (productType === "expedition" && tripId !== null) {
      if (option === "bike") {
        await client.query(`UPDATE trip_dates SET bikes_booked = bikes_booked + 1 WHERE id = $1`, [tripId]);
      } else {
        await client.query(`UPDATE trip_dates SET cab_seats_booked = cab_seats_booked + $2 WHERE id = $1`, [tripId, seats]);
      }
    }

    await client.query("COMMIT");
    emailData.advCashDiscount = advCashDiscount + walletApplied;

    // Fire confirmation + team notification. Failures are swallowed internally
    // so a saved booking never 500s just because email is down.
    await sendBookingEmails(emailData);

    return NextResponse.json({ ok: true, persisted: true, id: ins.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[bookings] insert failed:", err);
    return NextResponse.json({ error: "Could not save your booking. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
