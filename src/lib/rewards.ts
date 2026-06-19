import crypto from "crypto";

// "adv cash" rules.
export const SIGNUP_BONUS = 500; // credited on email verification (rule 8)
export const REFERRAL_DISCOUNT = 1000; // off a booking when a code is used (rule 3)
export const DEFAULT_REWARD = 500; // referrer earns per confirmed booking (rule 4)
export const REFERRAL_CAP = 55000; // max lifetime referral earnings (rule 6)
export const OTP_TTL_MIN = 10;

export const formatINR = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// 6-digit numeric OTP.
export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// Short, friendly referral code, e.g. "TAM-7KQ4X9".
export function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(0, alphabet.length)];
  return `TAM-${code}`;
}

export const normalizeCode = (c: string): string => c.trim().toUpperCase();
