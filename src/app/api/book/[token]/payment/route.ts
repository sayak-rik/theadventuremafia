import { after } from "next/server";
import { publicRoute, parseBody, json, HttpError } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { submitPayment } from "@/lib/booking/transitions";
import { submitPaymentSchema } from "@/lib/validation/booking";
import { requirePool } from "@/lib/db";
import { notifyBooking } from "@/lib/notify/booking";

// "I've paid": the customer attaches the 12-digit UPI reference.
export const POST = publicRoute<{ token: string }>(async (req, { token }) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new HttpError(404, "Booking not found.");
  for (const r of [await rateLimit(`pay-token:${token}`, 10, 3600), await rateLimit(`pay-ip:${clientIp(req)}`, 30, 3600)]) {
    if (!r.ok) return tooManyRequests(r.retryAfterSec);
  }
  const { utr, payerName } = await parseBody(req, submitPaymentSchema);
  const { status } = await submitPayment(token, utr, payerName);

  const row = await requirePool().query<{ id: number }>(`SELECT id FROM listing_bookings WHERE token = $1`, [token]);
  const id = row.rows[0]?.id;
  if (id) after(() => notifyBooking(id, status === "needs_reschedule" ? { type: "needs_reschedule", why: "The payment arrived after the booking's hold had ended and those units were taken meanwhile." } : "payment_submitted"));
  return json({ ok: true, status });
});
