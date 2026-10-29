import { operatorRoute, OPERATOR_COOKIE, operatorCookieOptions, operatorCookieValue } from "@/lib/operator-auth";
import { json, parseBody } from "@/lib/api";
import { getPaymentSettings, savePaymentSettings, maskPayment } from "@/lib/operators/account";
import { paymentSettingsSchema } from "@/lib/validation/operator";
import { notifyPaymentDetailsChanged } from "@/lib/notify";
import { after } from "next/server";

export const GET = operatorRoute(async (_req, s) => json({ settings: await getPaymentSettings(s.companyId) }));

// Changing existing payment details needs the password, is audit-logged, emails
// the owner and signs out every other device (this one gets a fresh cookie).
export const PUT = operatorRoute(async (req, s) => {
  const input = await parseBody(req, paymentSettingsSchema);
  const result = await savePaymentSettings(s.companyId, s.companyUserId, input);

  const res = json({ ok: true, changed: result.changed });
  if (result.changed && result.tokenVersion !== null) {
    res.cookies.set(OPERATOR_COOKIE, operatorCookieValue(s.companyUserId, result.tokenVersion), operatorCookieOptions);
    const summary = [maskPayment(input.upiVpa ?? null), maskPayment(input.upiNumber ?? null)].filter(Boolean).join(" / ") || "QR only";
    after(() => notifyPaymentDetailsChanged(s.email, { name: s.name, companyName: s.companyName, summary }));
  }
  return res;
});
