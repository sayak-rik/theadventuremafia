import { after } from "next/server";
import { publicRoute, parseBody, parseId, json } from "@/lib/api";
import { clientIp, hashIp } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { createBooking } from "@/lib/booking/create";
import { createBookingSchema } from "@/lib/validation/booking";
import { notifyBooking } from "@/lib/notify/booking";

// Guest checkout: validates, holds the units for 30 minutes, returns the private booking link.
export const POST = publicRoute<{ id: string }>(async (req, { id }) => {
  const ip = clientIp(req);
  const limit = await rateLimit(`book-ip:${ip}`, 15, 3600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "Too many booking attempts. Please try again later.");

  const input = await parseBody(req, createBookingSchema);
  if (input.website) return json({ ok: true, token: "x".repeat(22), code: "BK-XXXXXX" }); // honeypot: pretend it worked

  const booking = await createBooking(input, { listingId: parseId(id), ipHash: hashIp(ip) });
  after(() => notifyBooking(booking.id, "created"));
  return json({ ok: true, token: booking.token, code: booking.code }, { status: 201 });
});
