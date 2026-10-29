import crypto from "crypto";
import { getSecret } from "./secrets";

/** Client IP as seen behind Caddy (first X-Forwarded-For entry). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Salted hash of an IP — enough for abuse counting without storing raw IPs. */
export function hashIp(ip: string): string {
  return crypto
    .createHmac("sha256", getSecret("REWARDS_SECRET", "tam-rewards-dev-secret"))
    .update(`ip:${ip}`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * CSRF defence in depth on top of SameSite=Lax cookies: a browser always sends
 * Origin on cross-site POSTs, so reject if it doesn't match our host. Requests
 * with no Origin (curl, server-to-server) are allowed.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
