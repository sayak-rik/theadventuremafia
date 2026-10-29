import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasDb, testPool, resetMarketplace, publishedRental, publishedSession, createOperator, addPaymentMethod, guest, ipFor } from "../helpers/db";
import { createBooking, createWalkInBooking } from "@/lib/booking/create";
import { operatorTransition, submitPayment, customerCancel, expireLapsedHolds } from "@/lib/booking/transitions";
import { addBlackout } from "@/lib/booking/blackouts";
import { getAvailability } from "@/lib/booking/availability";
import { getBookingForCustomer, listCompanyBookings, companyCounts } from "@/lib/booking/queries";
import { addDaysISO, todayIST } from "@/lib/dates";
import type { CreateBookingInput } from "@/lib/validation/booking";

afterAll(async () => { if (hasDb) { await resetMarketplace(); await testPool().end(); } });

const D = (n: number) => addDaysISO(todayIST(), n);
const book = (listingId: number, over: Record<string, unknown> = {}, ip = ipFor()) =>
  createBooking(guest({ date: D(5), ...over }) as unknown as CreateBookingInput, { listingId, ipHash: ip });
const status = async (id: number) => (await testPool().query(`SELECT status FROM listing_bookings WHERE id = $1`, [id])).rows[0].status;
const held = async (listingId: number, date = D(5), slot: string | null = null) => (await getAvailability(testPool(), listingId, date, date, slot))[0];

describe.skipIf(!hasDb)("createBooking", () => {
  beforeEach(resetMarketplace);

  it("prices on the server: total, rounded advance, balance, deposit", async () => {
    const { listingId } = await publishedRental({ unitPrice: 833, advanceType: "percent", advanceValue: 30, securityDeposit: 1500, unitsTotal: 5 });
    const b = await book(listingId, { quantity: 2 });
    const r = (await testPool().query(`SELECT total_amount, advance_amount, balance_due, deposit_amount, status, title_snapshot, source FROM listing_bookings WHERE id = $1`, [b.id])).rows[0];
    expect(r).toMatchObject({ total_amount: 1666, advance_amount: 500, balance_due: 1166, deposit_amount: 3000, status: "pending_payment", source: "online" }); // 30% of 1666 = 499.8 → ₹500
    expect(b.token.length).toBeGreaterThanOrEqual(22);
    expect(b.code).toMatch(/^BK-[A-Z2-9]{6}$/);
  });

  it("flat advance is clamped to the total", async () => {
    const { listingId } = await publishedRental({ unitPrice: 300, advanceType: "flat", advanceValue: 1000, unitsTotal: 2 });
    const b = await book(listingId);
    const r = (await testPool().query(`SELECT advance_amount, balance_due FROM listing_bookings WHERE id = $1`, [b.id])).rows[0];
    expect(r).toEqual({ advance_amount: 300, balance_due: 0 });
  });

  it("RACE: 10 simultaneous bookings for the last 3 units → exactly 3 succeed", async () => {
    const { listingId } = await publishedRental({ unitsTotal: 3 });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => book(listingId)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toBe(3);
    expect(fail.every((f) => f.reason.status === 409)).toBe(true);
    expect((await held(listingId)).available).toBe(0);
  });

  it("RACE: mixed quantities never oversell", async () => {
    const { listingId } = await publishedRental({ unitsTotal: 5 });
    const qtys = [2, 2, 2, 1, 1, 1, 3, 1];
    const results = await Promise.allSettled(qtys.map((q) => book(listingId, { quantity: q })));
    const bookedQty = qtys.reduce((sum, q, i) => sum + (results[i].status === "fulfilled" ? q : 0), 0);
    expect(bookedQty).toBeLessThanOrEqual(5);
    expect((await held(listingId)).held).toBe(bookedQty);
  });

  it("an expired unpaid hold frees the units without any sweeper", async () => {
    const { listingId } = await publishedRental({ unitsTotal: 1 });
    const first = await book(listingId);
    await expect(book(listingId)).rejects.toMatchObject({ status: 409 });
    await testPool().query(`UPDATE listing_bookings SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`, [first.id]);
    const second = await book(listingId);
    expect(second.id).not.toBe(first.id);
    // The label sync is idempotent and cosmetic.
    expect(await expireLapsedHolds(testPool())).toBe(1);
    expect(await expireLapsedHolds(testPool())).toBe(0);
    expect(await status(first.id)).toBe("expired");
  });

  it("limits unpaid holds per phone (and per IP)", async () => {
    const { listingId } = await publishedRental({ unitsTotal: 10 });
    const phone = "+919111111111";
    await book(listingId, { phone });
    await book(listingId, { phone });
    await expect(book(listingId, { phone })).rejects.toMatchObject({ status: 429 });
    const ip = ipFor();
    for (let i = 0; i < 4; i++) await book(listingId, {}, ip);
    await expect(book(listingId, {}, ip)).rejects.toMatchObject({ status: 429 });
  });

  it("rejects bad dates", async () => {
    const { listingId } = await publishedRental();
    await expect(book(listingId, { date: D(-1) })).rejects.toMatchObject({ status: 422 });
    await expect(book(listingId, { date: D(400) })).rejects.toMatchObject({ status: 422 });
  });

  it("enforces same-day notice", async () => {
    const { listingId } = await publishedRental({ minNoticeHours: 72 });
    await expect(book(listingId, { date: todayIST() })).rejects.toMatchObject({ status: 409 });
  });

  it("only books live listings from approved operators", async () => {
    const { listingId, companyId } = await publishedRental();
    await testPool().query(`UPDATE companies SET status = 'suspended' WHERE id = $1`, [companyId]);
    await expect(book(listingId)).rejects.toMatchObject({ status: 404 });
    await testPool().query(`UPDATE companies SET status = 'approved' WHERE id = $1`, [companyId]);
    await testPool().query(`UPDATE adventure_listings SET status = 'draft' WHERE id = $1`, [listingId]);
    await expect(book(listingId)).rejects.toMatchObject({ status: 404 });
  });

  it("needs a payment method on file", async () => {
    const op = await createOperator({ autoPublish: true });
    await addPaymentMethod(op.companyId);
    const { listingId } = await publishedRental(); // other operator, just to have rows around
    await testPool().query(`DELETE FROM company_payment_settings WHERE company_id = (SELECT company_id FROM adventure_listings WHERE id = $1)`, [listingId]);
    await expect(book(listingId)).rejects.toMatchObject({ status: 409 });
  });

  it("rentals: must confirm they'll bring a licence", async () => {
    const { listingId } = await publishedRental();
    await expect(book(listingId, { hasLicence: false })).rejects.toMatchObject({ status: 422 });
  });
});

describe.skipIf(!hasDb)("sessions", () => {
  beforeEach(resetMarketplace);
  const people = (n: number, weight = 70, age = 30) => Array.from({ length: n }, (_, i) => ({ name: `Person ${i + 1}`, age, weightKg: weight }));

  it("books persons into a slot, validating participants", async () => {
    const { listingId } = await publishedSession();
    const b = await book(listingId, { slotTime: "09:00", quantity: 3, participants: people(3), waiverAccepted: true });
    expect((await held(listingId, D(5), "09:00")).available).toBe(7);
    const r = (await testPool().query(`SELECT quantity, total_amount, waiver_accepted_at, participants FROM listing_bookings WHERE id = $1`, [b.id])).rows[0];
    expect(r.quantity).toBe(3);
    expect(r.total_amount).toBe(4500);
    expect(r.waiver_accepted_at).not.toBeNull();
    expect(r.participants).toHaveLength(3);
  });

  it("enforces weight, age, headcount, waiver and slot rules", async () => {
    const { listingId } = await publishedSession({ minWeightKg: 35, maxWeightKg: 120, minAge: 12, maxAge: 65 });
    const ok = { slotTime: "09:00", quantity: 1, participants: people(1), waiverAccepted: true };
    await expect(book(listingId, { ...ok, participants: people(1, 130) })).rejects.toMatchObject({ status: 422 }); // too heavy
    await expect(book(listingId, { ...ok, participants: people(1, 20) })).rejects.toMatchObject({ status: 422 }); // too light
    await expect(book(listingId, { ...ok, participants: people(1, 70, 8) })).rejects.toMatchObject({ status: 422 }); // too young
    await expect(book(listingId, { ...ok, participants: people(2) })).rejects.toMatchObject({ status: 422 }); // headcount mismatch
    await expect(book(listingId, { ...ok, waiverAccepted: false })).rejects.toMatchObject({ status: 422 });
    await expect(book(listingId, { ...ok, slotTime: null })).rejects.toMatchObject({ status: 422 });
    await expect(book(listingId, { ...ok, slotTime: "13:00" })).rejects.toMatchObject({ status: 409 }); // not a real slot
  });

  it("RACE: 12 people into 10 seats — never more than 10", async () => {
    const { listingId } = await publishedSession();
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => book(listingId, { slotTime: "09:00", quantity: 1, participants: people(1), waiverAccepted: true })));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(10);
    expect((await held(listingId, D(5), "09:00")).available).toBe(0);
  });
});

describe.skipIf(!hasDb)("state machine", () => {
  beforeEach(resetMarketplace);
  const utr = (n: number) => String(300000000000 + n);

  it("happy path: pay → confirm → pick up → return", async () => {
    const { listingId, companyId, companyUserId } = await publishedRental({ unitsTotal: 2 });
    const b = await book(listingId);
    expect((await submitPayment(b.token, utr(1), "Pema")).status).toBe("payment_submitted");
    const actor = { type: "operator" as const, id: companyUserId };
    expect((await operatorTransition({ id: b.id, companyId }, { action: "confirm_payment" }, actor)).status).toBe("confirmed");
    expect((await operatorTransition({ id: b.id, companyId }, { action: "pickup", vehicleReg: "SK04 1234", depositCollected: true }, actor)).status).toBe("picked_up");
    expect((await operatorTransition({ id: b.id, companyId }, { action: "return", depositReturned: true }, actor)).status).toBe("completed");
    const r = (await testPool().query(`SELECT assigned_vehicle_reg, picked_up_at, returned_at, deposit_collected_at, deposit_returned_at, payment_verified_by FROM listing_bookings WHERE id = $1`, [b.id])).rows[0];
    expect(r.assigned_vehicle_reg).toBe("SK04 1234");
    expect([r.picked_up_at, r.returned_at, r.deposit_collected_at, r.deposit_returned_at].every(Boolean)).toBe(true);
    expect(r.payment_verified_by).toBe(companyUserId);
    const events = (await testPool().query(`SELECT to_status FROM booking_events WHERE booking_id = $1 ORDER BY id`, [b.id])).rows.map((e) => e.to_status);
    expect(events).toEqual(["pending_payment", "payment_submitted", "confirmed", "picked_up", "completed"]);
  });

  it("rejects illegal transitions", async () => {
    const { listingId, companyId } = await publishedRental();
    const b = await book(listingId);
    const op = (o: Parameters<typeof operatorTransition>[1]) => operatorTransition({ id: b.id, companyId }, o, { type: "operator" });
    await expect(op({ action: "confirm_payment" })).rejects.toMatchObject({ status: 409 }); // nothing paid yet
    await expect(op({ action: "pickup" })).rejects.toMatchObject({ status: 409 });
    await submitPayment(b.token, utr(2), undefined);
    await expect(submitPayment(b.token, utr(3), undefined)).rejects.toMatchObject({ status: 409 }); // already submitted
    await op({ action: "confirm_payment" });
    await expect(op({ action: "confirm_payment" })).rejects.toMatchObject({ status: 409 });
    await expect(op({ action: "return" })).rejects.toMatchObject({ status: 409 });
  });

  it("double-tap safe: two simultaneous confirms → one wins, one 409, one event", async () => {
    const { listingId, companyId } = await publishedRental();
    const b = await book(listingId);
    await submitPayment(b.token, utr(4), undefined);
    const res = await Promise.allSettled([1, 2].map(() => operatorTransition({ id: b.id, companyId }, { action: "confirm_payment" }, { type: "operator" })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(res.filter((r) => r.status === "rejected")).toHaveLength(1);
    const n = await testPool().query(`SELECT count(*)::int AS n FROM booking_events WHERE booking_id = $1 AND to_status = 'confirmed'`, [b.id]);
    expect(n.rows[0].n).toBe(1);
  });

  it("'payment not received' re-opens payment once, then cancels", async () => {
    const { listingId, companyId } = await publishedRental({ unitsTotal: 1 });
    const b = await book(listingId);
    await submitPayment(b.token, utr(5), undefined);
    expect((await operatorTransition({ id: b.id, companyId }, { action: "reject_payment" }, { type: "operator" })).status).toBe("pending_payment");
    const mid = (await testPool().query(`SELECT payment_ref, hold_expires_at > now() AS live, payment_attempts FROM listing_bookings WHERE id = $1`, [b.id])).rows[0];
    expect(mid).toMatchObject({ payment_ref: null, live: true, payment_attempts: 1 });
    expect((await held(listingId)).available).toBe(0); // still holding the unit while the customer retries

    await submitPayment(b.token, utr(6), undefined);
    expect((await operatorTransition({ id: b.id, companyId }, { action: "reject_payment" }, { type: "operator" })).status).toBe("cancelled");
    expect((await held(listingId)).available).toBe(1); // released
  });

  it("a UTR can back only one live booking per operator (but can be reused across operators)", async () => {
    const a = await publishedRental({ unitsTotal: 3 });
    const b1 = await book(a.listingId);
    const b2 = await book(a.listingId);
    await submitPayment(b1.token, utr(7), undefined);
    await expect(submitPayment(b2.token, utr(7), undefined)).rejects.toMatchObject({ status: 409 });
    expect(await status(b2.id)).toBe("pending_payment"); // untouched by the failed attempt

    const other = await publishedRental({ unitsTotal: 3 });
    const c1 = await book(other.listingId);
    await expect(submitPayment(c1.token, utr(7), undefined)).resolves.toMatchObject({ status: "payment_submitted" });
  });

  it("late payment on an expired hold: revived if units are free, else flagged for rescheduling", async () => {
    const { listingId } = await publishedRental({ unitsTotal: 1 });
    const first = await book(listingId);
    await testPool().query(`UPDATE listing_bookings SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`, [first.id]);
    await expireLapsedHolds(testPool());
    expect(await status(first.id)).toBe("expired");
    expect((await submitPayment(first.token, utr(8), undefined)).status).toBe("payment_submitted"); // unit was free

    const second = await book(listingId, { date: D(6) });
    await testPool().query(`UPDATE listing_bookings SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`, [second.id]);
    await expireLapsedHolds(testPool());
    const taken = await book(listingId, { date: D(6) }); // someone else grabs the freed unit
    expect(taken.id).not.toBe(second.id);
    expect((await submitPayment(second.token, utr(9), undefined)).status).toBe("needs_reschedule");
  });

  it("customers can cancel only an unpaid hold; operators cancel with a refund flag", async () => {
    const { listingId, companyId } = await publishedRental({ unitsTotal: 3 });
    const unpaid = await book(listingId);
    expect((await customerCancel(unpaid.token, "Changed plans")).status).toBe("cancelled");

    const paid = await book(listingId);
    await submitPayment(paid.token, utr(10), undefined);
    await expect(customerCancel(paid.token)).rejects.toMatchObject({ status: 409 });
    await operatorTransition({ id: paid.id, companyId }, { action: "cancel", reason: "Bike broke down" }, { type: "operator" });
    const r = (await testPool().query(`SELECT status, refund_status, cancel_reason FROM listing_bookings WHERE id = $1`, [paid.id])).rows[0];
    expect(r).toEqual({ status: "cancelled", refund_status: "due", cancel_reason: "Bike broke down" });
    await operatorTransition({ id: paid.id, companyId }, { action: "refund_done" }, { type: "operator" });
    expect((await testPool().query(`SELECT refund_status FROM listing_bookings WHERE id = $1`, [paid.id])).rows[0].refund_status).toBe("done");
  });

  it("move: only to a date with room; needs_reschedule becomes confirmed", async () => {
    const { listingId, companyId } = await publishedRental({ unitsTotal: 1 });
    const a = await book(listingId, { date: D(5) });
    await submitPayment(a.token, utr(11), undefined);
    await operatorTransition({ id: a.id, companyId }, { action: "confirm_payment" }, { type: "operator" });
    const blocker = await book(listingId, { date: D(6) });
    await expect(operatorTransition({ id: a.id, companyId }, { action: "move", date: D(6) }, { type: "operator" })).rejects.toMatchObject({ status: 409 });
    await operatorTransition({ id: blocker.id, companyId }, { action: "cancel" }, { type: "operator" });
    expect((await operatorTransition({ id: a.id, companyId }, { action: "move", date: D(6) }, { type: "operator" })).status).toBe("confirmed");
    expect((await held(listingId, D(5))).available).toBe(1);
    expect((await held(listingId, D(6))).available).toBe(0);
  });

  it("TENANT ISOLATION: another operator can't touch or see the booking", async () => {
    const a = await publishedRental();
    const other = await createOperator();
    await addPaymentMethod(other.companyId);
    const b = await book(a.listingId);
    await submitPayment(b.token, utr(12), undefined);
    await expect(operatorTransition({ id: b.id, companyId: other.companyId }, { action: "confirm_payment" }, { type: "operator" })).rejects.toMatchObject({ status: 404 });
    expect(await listCompanyBookings(other.companyId, "action")).toEqual([]);
    expect((await listCompanyBookings(a.companyId, "action")).map((x) => x.id)).toEqual([b.id]);
    expect(await status(b.id)).toBe("payment_submitted");
    await expect(createWalkInBooking(other.companyId, { listingId: a.listingId, date: D(5), quantity: 1, name: "X Y", phone: "+919999999999" })).rejects.toMatchObject({ status: 404 });
  });
});

describe.skipIf(!hasDb)("walk-ins, blackouts and read models", () => {
  beforeEach(resetMarketplace);

  it("a walk-in takes real inventory and is confirmed immediately", async () => {
    const { listingId, companyId } = await publishedRental({ unitsTotal: 2 });
    const w = await createWalkInBooking(companyId, { listingId, date: D(5), quantity: 2, name: "Local Rider", phone: "+919888888888" });
    expect((await held(listingId)).available).toBe(0);
    await expect(book(listingId)).rejects.toMatchObject({ status: 409 });
    expect(await status(w.id)).toBe("confirmed");
  });

  it("a full closure flags paid bookings and releases unpaid holds", async () => {
    const { listingId, companyId, companyUserId } = await publishedRental({ unitsTotal: 5 });
    const paid = await book(listingId);
    await submitPayment(paid.token, "300000000099", undefined);
    await operatorTransition({ id: paid.id, companyId }, { action: "confirm_payment" }, { type: "operator" });
    const unpaid = await book(listingId);
    const otherDay = await book(listingId, { date: D(9) });

    const res = await addBlackout(companyId, listingId, { dateFrom: D(4), dateTo: D(6), reason: "Landslide on the road" }, companyUserId);
    expect(res).toMatchObject({ flagged: 1, releasedHolds: 1 });
    expect(await status(paid.id)).toBe("needs_reschedule");
    expect(await status(unpaid.id)).toBe("cancelled");
    expect(await status(otherDay.id)).toBe("pending_payment");
    expect((await held(listingId)).available).toBe(0); // closed
    await expect(book(listingId)).rejects.toMatchObject({ status: 409 });
  });

  it("a partial block is refused if existing bookings wouldn't fit", async () => {
    const { listingId, companyId, companyUserId } = await publishedRental({ unitsTotal: 3 });
    await book(listingId, { quantity: 2 });
    await expect(addBlackout(companyId, listingId, { dateFrom: D(5), dateTo: D(5), unitsBlocked: 2 }, companyUserId)).rejects.toMatchObject({ status: 409 });
    expect((await testPool().query(`SELECT count(*)::int AS n FROM listing_blackouts WHERE listing_id = $1`, [listingId])).rows[0].n).toBe(0); // rolled back
    await addBlackout(companyId, listingId, { dateFrom: D(5), dateTo: D(5), unitsBlocked: 1 }, companyUserId);
    expect((await held(listingId)).available).toBe(0);
  });

  it("a single slot can be closed for weather", async () => {
    const { listingId, companyId, companyUserId } = await publishedSession({ slots: [
      { time: "09:00", capacity: 10, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null },
      { time: "14:00", capacity: 10, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null }] });
    const p = [{ name: "A B", age: 30, weightKg: 70 }];
    const morning = await book(listingId, { slotTime: "09:00", quantity: 1, participants: p, waiverAccepted: true });
    await submitPayment(morning.token, "300000000055", undefined);
    const afternoon = await book(listingId, { slotTime: "14:00", quantity: 1, participants: p, waiverAccepted: true });
    await addBlackout(companyId, listingId, { dateFrom: D(5), dateTo: D(5), slotTime: "09:00", reason: "Heavy rain" }, companyUserId);
    expect(await status(morning.id)).toBe("needs_reschedule");
    expect(await status(afternoon.id)).toBe("pending_payment");
  });

  it("customer view hides payee details once payment is no longer relevant, and operator counts add up", async () => {
    const { listingId, companyId } = await publishedRental({ unitsTotal: 3 });
    const b = await book(listingId);
    const pending = await getBookingForCustomer(b.token);
    expect(pending?.payTo).toMatchObject({ payeeName: "Test Payee", upiVpa: "test@okaxis" });
    expect(pending).toMatchObject({ status: "pending_payment", advance: 240, balance: 560, total: 800 });
    expect(await getBookingForCustomer("nope")).toBeNull();

    await submitPayment(b.token, "300000000077", undefined);
    await operatorTransition({ id: b.id, companyId }, { action: "confirm_payment" }, { type: "operator" });
    expect((await getBookingForCustomer(b.token))?.payTo).toBeNull();
    expect(await companyCounts(companyId)).toEqual({ action: 0, upcoming: 1 });
  });
});
