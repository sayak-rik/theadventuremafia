import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasDb, testPool, resetMarketplace, createOperator, addPaymentMethod, addImageRow, insertBooking, rentalInput, sessionInput } from "../helpers/db";
import { forCompany } from "@/lib/listings/repo";
import { rentalListingSchema, sessionListingSchema } from "@/lib/validation/listing";
import { getAvailability } from "@/lib/booking/availability";
import { reviewListing } from "@/lib/listings/moderation";
import { addDaysISO, todayIST } from "@/lib/dates";

afterAll(async () => { if (hasDb) { await resetMarketplace(); await testPool().end(); } });

const FUTURE = addDaysISO(todayIST(), 10);
const rental = (over: Record<string, unknown> = {}) => rentalListingSchema.parse(rentalInput(over));
const session = (over: Record<string, unknown> = {}) => sessionListingSchema.parse(sessionInput(over));

describe.skipIf(!hasDb)("listing validation", () => {
  it("rejects bad rentals", () => {
    expect(() => rental({ unitsTotal: 0 })).toThrow();
    expect(() => rental({ pickupTime: "8am" })).toThrow();
    expect(() => rental({ categorySlug: "rafting" })).toThrow();
    expect(() => rental({ cancellationPolicy: "no" })).toThrow();
  });
  it("requires safety essentials for sessions", () => {
    expect(() => session({ slots: [] })).toThrow();
    expect(() => session({ certification: "" })).toThrow();
    expect(() => session({ minWeightKg: 100, maxWeightKg: 50 })).toThrow();
    expect(() => session({ categorySlug: "paragliding", maxWeightKg: null })).toThrow(); // paragliding needs a max weight
    expect(() => session({ slots: [{ time: "09:00", capacity: 5, daysOfWeek: [1], validFrom: null, validTo: null }, { time: "09:00", capacity: 5, daysOfWeek: [2], validFrom: null, validTo: null }] })).toThrow();
  });
});

describe.skipIf(!hasDb)("listings repo (real Postgres)", () => {
  beforeEach(resetMarketplace);

  it("creates and round-trips a rental listing", async () => {
    const a = await createOperator();
    const repo = forCompany(a.companyId);
    const { id } = await repo.save(null, rental());
    const got = await repo.get(id);
    expect(got.status).toBe("draft");
    expect(got.form).toMatchObject({ kind: "rental_day", makeModel: "Honda Activa 6G", unitsTotal: 3, pickupTime: "08:00", returnByTime: "19:00", unitPrice: 800 });
    const row = await testPool().query(`SELECT pricing_type, availability_type FROM adventure_listings WHERE id = $1`, [id]);
    expect(row.rows[0]).toEqual({ pricing_type: "per_unit_day", availability_type: "open" });
  });

  it("creates and round-trips a rafting session with slots", async () => {
    const a = await createOperator();
    const repo = forCompany(a.companyId);
    const { id } = await repo.save(null, session());
    const got = await repo.get(id);
    expect(got.form).toMatchObject({ kind: "session", rapidsGrade: 3, maxWeightKg: 120 });
    expect((got.form as { slots: unknown[] }).slots).toEqual([{ time: "09:00", capacity: 10, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null }]);
  });

  it("gives colliding titles unique slugs within a company", async () => {
    const a = await createOperator();
    const repo = forCompany(a.companyId);
    const one = await repo.save(null, rental());
    const two = await repo.save(null, rental());
    expect(one.slug).not.toBe(two.slug);
  });

  it("TENANT ISOLATION: operator B can never read or change operator A's listing", async () => {
    const a = await createOperator();
    const b = await createOperator();
    const { id } = await forCompany(a.companyId).save(null, rental());
    const bRepo = forCompany(b.companyId);

    expect(await bRepo.list()).toEqual([]);
    await expect(bRepo.get(id)).rejects.toMatchObject({ status: 404 });
    await expect(bRepo.save(id, rental({ title: "Hijacked" }))).rejects.toMatchObject({ status: 404 });
    await expect(bRepo.submit(id)).rejects.toMatchObject({ status: 404 });
    await expect(bRepo.setActive(id, false)).rejects.toMatchObject({ status: 404 });
    await expect(bRepo.addImage(id, { url: "/x", thumbUrl: "/y", width: 1, height: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(bRepo.removeImage(id, 1)).rejects.toMatchObject({ status: 404 });
    await expect(bRepo.reorderImages(id, [1])).rejects.toMatchObject({ status: 404 });

    const still = await testPool().query(`SELECT title, company_id FROM adventure_listings WHERE id = $1`, [id]);
    expect(still.rows[0]).toMatchObject({ title: "Honda Activa 6G", company_id: a.companyId });
  });

  it("won't let a listing change category or mismatch kind", async () => {
    const a = await createOperator();
    const repo = forCompany(a.companyId);
    const { id } = await repo.save(null, rental());
    await expect(repo.save(id, rental({ categorySlug: "bike-rental" }))).rejects.toMatchObject({ status: 422 });
    await expect(repo.save(null, { ...rental(), kind: "session" } as never)).rejects.toMatchObject({ status: 422 });
  });

  it("submit is gated on photos + payment details (+ slots for sessions)", async () => {
    const a = await createOperator();
    const repo = forCompany(a.companyId);
    const { id } = await repo.save(null, rental());

    const err = await repo.submit(id).catch((e) => e);
    expect(err.status).toBe(422);
    expect(err.extra.missing).toEqual(expect.arrayContaining([expect.stringMatching(/photo/i), expect.stringMatching(/UPI/i)]));

    await addImageRow(id);
    await addPaymentMethod(a.companyId);
    expect(await repo.submit(id)).toBe("pending_review");
    await expect(repo.submit(id)).rejects.toMatchObject({ status: 409 }); // already queued
  });

  it("trusted + approved operators publish immediately; pending operators never do", async () => {
    const trusted = await createOperator({ autoPublish: true });
    const pending = await createOperator({ approved: false });
    for (const op of [trusted, pending]) await addPaymentMethod(op.companyId);

    const t = await forCompany(trusted.companyId).save(null, rental());
    await addImageRow(t.id);
    expect(await forCompany(trusted.companyId).submit(t.id)).toBe("published");

    const p = await forCompany(pending.companyId).save(null, rental());
    await addImageRow(p.id);
    expect(await forCompany(pending.companyId).submit(p.id)).toBe("pending_review");
  });

  it("refuses to drop units below what's already booked", async () => {
    const a = await createOperator();
    const repo = forCompany(a.companyId);
    const { id } = await repo.save(null, rental({ unitsTotal: 3 }));
    await insertBooking({ listingId: id, companyId: a.companyId, qty: 2, start: FUTURE });
    await expect(repo.save(id, rental({ unitsTotal: 1 }))).rejects.toMatchObject({ status: 409 });
    await repo.save(id, rental({ unitsTotal: 2 })); // exactly the booked amount is fine
  });

  it("protects slots that have upcoming bookings", async () => {
    const a = await createOperator();
    const repo = forCompany(a.companyId);
    const slots = [
      { time: "09:00", capacity: 10, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null },
      { time: "14:00", capacity: 10, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null },
    ];
    const { id } = await repo.save(null, session({ slots }));
    await insertBooking({ listingId: id, companyId: a.companyId, qty: 6, start: FUTURE, slot: "14:00" });

    await expect(repo.save(id, session({ slots: [slots[0]] }))).rejects.toMatchObject({ status: 409 }); // remove booked slot
    await expect(repo.save(id, session({ slots: [slots[0], { ...slots[1], capacity: 4 }] }))).rejects.toMatchObject({ status: 409 }); // squeeze below 6
    await repo.save(id, session({ slots: [{ ...slots[0], time: "09:00" }, { ...slots[1], capacity: 6 }] }));
  });

  it("pause / resume: operators can't resume an admin takedown", async () => {
    const a = await createOperator({ autoPublish: true });
    await addPaymentMethod(a.companyId);
    const repo = forCompany(a.companyId);
    const { id } = await repo.save(null, rental());
    await addImageRow(id);
    await repo.submit(id); // -> published

    expect(await repo.setActive(id, false)).toBe("deactivated");
    expect(await repo.setActive(id, true)).toBe("published");

    await reviewListing(id, "deactivate", "Safety complaint");
    await expect(repo.setActive(id, true)).rejects.toMatchObject({ status: 403 });
    await reviewListing(id, "reinstate", undefined);
    expect((await repo.get(id)).status).toBe("published");
  });

  it("caps photos and keeps at least one on a live listing", async () => {
    const a = await createOperator({ autoPublish: true });
    await addPaymentMethod(a.companyId);
    const repo = forCompany(a.companyId);
    const { id } = await repo.save(null, rental());
    const first = await repo.addImage(id, { url: "/m/1.webp", thumbUrl: "/m/1t.webp", width: 10, height: 10 });
    await repo.submit(id);
    await expect(repo.removeImage(id, first.id)).rejects.toMatchObject({ status: 409 });
    for (let i = 0; i < 7; i++) await repo.addImage(id, { url: `/m/${i}.webp`, thumbUrl: `/m/${i}t.webp`, width: 10, height: 10 });
    await expect(repo.addImage(id, { url: "/m/x.webp", thumbUrl: "/m/xt.webp", width: 10, height: 10 })).rejects.toMatchObject({ status: 409 });
  });
});

describe.skipIf(!hasDb)("moderation (real Postgres)", () => {
  beforeEach(resetMarketplace);

  async function queued(approved: boolean) {
    const op = await createOperator({ approved });
    await addPaymentMethod(op.companyId);
    const repo = forCompany(op.companyId);
    const { id } = await repo.save(null, rental());
    await addImageRow(id);
    await repo.submit(id);
    return { op, id, repo };
  }

  it("won't publish for an unapproved operator", async () => {
    const { id } = await queued(false);
    await expect(reviewListing(id, "publish", undefined)).rejects.toMatchObject({ status: 409 });
  });

  it("publish, request changes (needs a note), reject", async () => {
    const { id, repo } = await queued(true);
    await expect(reviewListing(id, "request_changes", " ")).rejects.toMatchObject({ status: 422 });
    const rc = await reviewListing(id, "request_changes", "Add a clearer photo");
    expect(rc).toMatchObject({ status: "changes_requested", note: "Add a clearer photo" });
    expect((await repo.get(id)).moderationNote).toBe("Add a clearer photo");

    await repo.submit(id); // resubmit clears the note
    expect((await repo.get(id)).moderationNote).toBeNull();
    const pub = await reviewListing(id, "publish", undefined);
    expect(pub.status).toBe("published");
    const published = await testPool().query(`SELECT published_at FROM adventure_listings WHERE id = $1`, [id]);
    expect(published.rows[0].published_at).not.toBeNull();
    await expect(reviewListing(id, "request_changes", "late")).rejects.toMatchObject({ status: 409 });
  });
});

describe.skipIf(!hasDb)("availability (derived, real Postgres)", () => {
  beforeEach(resetMarketplace);
  const day = (offset: number) => addDaysISO(FUTURE, offset);

  it("rentals: capacity − held, counting only live holds", async () => {
    const a = await createOperator();
    const { id } = await forCompany(a.companyId).save(null, rental({ unitsTotal: 5 }));
    const book = (o: Omit<Parameters<typeof insertBooking>[0], "listingId" | "companyId">) => insertBooking({ ...o, listingId: id, companyId: a.companyId });

    await book({ status: "confirmed", qty: 2, start: day(0) });
    await book({ status: "payment_submitted", qty: 1, start: day(0) });
    await book({ status: "pending_payment", qty: 1, start: day(0), holdExpires: "now() + interval '10 minutes'" }); // live hold
    await book({ status: "pending_payment", qty: 1, start: day(0), holdExpires: "now() - interval '1 minute'" }); // lapsed: free again
    await book({ status: "cancelled", qty: 3, start: day(0) });
    await book({ status: "expired", qty: 3, start: day(0) });
    await book({ status: "completed", qty: 3, start: day(0) });
    await book({ status: "confirmed", qty: 1, start: day(1), end: day(2) }); // multi-day

    const av = await getAvailability(testPool(), id, day(0), day(3));
    expect(av.map((x) => [x.date, x.held, x.available])).toEqual([
      [day(0), 4, 1], [day(1), 1, 4], [day(2), 1, 4], [day(3), 0, 5],
    ]);
    expect(av[0]).toMatchObject({ slotTime: null, capacity: 5, blocked: 0 });
  });

  it("rentals: partial and full blackouts", async () => {
    const a = await createOperator();
    const { id } = await forCompany(a.companyId).save(null, rental({ unitsTotal: 4 }));
    await testPool().query(`INSERT INTO listing_blackouts (listing_id, date_from, date_to, units_blocked, reason) VALUES ($1,$2,$2,1,'service')`, [id, day(0)]);
    await testPool().query(`INSERT INTO listing_blackouts (listing_id, date_from, date_to, units_blocked, reason) VALUES ($1,$2,$3,NULL,'monsoon')`, [id, day(2), day(3)]);
    await insertBooking({ listingId: id, companyId: a.companyId, qty: 2, start: day(0) });

    const av = await getAvailability(testPool(), id, day(0), day(3));
    expect(av.map((x) => [x.blocked, x.available])).toEqual([[1, 1], [0, 4], [4, 0], [4, 0]]);
  });

  it("sessions: slots respect weekday + validity window; blackouts can target one slot", async () => {
    const a = await createOperator();
    const dow = new Date(`${FUTURE}T00:00:00Z`).getUTCDay();
    const { id } = await forCompany(a.companyId).save(null, session({
      slots: [
        { time: "09:00", capacity: 10, daysOfWeek: [dow], validFrom: null, validTo: null },
        { time: "14:00", capacity: 6, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: day(1), validTo: null },
      ],
    }));
    await insertBooking({ listingId: id, companyId: a.companyId, qty: 4, start: FUTURE, slot: "09:00" });
    await testPool().query(`INSERT INTO listing_blackouts (listing_id, date_from, date_to, slot_time, units_blocked, reason) VALUES ($1,$2,$2,'14:00',NULL,'wind')`, [id, day(2)]);

    const av = await getAvailability(testPool(), id, FUTURE, day(2));
    const key = (x: { date: string; slotTime: string | null }) => `${x.date} ${x.slotTime}`;
    const byKey = Object.fromEntries(av.map((x) => [key(x), x.available]));
    expect(byKey[`${FUTURE} 09:00`]).toBe(6);        // 10 − 4 held
    expect(byKey[`${FUTURE} 14:00`]).toBeUndefined(); // not valid yet
    expect(byKey[`${day(1)} 14:00`]).toBe(6);
    expect(byKey[`${day(2)} 14:00`]).toBe(0);         // slot-specific closure
    expect(byKey[`${day(1)} 09:00`]).toBeUndefined(); // wrong weekday
    expect(av.filter((x) => x.slotTime === "14:00").length).toBe(2);
  });
});
