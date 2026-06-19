import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { REWARDS_COOKIE, sessionValue, verifyPassword } from "@/lib/rewards-auth";

// Sign back in with email + password. Just restores the session — no bonuses,
// earnings stay intact.
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 422 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  const res = await pool.query<{ id: number; password_hash: string | null; referral_code: string; adv_cash: number; referral_earned: number; email_verified: boolean }>(
    `SELECT id, password_hash, referral_code, adv_cash, referral_earned, email_verified FROM referral_users WHERE email = $1`,
    [String(email).trim().toLowerCase()],
  );
  const user = res.rows[0];
  if (!user || !user.email_verified || !verifyPassword(String(password), user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

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
