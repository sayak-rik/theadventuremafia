import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasDb, testPool, resetMarketplace, publishedSession, insertBooking } from "../helpers/db";
import { runSweep } from "@/lib/booking/sweep";
import { addDaysISO, todayIST } from "@/lib/dates";

afterAll(async () => { if (hasDb) { await resetMarketplace(); await testPool().end(); } });

const people = JSON.stringify([{ name: "Karma", age: 30, weightKg: 70 }, { name: "Sonam", age: 28, weightKg: 62 }]);

describe.skipIf(!hasDb)("runSweep", () => {
  beforeEach(resetMarketplace);

  it("labels lapsed unpaid holds as expired, leaves live holds and paid bookings alone", async () => {
    const { listingId, companyId } = await publishedSession();
    const day = addDaysISO(todayIST(), 3);
    await insertBooking({ listingId, companyId, status: "pending_payment", start: day, slot: "09:00", holdExpires: "now() - interval '5 minutes'" });
    await insertBooking({ listingId, companyId, status: "pending_payment", start: day, slot: "09:00", holdExpires: "now() + interval '20 minutes'" });
    await insertBooking({ listingId, companyId, status: "payment_submitted", start: day, slot: "09:00", holdExpires: "now() - interval '5 minutes'" });

    const r = await runSweep();
    expect(r.expiredHolds).toBe(1);
    const rows = (await testPool().query(`SELECT status, count(*)::int AS n FROM listing_bookings GROUP BY status ORDER BY status`)).rows;
    expect(rows).toEqual([{ status: "expired", n: 1 }, { status: "payment_submitted", n: 1 }, { status: "pending_payment", n: 1 }]);
    expect((await runSweep()).expiredHolds).toBe(0); // idempotent
  });

  it("strips age and weight 90 days after a booking ends, keeps names, and never touches live or recent bookings", async () => {
    const { listingId, companyId } = await publishedSession();
    const day = addDaysISO(todayIST(), 3);
    for (const status of ["completed", "confirmed", "completed"]) await insertBooking({ listingId, companyId, status, start: day, slot: "09:00" });
    const p = testPool();
    await p.query(`UPDATE listing_bookings SET participants = $1::jsonb`, [people]);
    // Only the first completed booking is old enough.
    await p.query(`UPDATE listing_bookings SET updated_at = now() - interval '91 days' WHERE id = (SELECT min(id) FROM listing_bookings)`);

    expect((await runSweep()).scrubbedParticipants).toBe(1);
    const rows = (await p.query(`SELECT status, participants FROM listing_bookings ORDER BY id`)).rows;
    expect(rows[0].participants).toEqual([{ name: "Karma" }, { name: "Sonam" }]);
    expect(rows[1].participants).toHaveLength(2);
    expect(rows[1].participants[0]).toMatchObject({ age: 30, weightKg: 70 });
    expect(rows[2].participants[0]).toMatchObject({ weightKg: 70 });
    expect((await runSweep()).scrubbedParticipants).toBe(0); // idempotent
  });

  it("clears spent one-time codes but keeps ones that are still valid", async () => {
    const { companyUserId: ownerId } = await publishedSession();
    const p = testPool();
    await p.query(`UPDATE company_users SET otp_code = 'abc', otp_expires_at = now() - interval '1 minute' WHERE id = $1`, [ownerId]);
    expect((await runSweep()).clearedOtps).toBeGreaterThanOrEqual(1);
    expect((await p.query(`SELECT otp_code FROM company_users WHERE id = $1`, [ownerId])).rows[0].otp_code).toBeNull();

    await p.query(`UPDATE company_users SET otp_code = 'abc', otp_expires_at = now() + interval '5 minutes' WHERE id = $1`, [ownerId]);
    await runSweep();
    expect((await p.query(`SELECT otp_code FROM company_users WHERE id = $1`, [ownerId])).rows[0].otp_code).toBe("abc");
  });
});
