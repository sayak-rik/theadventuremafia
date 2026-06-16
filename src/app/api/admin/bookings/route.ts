import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

// Admin booking actions: confirm or cancel. Cancelling releases the reserved
// capacity back to the departure (one motorbike, or N cab seats).
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, action } = await req.json().catch(() => ({}));
  const bookingId = Number(id);
  if (!bookingId || (action !== "confirm" && action !== "cancel")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not connected." }, { status: 503 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const res = await client.query<{
      option: "bike" | "cab";
      seats: number;
      trip_id: number | null;
      status: string;
    }>(
      `SELECT option, seats, trip_id, status FROM bookings WHERE id = $1 FOR UPDATE`,
      [bookingId],
    );
    const booking = res.rows[0];
    if (!booking) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (action === "confirm") {
      if (booking.status === "cancelled") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Cannot confirm a cancelled booking." }, { status: 409 });
      }
      await client.query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [bookingId]);
    } else {
      // cancel — release the seat only if it wasn't already cancelled.
      if (booking.status !== "cancelled") {
        await client.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [bookingId]);
        if (booking.trip_id) {
          if (booking.option === "bike") {
            await client.query(
              `UPDATE trip_dates SET bikes_booked = GREATEST(0, bikes_booked - 1) WHERE id = $1`,
              [booking.trip_id],
            );
          } else {
            await client.query(
              `UPDATE trip_dates SET cab_seats_booked = GREATEST(0, cab_seats_booked - $2) WHERE id = $1`,
              [booking.trip_id, booking.seats],
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/bookings] action failed:", err);
    return NextResponse.json({ error: "Action failed. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
