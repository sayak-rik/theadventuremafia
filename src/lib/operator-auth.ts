import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { requirePool } from "./db";
import { getSecret, safeEqual } from "./secrets";
import { HttpError, handleError, type RouteCtx } from "./api";
import { sameOrigin } from "./http";
export { hashPassword, verifyPassword } from "./password";

// Company-operator session. Cookie = "<companyUserId>.<issuedAt>.<tokenVersion>.<sig>"
// (sig = HMAC over the first three parts). Only *identity* lives in the cookie:
// company_id, role and company status are re-read from the database on every
// request, and bumping company_users.token_version (password reset / payment
// detail change) invalidates every outstanding session.
export const OPERATOR_COOKIE = "tam_operator";
export const OPERATOR_SESSION_DAYS = 30;

const secret = () => getSecret("OPERATOR_SESSION_SECRET", "tam-operator-dev-secret");

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
}

export function operatorCookieValue(companyUserId: number, tokenVersion: number, issuedAtSec = Math.floor(Date.now() / 1000)): string {
  const payload = `${companyUserId}.${issuedAtSec}.${tokenVersion}`;
  return `${payload}.${sign(payload)}`;
}

export const operatorCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * OPERATOR_SESSION_DAYS,
};

/** Parse + verify the signature and age. Does not hit the database. */
export function parseOperatorCookie(raw: string | undefined, nowSec = Math.floor(Date.now() / 1000)) {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [idStr, iatStr, verStr, sig] = parts;
  if (!safeEqual(sign(`${idStr}.${iatStr}.${verStr}`), sig)) return null;
  const id = Number(idStr);
  const iat = Number(iatStr);
  const tokenVersion = Number(verStr);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(iat) || !Number.isInteger(tokenVersion)) return null;
  if (nowSec - iat > OPERATOR_SESSION_DAYS * 86_400 || iat > nowSec + 300) return null;
  return { id, iat, tokenVersion };
}

export type OperatorSession = {
  companyUserId: number;
  companyId: number;
  role: string;
  email: string;
  name: string | null;
  companyName: string;
  companySlug: string;
  /** pending | approved | rejected | suspended */
  companyStatus: string;
  autoPublish: boolean;
  /** 'operator' | 'driver' — same session/approval/payment machinery either way. */
  companyType: string;
};

/**
 * The authenticated operator, or null. Memoised per request, so call it freely.
 * Every dashboard page and /api/operator route must derive company scope from
 * here — never from the URL or request body.
 */
export const getOperatorSession = cache(async (): Promise<OperatorSession | null> => {
  const jar = await cookies();
  const parsed = parseOperatorCookie(jar.get(OPERATOR_COOKIE)?.value);
  if (!parsed) return null;

  const res = await requirePool().query<{
    id: number; company_id: number; role: string; is_active: boolean; email_verified: boolean; token_version: number;
    email: string; name: string | null; status: string; company_name: string; slug: string; auto_publish_listings: boolean; company_type: string;
  }>(
    `SELECT cu.id, cu.company_id, cu.role, cu.is_active, cu.email_verified, cu.token_version, cu.email, cu.name,
            c.status, c.name AS company_name, c.slug, c.auto_publish_listings, c.company_type
       FROM company_users cu JOIN companies c ON c.id = cu.company_id
      WHERE cu.id = $1`,
    [parsed.id],
  );
  const row = res.rows[0];
  if (!row || !row.is_active || !row.email_verified || row.token_version !== parsed.tokenVersion) return null;

  return {
    companyUserId: row.id,
    companyId: row.company_id,
    role: row.role,
    email: row.email,
    name: row.name,
    companyName: row.company_name,
    companySlug: row.slug,
    companyStatus: row.status,
    autoPublish: row.auto_publish_listings,
    companyType: row.company_type,
  };
});

/** Server-component guard: send anonymous visitors to the login page. */
export async function requireOperatorPage(): Promise<OperatorSession> {
  const session = await getOperatorSession();
  if (!session) redirect("/dashboard/login");
  return session;
}

/**
 * Wraps an /api/operator route: Origin check on mutations, session required,
 * optional "company must be approved" gate (a suspended/rejected/pending
 * operator can still read, but not create bookings or publish).
 */
export function operatorRoute<P extends Record<string, string> = Record<string, string>>(
  handler: (req: Request, session: OperatorSession, params: P) => Promise<Response>,
  opts: { requireApproved?: boolean } = {},
) {
  return async (req: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) throw new HttpError(403, "Forbidden.");
      const session = await getOperatorSession();
      if (!session) throw new HttpError(401, "Please sign in.");
      if (opts.requireApproved && session.companyStatus !== "approved") {
        throw new HttpError(403, "Your account is awaiting approval, so this isn't available yet.");
      }
      return await handler(req, session, await ctx.params);
    } catch (err) {
      return handleError(err);
    }
  };
}
