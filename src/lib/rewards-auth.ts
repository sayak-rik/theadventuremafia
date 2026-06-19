import { cookies } from "next/headers";
import crypto from "crypto";

// Lightweight session for verified reward users: cookie holds "<userId>.<sig>"
// where sig = HMAC(userId). No password — identity is proven via email OTP.
export const REWARDS_COOKIE = "tam_rewards";

function secret(): string {
  return process.env.REWARDS_SECRET || process.env.ADMIN_PASSWORD || "tam-rewards-dev-secret";
}

function sign(userId: number): string {
  const sig = crypto.createHmac("sha256", secret()).update(String(userId)).digest("hex").slice(0, 32);
  return `${userId}.${sig}`;
}

export function sessionValue(userId: number): string {
  return sign(userId);
}

// ---- Password hashing (scrypt, salt:hash hex) ----
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(calc, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Returns the authenticated reward user's id, or null. */
export async function getRewardsUserId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(REWARDS_COOKIE)?.value;
  if (!raw) return null;
  const [idStr] = raw.split(".");
  const id = Number(idStr);
  if (!id || sign(id) !== raw) return null;
  return id;
}
