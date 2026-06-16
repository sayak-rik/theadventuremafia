import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getBikeModels } from "@/lib/data";
import { priceFor, SHARED_CAB_PRICE, CAB_SEATS_PER_DEPARTURE, fareFor, type Residence } from "@/lib/pricing";
import { sendBookingEmails } from "@/lib/email";
import { isValidDeparture } from "@/lib/dates";

type BookingPayload = {
  name?: string;
  email?: string;
  phone?: string;
  tripDate?: string;
  residence?: Residence;
  option?: "bike" | "cab";
  bikeModelId?: number | null;
  riderType?: "single" | "double" | null;
  seats?: number;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: BookingPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // --- Validation ---
  const errors: string[] = [];
  if (!body.name?.trim()) errors.push("Name is required.");
  if (!body.email || !EMAIL_RE.test(body.email)) errors.push("A valid email is required.");
  if (!body.phone?.trim()) errors.push("Phone is required.");
  if (!body.tripDate) errors.push("Please choose a departure date.");

  if (body.tripDate) {
    const [y, m, d] = body.tripDate.split("-").map(Number);
    const date = new Date(y, (m ?? 1) - 1, d);
    if (Number.isNaN(date.getTime()) || !isValidDeparture(date)) {
      errors.push("Departures are only available on Sundays between September and May.");
    }
  }
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 422 });
  }

  const option: "bike" | "cab" = body.option === "cab" ? "cab" : "bike";

  // Normalise per-option fields.
  const bikes = await getBikeModels();
  const bike = option === "bike" ? bikes.find((b) => b.id === body.bikeModelId) ?? bikes[0] : undefined;
  const rider: "single" | "double" =
    option === "bike" ? (body.riderType === "single" ? "single" : "double") : "double";

  // seats: riders on the bike (1–2) OR number of cab seats (1–10).
  const seats =
    option === "bike"
      ? rider === "double" ? 2 : 1
      : Math.max(1, Math.min(CAB_SEATS_PER_DEPARTURE, Number(body.seats) || 1));

  const residence: Residence = body.residence === "INTL" ? "INTL" : "IN";
  const baseUnitINR = option === "cab" ? SHARED_CAB_PRICE : bike ? priceFor(bike, rider) : 0;
  const fare = fareFor(baseUnitINR, residence); // { amount, currency }

  const emailData = {
    name: body.name!.trim(),
    email: body.email!.trim(),
    phone: body.phone!.trim(),
    tripDate: body.tripDate!,
    option,
    bikeName: bike?.name,
    rider: option === "bike" ? rider : undefined,
    seats,
    residence,
    price: fare.amount, // per rider (bike) or per seat (cab), in `currency`
    currency: fare.currency,
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

    const ins = await client.query<{ id: number }>(
      `INSERT INTO bookings
         (trip_id, option, bike_model_id, rider, residence, name, email, phone, trip_date, seats, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        trip.id,
        option,
        option === "bike" ? bike?.id ?? null : null,
        option === "bike" ? rider : null,
        residence,
        body.name!.trim(),
        body.email!.trim(),
        body.phone!.trim(),
        body.tripDate,
        seats,
        body.message?.trim() || null,
      ],
    );

    // Reserve capacity: one motorbike per bike booking, or N cab seats.
    if (option === "bike") {
      await client.query(`UPDATE trip_dates SET bikes_booked = bikes_booked + 1 WHERE id = $1`, [trip.id]);
    } else {
      await client.query(`UPDATE trip_dates SET cab_seats_booked = cab_seats_booked + $2 WHERE id = $1`, [trip.id, seats]);
    }

    await client.query("COMMIT");

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
