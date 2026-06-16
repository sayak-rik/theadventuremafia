import { cookies } from "next/headers";
import crypto from "crypto";

// Single-admin auth. Username is always "admin"; the password comes from the
// ADMIN_PASSWORD env var. A login sets an httpOnly cookie holding a hash of the
// password (never the raw password), validated on every admin request.

export const ADMIN_COOKIE = "tam_admin";
const ADMIN_USERNAME = "admin";

function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export function adminConfigured(): boolean {
  return Boolean(adminPassword());
}

function tokenFor(pw: string): string {
  return crypto.createHash("sha256").update(`tam-admin:${pw}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Validate a login attempt (constant-time password compare). */
export function verifyCredentials(username: string, password: string): boolean {
  const pw = adminPassword();
  if (!pw) return false;
  if (username !== ADMIN_USERNAME) return false;
  return safeEqual(password, pw);
}

/** The cookie value to set on successful login. */
export function sessionToken(): string | null {
  const pw = adminPassword();
  return pw ? tokenFor(pw) : null;
}

/** Is the current request an authenticated admin? */
export async function isAdminAuthed(): Promise<boolean> {
  const pw = adminPassword();
  if (!pw) return false;
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  return safeEqual(value, tokenFor(pw));
}
