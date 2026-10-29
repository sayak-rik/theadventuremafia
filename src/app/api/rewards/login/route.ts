import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { REWARDS_COOKIE, sessionValue, verifyPassword } from "@/lib/rewards-auth";
import { clientIp, sameOrigin } from "@/lib/http";
import { rateLimit, resetRateLimit, tooManyRequests } from "@/lib/rate-limit";

// Sign back in with email + password. Just restores the session — no bonuses,
// earnings stay intact.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 422 });

  // 5 attempts / 15 min per email, 20 per IP.
  const emailKey = `login:customer:${String(email).trim().toLowerCase()}`;
  for (const r of [await rateLimit(emailKey, 5, 900), await rateLimit(`login-ip:${clientIp(req)}`, 20, 900)]) {
    if (!r.ok) return tooManyRequests(r.retryAfterSec, "Too many sign-in attempts. Please try again later.");
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  const res = await pool.query<{ id: number; password_hash: string | null; referral_code: string; adv_cash: number; referral_earned: number; email_verified: boolean }>(
    `SELECT id, password_hash, referral_code, adv_cash, referral_earned, email_verified FROM customer_users WHERE email = $1`,
    [String(email).trim().toLowerCase()],
  );
  const user = res.rows[0];
  if (!user || !user.email_verified || !(await verifyPassword(String(password), user.password_hash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await resetRateLimit(emailKey);
  const response = NextResponse.json({
    ok: true,
    referralCode: user.referral_code,
    advCash: user.adv_cash,
    referralEarned: user.referral_earned,
  });
  response.cookies.set(REWARDS_COOKIE, sessionValue(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}
