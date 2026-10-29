import { publicRoute, json } from "@/lib/api";
import { OPERATOR_COOKIE, operatorCookieOptions } from "@/lib/operator-auth";

export const POST = publicRoute(async () => {
  const res = json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE, "", { ...operatorCookieOptions, maxAge: 0 });
  return res;
});
