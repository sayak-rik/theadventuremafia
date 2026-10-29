import { z } from "zod";
import { publicRoute, parseBody, json } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { checkOtpSendLimit } from "@/lib/otp";
import { tooManyRequests } from "@/lib/rate-limit";
import { issueOperatorOtp } from "@/lib/operators/service";
import { email } from "@/lib/validation/common";
import { notifyOperatorVerifyCode } from "@/lib/notify";

// Re-send the signup code. Always answers "ok" so it can't be used to probe which emails exist.
export const POST = publicRoute(async (req) => {
  const { email: addr } = await parseBody(req, z.object({ email }));
  const limit = await checkOtpSendLimit("operator", addr, clientIp(req));
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "Please wait a minute before requesting another code.");
  const issued = await issueOperatorOtp(addr, "operator");
  if (issued) await notifyOperatorVerifyCode(addr, issued.name, issued.otp);
  return json({ ok: true });
});
