import type { PoolClient } from "pg";
import { requirePool, withTx } from "../db";
import { HttpError } from "../api";
import { hashPassword, verifyPassword } from "../password";
import { generateOtp, hashOtp, otpMatches, otpExpiry } from "../otp";
import { PARTNER_TERMS_VERSION, RESERVED_SLUGS } from "./constants";
import type { SignupInput } from "../validation/operator";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueCompanySlug(client: PoolClient, name: string): Promise<string> {
  let base = slugify(name) || "operator";
  if (RESERVED_SLUGS.has(base)) base = `${base}-pelling`;
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const taken = await client.query(`SELECT 1 FROM companies WHERE slug = $1`, [candidate]);
    if (!taken.rowCount) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Create a pending company + its owner login, or refresh an unverified
 * attempt. Returns the plaintext OTP for the caller to email (only its keyed
 * hash is stored).
 */
export async function registerOperator(input: SignupInput): Promise<{ companyUserId: number; companyId: number; otp: string }> {
  const otp = generateOtp();
  const passwordHash = await hashPassword(input.password);

  return withTx(async (client) => {
    const existing = await client.query<{ id: number; company_id: number; email_verified: boolean }>(
      `SELECT id, company_id, email_verified FROM company_users WHERE email = $1 FOR UPDATE`,
      [input.email],
    );
    const prior = existing.rows[0];
    if (prior?.email_verified) {
      throw new HttpError(409, "An operator account with this email already exists. Please sign in.");
    }

    const cats = await client.query<{ id: number }>(
      `SELECT id FROM adventure_categories WHERE slug = ANY($1::text[]) AND is_active`,
      [input.categories],
    );
    if (cats.rowCount !== new Set(input.categories).size) throw new HttpError(422, "One of the selected categories isn't available.");
    const region = await client.query<{ id: number }>(`SELECT id FROM regions WHERE slug = $1`, [input.regionSlug]);
    if (!region.rows[0]) throw new HttpError(422, "Choose where you operate.");

    if (prior) {
      // Re-signup before verifying: refresh credentials + code, keep the same company.
      await client.query(
        `UPDATE company_users SET password_hash = $2, phone = $3, name = $4, otp_code = $5, otp_expires_at = $6 WHERE id = $1`,
        [prior.id, passwordHash, input.phone, input.ownerName, hashOtp("operator", input.email, otp), otpExpiry()],
      );
      await client.query(
        `UPDATE companies SET name = $2, contact_phone = $3, contact_email = $4, address = $5, company_type = $6 WHERE id = $1 AND status = 'pending'`,
        [prior.company_id, input.businessName, input.phone, input.email, input.address ?? null, input.companyType],
      );
      return { companyUserId: prior.id, companyId: prior.company_id, otp };
    }

    const slug = await uniqueCompanySlug(client, input.businessName);
    const company = await client.query<{ id: number }>(
      `INSERT INTO companies (slug, name, contact_email, contact_phone, whatsapp_number, address, status, terms_accepted_at, terms_version, company_type)
       VALUES ($1,$2,$3,$4,$4,$5,'pending',now(),$6,$7) RETURNING id`,
      [slug, input.businessName, input.email, input.phone, input.address ?? null, PARTNER_TERMS_VERSION, input.companyType],
    );
    const companyId = company.rows[0].id;
    const user = await client.query<{ id: number }>(
      `INSERT INTO company_users (company_id, email, phone, name, role, password_hash, otp_code, otp_expires_at)
       VALUES ($1,$2,$3,$4,'owner',$5,$6,$7) RETURNING id`,
      [companyId, input.email, input.phone, input.ownerName, passwordHash, hashOtp("operator", input.email, otp), otpExpiry()],
    );
    for (const c of cats.rows) {
      await client.query(`INSERT INTO company_categories (company_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [companyId, c.id]);
    }
    await client.query(`INSERT INTO company_regions (company_id, region_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [companyId, region.rows[0].id]);
    await client.query(`INSERT INTO company_verification (company_id, address) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [companyId, input.address ?? null]);
    return { companyUserId: user.rows[0].id, companyId, otp };
  });
}

/** Store a fresh OTP for an existing (unverified or resetting) operator. Null if no such account. */
export async function issueOperatorOtp(email: string, scope: "operator" | "operator-reset"): Promise<{ otp: string; name: string | null } | null> {
  const otp = generateOtp();
  const res = await requirePool().query<{ name: string | null; email_verified: boolean }>(
    `UPDATE company_users SET otp_code = $2, otp_expires_at = $3
      WHERE email = $1 AND is_active AND (($4 = 'operator' AND NOT email_verified) OR ($4 = 'operator-reset' AND email_verified))
      RETURNING name, email_verified`,
    [email, hashOtp(scope, email, otp), otpExpiry(), scope],
  );
  return res.rows[0] ? { otp, name: res.rows[0].name } : null;
}

export type VerifiedOperator = { companyUserId: number; companyId: number; tokenVersion: number; companyName: string; firstVerification: boolean };

/** Check the signup OTP and mark the email verified. */
export async function verifyOperatorEmail(email: string, code: string): Promise<VerifiedOperator | null> {
  return withTx(async (client) => {
    const res = await client.query<{
      id: number; company_id: number; otp_code: string | null; otp_expires_at: string | null;
      email_verified: boolean; token_version: number; company_name: string; is_active: boolean;
    }>(
      `SELECT cu.id, cu.company_id, cu.otp_code, cu.otp_expires_at, cu.email_verified, cu.token_version, cu.is_active, c.name AS company_name
         FROM company_users cu JOIN companies c ON c.id = cu.company_id WHERE cu.email = $1 FOR UPDATE OF cu`,
      [email],
    );
    const u = res.rows[0];
    if (!u || !u.is_active || !otpMatches(u.otp_code, "operator", email, code)) return null;
    if (u.otp_expires_at && new Date(u.otp_expires_at) < new Date()) return null;
    await client.query(`UPDATE company_users SET email_verified = TRUE, otp_code = NULL, otp_expires_at = NULL, last_login_at = now() WHERE id = $1`, [u.id]);
    return { companyUserId: u.id, companyId: u.company_id, tokenVersion: u.token_version, companyName: u.company_name, firstVerification: !u.email_verified };
  });
}

/** Email + password login. Null on any failure (callers return one uniform error). */
export async function loginOperator(email: string, password: string): Promise<{ companyUserId: number; tokenVersion: number; emailVerified: boolean } | null> {
  const res = await requirePool().query<{ id: number; password_hash: string | null; email_verified: boolean; is_active: boolean; token_version: number }>(
    `SELECT id, password_hash, email_verified, is_active, token_version FROM company_users WHERE email = $1`,
    [email],
  );
  const u = res.rows[0];
  // Always run a hash comparison so response time doesn't reveal whether the account exists.
  const ok = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !u.is_active || !ok) return null;
  if (u.email_verified) {
    await requirePool().query(`UPDATE company_users SET last_login_at = now() WHERE id = $1`, [u.id]);
  }
  return { companyUserId: u.id, tokenVersion: u.token_version, emailVerified: u.email_verified };
}

// A syntactically valid hash of a random password, used only to equalise timing.
const DUMMY_HASH = "00000000000000000000000000000000:" + "0".repeat(128);

/** Verify the reset OTP, set a new password and invalidate all existing sessions. */
export async function completeOperatorReset(email: string, code: string, newPassword: string): Promise<boolean> {
  const newHash = await hashPassword(newPassword);
  return withTx(async (client) => {
    const res = await client.query<{ id: number; otp_code: string | null; otp_expires_at: string | null; email_verified: boolean }>(
      `SELECT id, otp_code, otp_expires_at, email_verified FROM company_users WHERE email = $1 AND is_active FOR UPDATE`,
      [email],
    );
    const u = res.rows[0];
    if (!u || !u.email_verified || !otpMatches(u.otp_code, "operator-reset", email, code)) return false;
    if (u.otp_expires_at && new Date(u.otp_expires_at) < new Date()) return false;
    await client.query(
      `UPDATE company_users SET password_hash = $2, token_version = token_version + 1, otp_code = NULL, otp_expires_at = NULL WHERE id = $1`,
      [u.id, newHash],
    );
    return true;
  });
}
