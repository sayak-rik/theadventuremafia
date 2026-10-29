import { publicRoute, parseBody, json, HttpError } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { checkOtpSendLimit } from "@/lib/otp";
import { rateLimit, resetRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { issueOperatorOtp, loginOperator } from "@/lib/operators/service";
import { loginSchema } from "@/lib/validation/operator";
import { OPERATOR_COOKIE, operatorCookieOptions, operatorCookieValue } from "@/lib/operator-auth";
import { notifyOperatorVerifyCode } from "@/lib/notify";

export const POST = publicRoute(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const ip = clientIp(req);
  const emailKey = `login:operator:${email}`;
  // 5 attempts / 15 min per email, 20 per IP.
  for (const r of [await rateLimit(emailKey, 5, 900), await rateLimit(`login-ip:${ip}`, 20, 900)]) {
    if (!r.ok) return tooManyRequests(r.retryAfterSec, "Too many sign-in attempts. Please try again later.");
  }

  const user = await loginOperator(email, password);
  if (!user) throw new HttpError(401, "Incorrect email or password.");

  if (!user.emailVerified) {
    // Correct password but the email was never verified: send a fresh code.
    if ((await checkOtpSendLimit("operator", email, ip)).ok) {
      const issued = await issueOperatorOtp(email, "operator");
      if (issued) await notifyOperatorVerifyCode(email, issued.name, issued.otp);
    }
    return json({ error: "Please verify your email first — we've sent you a new code.", needsVerification: true }, { status: 403 });
  }

  await resetRateLimit(emailKey);
  const res = json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE, operatorCookieValue(user.companyUserId, user.tokenVersion), operatorCookieOptions);
  return res;
});
