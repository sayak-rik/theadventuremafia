import { cookies } from "next/headers";
import crypto from "crypto";
import { getSecret, safeEqual } from "./secrets";
export { hashPassword, verifyPassword } from "./password";

// Lightweight session for verified reward users: cookie holds "<userId>.<sig>"
// where sig = HMAC(userId). Identity is proven via email OTP (or password).
export const REWARDS_COOKIE = "tam_rewards";

// Previously this fell back to ADMIN_PASSWORD, so anyone who knew the admin
// password could forge customer sessions. See getSecret() for the fallback.
function secret(): string {
  return getSecret("REWARDS_SECRET", "tam-rewards-dev-secret");
}

function sign(userId: number): string {
  const sig = crypto.createHmac("sha256", secret()).update(String(userId)).digest("hex").slice(0, 32);
  return `${userId}.${sig}`;
}

export function sessionValue(userId: number): string {
  return sign(userId);
}

/** Returns the authenticated reward user's id, or null. */
export async function getRewardsUserId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(REWARDS_COOKIE)?.value;
  if (!raw) return null;
  const [idStr] = raw.split(".");
  const id = Number(idStr);
  if (!id || !safeEqual(sign(id), raw)) return null;
  return id;
}
