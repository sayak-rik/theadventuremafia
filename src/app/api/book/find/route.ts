import { z } from "zod";
import { after } from "next/server";
import { publicRoute, parseBody, json } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { requirePool } from "@/lib/db";
import { phone } from "@/lib/validation/common";
import { notifyBooking } from "@/lib/notify/booking";

const schema = z.object({ code: z.string().trim().toUpperCase().regex(/^BK-[A-Z2-9]{6}$/, "Enter the code like BK-7K3Q9X"), phone });

// Lost your link? Enter the booking code + the phone you booked with and we email the link to the
// address on the booking. Always the same answer, so it can't be used to probe for bookings.
export const POST = publicRoute(async (req) => {
  const ip = clientIp(req);
  const { code, phone: p } = await parseBody(req, schema);
  for (const r of [await rateLimit(`find-ip:${ip}`, 8, 3600), await rateLimit(`find-code:${code}`, 5, 3600)]) {
    if (!r.ok) return tooManyRequests(r.retryAfterSec);
  }
  const res = await requirePool().query<{ id: number }>(`SELECT id FROM listing_bookings WHERE code = $1 AND customer_phone = $2`, [code, p]);
  const id = res.rows[0]?.id;
  if (id) after(() => notifyBooking(id, "link"));
  return json({ ok: true });
});
