import crypto from "crypto";
import { getSecret, safeEqual } from "./secrets";
import { rateLimit } from "./rate-limit";

export const OTP_TTL_MIN = 10;

/** 6-digit numeric OTP. */
export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function otpExpiry(): string {
  return new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();
}

/**
 * OTPs are stored as an HMAC (keyed with a server secret and bound to the
 * scope + email), never in plaintext, so a database leak can't be replayed.
 */
export function hashOtp(scope: string, email: string, code: string): string {
  return crypto
    .createHmac("sha256", getSecret("REWARDS_SECRET", "tam-rewards-dev-secret"))
    .update(`otp:${scope}:${email.trim().toLowerCase()}:${code.trim()}`)
    .digest("hex");
}

export function otpMatches(stored: string | null, scope: string, email: string, submitted: string): boolean {
  if (!stored) return false;
  return safeEqual(stored, hashOtp(scope, email, submitted));
}

export type LimitCheck = { ok: true } | { ok: false; retryAfterSec: number };

/** Sending: 1 per 60 s and 5 per hour per email, 20 per hour per IP. */
export async function checkOtpSendLimit(scope: string, email: string, ip: string): Promise<LimitCheck> {
  const e = email.trim().toLowerCase();
  for (const r of [
    await rateLimit(`otp-send-min:${scope}:${e}`, 1, 60),
    await rateLimit(`otp-send-hr:${scope}:${e}`, 5, 3600),
    await rateLimit(`otp-send-ip:${ip}`, 20, 3600),
  ]) {
    if (!r.ok) return { ok: false, retryAfterSec: r.retryAfterSec };
  }
  return { ok: true };
}

/** Verifying: 5 guesses per 10 minutes per email, 30 per IP. */
export async function checkOtpVerifyLimit(scope: string, email: string, ip: string): Promise<LimitCheck> {
  const e = email.trim().toLowerCase();
  for (const r of [
    await rateLimit(`otp-verify:${scope}:${e}`, 5, 600),
    await rateLimit(`otp-verify-ip:${ip}`, 30, 600),
  ]) {
    if (!r.ok) return { ok: false, retryAfterSec: r.retryAfterSec };
  }
  return { ok: true };
}
