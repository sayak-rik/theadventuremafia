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
