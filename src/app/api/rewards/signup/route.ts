import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";
import { generateReferralCode } from "@/lib/rewards";
import { generateOtp, hashOtp, otpExpiry, checkOtpSendLimit } from "@/lib/otp";
import { clientIp, sameOrigin } from "@/lib/http";
import { tooManyRequests } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sign up (or re-request OTP). Creates an unverified reward user and emails a code.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { email, phone, name } = await req.json().catch(() => ({}));
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 422 });
  if (!phone?.trim()) return NextResponse.json({ error: "Phone number is required." }, { status: 422 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  const normalizedEmail = email.trim().toLowerCase();
  const limit = await checkOtpSendLimit("customer", normalizedEmail, clientIp(req));
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "Please wait a minute before requesting another code.");

  // Block re-signup: a verified account already exists with this email OR phone.
  const existing = await pool.query<{ email_verified: boolean }>(
    `SELECT email_verified FROM customer_users
       WHERE lower(email) = $1
          OR regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')`,
    [normalizedEmail, phone.trim()],
  );
  if (existing.rows.some((r) => r.email_verified)) {
    return NextResponse.json(
      { error: "An account with this email or phone already exists. Please sign in instead." },
      { status: 409 },
    );
  }

  const otp = generateOtp();

  // Upsert by email. Keep existing code; generate one for new users. Only a
  // keyed hash of the OTP is stored.
  await pool.query(
    `INSERT INTO customer_users (email, phone, name, referral_code, otp_code, otp_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (email) DO UPDATE
       SET phone = EXCLUDED.phone,
           name = COALESCE(EXCLUDED.name, customer_users.name),
           otp_code = EXCLUDED.otp_code,
           otp_expires_at = EXCLUDED.otp_expires_at`,
    [normalizedEmail, phone.trim(), name?.trim() || null, generateReferralCode(), hashOtp("customer", normalizedEmail, otp), otpExpiry()],
  );

  const sent = await sendOtpEmail(normalizedEmail, otp);
  return NextResponse.json({ ok: true, emailed: sent });
}
