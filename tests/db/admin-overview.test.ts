import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasDb, testPool, resetMarketplace, publishedRental, insertBooking } from "../helpers/db";
import { getOverviewStats, listAdminBookings } from "@/lib/booking/admin-overview";
import { addDaysISO, todayIST } from "@/lib/dates";

afterAll(async () => { if (hasDb) { await resetMarketplace(); await testPool().end(); } });

describe.skipIf(!hasDb)("admin marketplace overview", () => {
  beforeEach(resetMarketplace);

  it("flags unconfirmed payments only once they are stale, plus refunds due and bookings needing a new day", async () => {
    const { listingId, companyId } = await publishedRental({ unitsTotal: 20 });
    const day = addDaysISO(todayIST(), 4);
    const p = testPool();
    for (const status of ["payment_submitted", "payment_submitted", "needs_reschedule", "cancelled", "confirmed"]) {
      await insertBooking({ listingId, companyId, status, start: day });
    }
    const ids = (await p.query(`SELECT id FROM listing_bookings ORDER BY id`)).rows.map((r) => r.id);
    await p.query(`UPDATE listing_bookings SET payment_submitted_at = now() - interval '3 hours' WHERE id = $1`, [ids[0]]); // stale
    await p.query(`UPDATE listing_bookings SET payment_submitted_at = now() - interval '10 minutes' WHERE id = $1`, [ids[1]]); // fresh
    await p.query(`UPDATE listing_bookings SET refund_status = 'due' WHERE id = $1`, [ids[3]]);

    const rows = await listAdminBookings("attention");
    expect(rows.map((r) => r.id).sort()).toEqual([ids[0], ids[2], ids[3]].sort());
    expect(rows.find((r) => r.id === ids[0])!.hoursWaiting).toBeGreaterThanOrEqual(3);

    const stats = await getOverviewStats();
    expect(stats).toMatchObject({ staleCount: 1, refundsDue: 1, needsReschedule: 1, total30: 5 });
    expect(stats.confirmed30).toBe(1);
    expect(stats.advanceConfirmed30).toBe(30); // only the one confirmed online booking (₹30 advance in the helper) counts
  });

  it("lists the latest bookings newest first and respects the limit", async () => {
    const { listingId, companyId } = await publishedRental({ unitsTotal: 20 });
    const day = addDaysISO(todayIST(), 4);
    for (let i = 0; i < 4; i++) await insertBooking({ listingId, companyId, status: "confirmed", start: day });
    const rows = await listAdminBookings("recent", 3);
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBeGreaterThan(rows[2].id);
  });
});
