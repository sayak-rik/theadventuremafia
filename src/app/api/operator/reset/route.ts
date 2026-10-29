import { publicRoute, parseBody, json, HttpError } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { checkOtpVerifyLimit } from "@/lib/otp";
import { resetRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { completeOperatorReset } from "@/lib/operators/service";
import { resetSchema } from "@/lib/validation/operator";

// Set a new password with the emailed code. Invalidates every existing session.
export const POST = publicRoute(async (req) => {
  const { email, otp, password } = await parseBody(req, resetSchema);
  const limit = await checkOtpVerifyLimit("operator-reset", email, clientIp(req));
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "Too many incorrect codes. Please wait and request a new one.");

  const ok = await completeOperatorReset(email, otp, password);
  if (!ok) throw new HttpError(401, "That code is wrong or has expired.");
  await resetRateLimit(`otp-verify:operator-reset:${email}`);
  await resetRateLimit(`login:operator:${email}`);
  return json({ ok: true });
});
