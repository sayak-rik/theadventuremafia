import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasDb, testPool, resetMarketplace, publishedTour, guest, ipFor } from "../helpers/db";
import { createBooking } from "@/lib/booking/create";
import { getAvailability } from "@/lib/booking/availability";
import { getPublicAvailability } from "@/lib/booking/public";
import { addDaysISO, todayIST } from "@/lib/dates";
import type { CreateBookingInput } from "@/lib/validation/booking";

afterAll(async () => { if (hasDb) { await resetMarketplace(); await testPool().end(); } });

const D = (n: number) => addDaysISO(todayIST(), n);
const participants = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Guest ${i + 1}`, age: 30, weightKg: 70 }));
const bookTour = (listingId: number, date: string, over: Record<string, unknown> = {}) =>
  createBooking(
    guest({ date, slotTime: "06:00", quantity: 2, participants: participants(2), waiverAccepted: true, hasLicence: undefined, ...over }) as unknown as CreateBookingInput,
    { listingId, ipHash: ipFor() },
  );

describe.skipIf(!hasDb)("tours (departure booking model)", () => {
  beforeEach(resetMarketplace);

  it("books a departure and prices it like a single-day booking, spanning duration_days", async () => {
    const { listingId } = await publishedTour({
      unitPrice: 12000, durationDays: 3,
      slots: [{ time: "06:00", capacity: 8, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null }],
    });
    const start = D(5);
    const b = await bookTour(listingId, start);
    const r = (await testPool().query(
      `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, status FROM listing_bookings WHERE id = $1`,
      [b.id],
    )).rows[0];
    expect(r.start_date).toBe(start);
    expect(r.end_date).toBe(D(7)); // start + 3 days - 1
    expect(r.status).toBe("pending_payment");
  });

  it("CRITICAL: a different departure's cohort never steals another departure's capacity, even when their multi-day spans overlap", async () => {
    // 7-day tour, capacity 1, departures allowed any day of the week.
    const { listingId } = await publishedTour({
      durationDays: 7, groupMin: 1,
      slots: [{ time: "06:00", capacity: 1, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null }],
    });
    const mondayDeparture = D(10); // spans [D(10) .. D(16)]
    const thursdayDeparture = D(13); // spans [D(13) .. D(19)] — overlaps the Monday cohort's span on D(13..16)
    const solo = { quantity: 1, participants: participants(1) };

    // Monday's single spot is taken.
    await bookTour(listingId, mondayDeparture, solo);
    expect((await getAvailability(testPool(), listingId, mondayDeparture, mondayDeparture, "06:00", "exact_start"))[0].available).toBe(0);

    // Thursday's departure is a totally independent cohort — it must still have its own capacity,
    // even though D(13) falls inside the Monday cohort's [D(10)..D(16)] date range.
    const thu = await bookTour(listingId, thursdayDeparture, solo);
    expect(thu.id).toBeTypeOf("number");
    expect((await getAvailability(testPool(), listingId, thursdayDeparture, thursdayDeparture, "06:00", "exact_start"))[0].available).toBe(0);

    // A second attempt at either same departure date correctly fails — capacity is per departure, not infinite.
    await expect(bookTour(listingId, mondayDeparture, solo)).rejects.toMatchObject({ status: 409 });
    await expect(bookTour(listingId, thursdayDeparture, solo)).rejects.toMatchObject({ status: 409 });
  });

  it("CRITICAL: the public availability preview (used by the browse page) also isolates departures correctly, not just createBooking", async () => {
    const { listingId } = await publishedTour({
      durationDays: 7, groupMin: 1,
      slots: [{ time: "06:00", capacity: 1, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null }],
    });
    const mondayDeparture = D(10);
    const thursdayDeparture = D(13); // overlaps the Monday cohort's [D(10)..D(16)] span
    await bookTour(listingId, mondayDeparture, { quantity: 1, participants: participants(1) });

    const days = await getPublicAvailability(listingId, thursdayDeparture, thursdayDeparture);
    expect(days[0]?.slots[0]?.available).toBe(1); // Thursday's own spot, unaffected by Monday's booking
  });

  it("requires one participant per seat, and rejects a mismatched count", async () => {
    const { listingId } = await publishedTour();
    await expect(bookTour(listingId, D(5), { quantity: 3, participants: participants(2) })).rejects.toMatchObject({ status: 422 });
  });

  it("enforces group size limits", async () => {
    const { listingId } = await publishedTour({ groupMin: 4 });
    await expect(bookTour(listingId, D(5), { quantity: 2, participants: participants(2) })).rejects.toMatchObject({ status: 422 });
  });
});
