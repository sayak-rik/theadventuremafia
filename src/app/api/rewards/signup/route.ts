import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";
import { generateOtp, generateReferralCode, OTP_TTL_MIN } from "@/lib/rewards";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sign up (or re-request OTP). Creates an unverified reward user and emails a code.
export async function POST(req: Request) {
  const { email, phone, name } = await req.json().catch(() => ({}));
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 422 });
  if (!phone?.trim()) return NextResponse.json({ error: "Phone number is required." }, { status: 422 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  // Block re-signup: a verified account already exists with this email OR phone.
  const existing = await pool.query<{ email_verified: boolean }>(
    `SELECT email_verified FROM referral_users
       WHERE lower(email) = $1
          OR regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')`,
    [email.trim().toLowerCase(), phone.trim()],
  );
  if (existing.rows.some((r) => r.email_verified)) {
    return NextResponse.json(
      { error: "An account with this email or phone already exists. Please sign in instead." },
      { status: 409 },
    );
  }

  const otp = generateOtp();
  const expires = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

  // Upsert by email. Keep existing code; generate one for new users.
  await pool.query(
    `INSERT INTO referral_users (email, phone, name, referral_code, otp_code, otp_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (email) DO UPDATE
       SET phone = EXCLUDED.phone,
           name = COALESCE(EXCLUDED.name, referral_users.name),
           otp_code = EXCLUDED.otp_code,
           otp_expires_at = EXCLUDED.otp_expires_at`,
    [email.trim().toLowerCase(), phone.trim(), name?.trim() || null, generateReferralCode(), otp, expires],
  );

  const sent = await sendOtpEmail(email.trim().toLowerCase(), otp);
  return NextResponse.json({ ok: true, emailed: sent });
}
