import { publicRoute, json, HttpError } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getBookingForCustomer } from "@/lib/booking/queries";

// Status polling for the customer's booking page. The token is the credential.
export const GET = publicRoute<{ token: string }>(async (req, { token }) => {
  const limit = await rateLimit(`booking-view:${clientIp(req)}`, 300, 600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new HttpError(404, "Booking not found.");
  const booking = await getBookingForCustomer(token);
  if (!booking) throw new HttpError(404, "Booking not found.");
  return json({ booking }, { headers: { "Cache-Control": "no-store" } });
});
