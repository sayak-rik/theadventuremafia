import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { hasDb, testPool, resetMarketplace, uniq } from "../helpers/db";
import { signupSchema } from "@/lib/validation/operator";
import {
  registerOperator, verifyOperatorEmail, loginOperator, issueOperatorOtp, completeOperatorReset,
} from "@/lib/operators/service";
import { applyOperatorAction, getApplicationSummary } from "@/lib/operators/admin";
import { rateLimit } from "@/lib/rate-limit";

// Close the pool once, after every suite in this file has run.
afterAll(async () => { if (hasDb) await testPool().end(); });

const signup = (over: Record<string, unknown> = {}) =>
  signupSchema.parse({
    businessName: "Himal Rentals", ownerName: "Tashi Sherpa", email: `${uniq("t")}@example.com`, phone: "98765 43210",
    password: "correct-horse-1", categories: ["scooty-rental", "bike-rental"], regionSlug: "pelling", address: "Main Bazaar, Pelling",
    acceptTerms: true, ...over,
  });

describe.skipIf(!hasDb)("operator accounts (real Postgres)", () => {
  beforeAll(resetMarketplace);
  beforeEach(resetMarketplace);
  afterAll(resetMarketplace);

  it("normalises phone numbers and rejects bad ones", () => {
    expect(signup().phone).toBe("+919876543210");
    expect(() => signup({ phone: "12345" })).toThrow();
    expect(signup({ phone: "+44 7911 123456" }).phone).toBe("+447911123456");
  });

  it("signs up as pending, verifies by OTP, and can then log in", async () => {
    const input = signup();
    const { otp, companyId } = await registerOperator(input);

    const co = await testPool().query(`SELECT status, contact_phone, terms_version FROM companies WHERE id = $1`, [companyId]);
    expect(co.rows[0]).toMatchObject({ status: "pending", contact_phone: "+919876543210" });
    expect(co.rows[0].terms_version).toBeTruthy();

    // Not usable until the email is verified.
    expect((await loginOperator(input.email, input.password))?.emailVerified).toBe(false);

    // Wrong code fails, right code works once.
    expect(await verifyOperatorEmail(input.email, "000000")).toBeNull();
    const v = await verifyOperatorEmail(input.email, otp);
    expect(v).toMatchObject({ companyId, firstVerification: true });
    expect(await verifyOperatorEmail(input.email, otp)).toBeNull();

    expect((await loginOperator(input.email, input.password))?.emailVerified).toBe(true);
    expect(await loginOperator(input.email, "wrong-password")).toBeNull();
    expect(await loginOperator("nobody@example.com", "whatever-1234")).toBeNull();
  });

  it("stores only a hash of the OTP", async () => {
    const input = signup();
    const { otp } = await registerOperator(input);
    const row = await testPool().query(`SELECT otp_code FROM company_users WHERE email = $1`, [input.email]);
    expect(row.rows[0].otp_code).not.toContain(otp);
    expect(row.rows[0].otp_code).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects an expired OTP", async () => {
    const input = signup();
    const { otp } = await registerOperator(input);
    await testPool().query(`UPDATE company_users SET otp_expires_at = now() - interval '1 minute' WHERE email = $1`, [input.email]);
    expect(await verifyOperatorEmail(input.email, otp)).toBeNull();
  });

  it("blocks duplicate verified emails but lets an unverified attempt be refreshed", async () => {
    const input = signup();
    const first = await registerOperator(input);
    const again = await registerOperator({ ...input, password: "another-pass-9" });
    expect(again.companyId).toBe(first.companyId); // same company, no duplicate
    const v = await verifyOperatorEmail(input.email, again.otp);
    expect(v).not.toBeNull();
    await expect(registerOperator(input)).rejects.toMatchObject({ status: 409 });
  });

  it("creates company slugs safely (reserved words, collisions)", async () => {
    const a = await registerOperator(signup({ businessName: "Admin" }));
    const b = await registerOperator(signup({ businessName: "Himal Rentals" }));
    const c = await registerOperator(signup({ businessName: "Himal Rentals" }));
    const slugs = (await testPool().query(`SELECT slug FROM companies WHERE id = ANY($1)`, [[a.companyId, b.companyId, c.companyId]])).rows.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(3);
    expect(slugs).not.toContain("admin");
  });

  it("links the chosen categories and region", async () => {
    const { companyId } = await registerOperator(signup());
    const s = await getApplicationSummary(companyId);
    expect(s?.categories.sort()).toEqual(["Bike Rentals", "Scooty Rentals"]);
    const regions = await testPool().query(`SELECT r.slug FROM company_regions cr JOIN regions r ON r.id = cr.region_id WHERE cr.company_id = $1`, [companyId]);
    expect(regions.rows.map((r) => r.slug)).toEqual(["pelling"]);
  });

  it("password reset needs a reset-scoped code, bumps token_version, and invalidates the old password", async () => {
    const input = signup();
    const { otp } = await registerOperator(input);
    await verifyOperatorEmail(input.email, otp);

    // The signup OTP scope can't be used to reset.
    expect(await issueOperatorOtp(input.email, "operator")).toBeNull(); // already verified
    const reset = await issueOperatorOtp(input.email, "operator-reset");
    expect(reset).not.toBeNull();
    expect(await completeOperatorReset(input.email, "123456", "new-password-77")).toBe(false);

    const before = (await loginOperator(input.email, input.password))!;
    expect(await completeOperatorReset(input.email, reset!.otp, "new-password-77")).toBe(true);
    expect(await loginOperator(input.email, input.password)).toBeNull();
    const after = (await loginOperator(input.email, "new-password-77"))!;
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);
    // Single use.
    expect(await completeOperatorReset(input.email, reset!.otp, "yet-another-1")).toBe(false);
  });

  it("admin lifecycle: approve, reject needs a reason, suspend only approved, audit logged", async () => {
    const { companyId } = await registerOperator(signup());
    await expect(applyOperatorAction(companyId, "suspend", { reason: "x" })).rejects.toMatchObject({ status: 409 });
    await expect(applyOperatorAction(companyId, "reject", {})).rejects.toMatchObject({ status: 422 });

    expect((await applyOperatorAction(companyId, "approve", {})).status).toBe("approved");
    await expect(applyOperatorAction(companyId, "approve", {})).rejects.toMatchObject({ status: 409 });
    expect((await applyOperatorAction(companyId, "suspend", { reason: "Complaints" })).status).toBe("suspended");
    expect((await applyOperatorAction(companyId, "reinstate", {})).status).toBe("approved");
    await applyOperatorAction(companyId, "set_auto_publish", { value: true });

    const log = await testPool().query(`SELECT action FROM audit_log WHERE company_id = $1 ORDER BY id`, [companyId]);
    expect(log.rows.map((r) => r.action)).toEqual(["operator.approve", "operator.suspend", "operator.reinstate", "operator.set_auto_publish"]);
  });

  it("drivers reuse the exact same signup/verify/login pipeline as operators, tagged by company_type", async () => {
    const input = signup({ categories: ["car-hire"], companyType: "driver" });
    expect(input.companyType).toBe("driver");
    const { otp, companyId } = await registerOperator(input);
    const co = await testPool().query(`SELECT company_type FROM companies WHERE id = $1`, [companyId]);
    expect(co.rows[0].company_type).toBe("driver");

    await verifyOperatorEmail(input.email, otp);
    expect((await loginOperator(input.email, input.password))).not.toBeNull();

    // Defaults to 'operator' when omitted — existing operator signup is untouched.
    const opInput = signup();
    expect(opInput.companyType).toBe("operator");
  });
});

describe.skipIf(!hasDb)("rate limiting (real Postgres)", () => {
  beforeEach(resetMarketplace);

  it("allows up to max, then blocks with a retry-after, per key", async () => {
    const key = uniq("rl");
    for (let i = 0; i < 3; i++) expect((await rateLimit(key, 3, 60)).ok).toBe(true);
    const blocked = await rateLimit(key, 3, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect((await rateLimit(uniq("other"), 3, 60)).ok).toBe(true);
  });

  it("starts a fresh window after it expires", async () => {
    const key = uniq("rl");
    await rateLimit(key, 1, 60);
    expect((await rateLimit(key, 1, 60)).ok).toBe(false);
    await testPool().query(`UPDATE rate_limits SET window_start = now() - interval '2 minutes' WHERE key = $1`, [key]);
    expect((await rateLimit(key, 1, 60)).ok).toBe(true);
  });
});
