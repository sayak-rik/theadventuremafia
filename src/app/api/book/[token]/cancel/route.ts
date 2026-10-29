import { publicRoute, parseBody, json, HttpError } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { customerCancel } from "@/lib/booking/transitions";
import { cancelSchema } from "@/lib/validation/booking";

// Customers can cancel only while the booking is still an unpaid hold.
export const POST = publicRoute<{ token: string }>(async (req, { token }) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new HttpError(404, "Booking not found.");
  const limit = await rateLimit(`cancel-ip:${clientIp(req)}`, 20, 3600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);
  const { reason } = await parseBody(req, cancelSchema);
  const { status } = await customerCancel(token, reason);
  return json({ ok: true, status });
});
