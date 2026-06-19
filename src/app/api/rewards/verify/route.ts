import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { SIGNUP_BONUS } from "@/lib/rewards";
import { creditAdvCash } from "@/lib/rewards-data";
import { REWARDS_COOKIE, sessionValue } from "@/lib/rewards-auth";

// Verify the OTP, credit the signup bonus (once), and open a session.
export async function POST(req: Request) {
  const { email, otp } = await req.json().catch(() => ({}));
  if (!email || !otp) return NextResponse.json({ error: "Email and code are required." }, { status: 422 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  const res = await pool.query<{ id: number; otp_code: string | null; otp_expires_at: string | null; signup_credited: boolean }>(
    `SELECT id, otp_code, otp_expires_at, signup_credited FROM referral_users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  const user = res.rows[0];
  if (!user || !user.otp_code || user.otp_code !== String(otp).trim()) {
    return NextResponse.json({ error: "Invalid verification code." }, { status: 401 });
  }
  if (user.otp_expires_at && new Date(user.otp_expires_at) < new Date()) {
    return NextResponse.json({ error: "This code has expired. Request a new one." }, { status: 401 });
  }

  await pool.query(
    `UPDATE referral_users SET email_verified = TRUE, otp_code = NULL, otp_expires_at = NULL WHERE id = $1`,
    [user.id],
  );

  // Credit the signup bonus exactly once.
  if (!user.signup_credited) {
    await pool.query(`UPDATE referral_users SET signup_credited = TRUE WHERE id = $1`, [user.id]);
    await creditAdvCash(user.id, SIGNUP_BONUS, "signup", { note: "Signup bonus" });
  }

  const out = await pool.query(`SELECT referral_code, adv_cash, referral_earned, password_hash FROM referral_users WHERE id = $1`, [user.id]);
  const r = out.rows[0];
  const response = NextResponse.json({
    ok: true,
    referralCode: r.referral_code,
    advCash: r.adv_cash,
    referralEarned: r.referral_earned,
    hasPassword: Boolean(r.password_hash),
  });
  response.cookies.set(REWARDS_COOKIE, sessionValue(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });
  return response;
}
