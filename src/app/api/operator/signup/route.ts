import { publicRoute, parseBody, json } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { checkOtpSendLimit } from "@/lib/otp";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { registerOperator } from "@/lib/operators/service";
import { signupSchema } from "@/lib/validation/operator";
import { notifyOperatorVerifyCode } from "@/lib/notify";

// Create a pending operator account and email a verification code.
export const POST = publicRoute(async (req) => {
  const ip = clientIp(req);
  const ipLimit = await rateLimit(`operator-signup:${ip}`, 5, 3600);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSec);

  const input = await parseBody(req, signupSchema);
  if (input.website) return json({ ok: true }); // honeypot: pretend it worked

  const sendLimit = await checkOtpSendLimit("operator", input.email, ip);
  if (!sendLimit.ok) return tooManyRequests(sendLimit.retryAfterSec, "Please wait a minute before requesting another code.");

  const { otp } = await registerOperator(input);
  const emailed = await notifyOperatorVerifyCode(input.email, input.ownerName, otp);
  return json({ ok: true, emailed });
});
