import { after } from "next/server";
import { publicRoute, parseBody, json, HttpError } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { checkOtpVerifyLimit } from "@/lib/otp";
import { resetRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { verifyOperatorEmail } from "@/lib/operators/service";
import { getApplicationSummary } from "@/lib/operators/admin";
import { verifySchema } from "@/lib/validation/operator";
import { OPERATOR_COOKIE, operatorCookieOptions, operatorCookieValue } from "@/lib/operator-auth";
import { notifyAdminNewOperator, notifyOperatorPending } from "@/lib/notify";

// Verify the signup code, open a session, and alert the admin (first time only).
export const POST = publicRoute(async (req) => {
  const { email, otp } = await parseBody(req, verifySchema);
  const limit = await checkOtpVerifyLimit("operator", email, clientIp(req));
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "Too many incorrect codes. Please wait and request a new one.");

  const verified = await verifyOperatorEmail(email, otp);
  if (!verified) throw new HttpError(401, "That code is wrong or has expired.");
  await resetRateLimit(`otp-verify:operator:${email}`);

  if (verified.firstVerification) {
    after(async () => {
      const summary = await getApplicationSummary(verified.companyId);
      if (!summary) return;
      await Promise.all([
        notifyAdminNewOperator(summary),
        notifyOperatorPending(summary.email, summary.ownerName, summary.companyName),
      ]);
    });
  }

  const res = json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE, operatorCookieValue(verified.companyUserId, verified.tokenVersion), operatorCookieOptions);
  return res;
});
