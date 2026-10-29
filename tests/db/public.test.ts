import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasDb, testPool, resetMarketplace, publishedRental, publishedSession, insertBooking } from "../helpers/db";
import { queryPublished, queryListingDetail, queryCompanyPage, queryCategories, queryTodayBoard, querySitemapEntries } from "@/lib/listings/public-queries";
import { getPublicAvailability } from "@/lib/booking/public";
import { addDaysISO, todayIST } from "@/lib/dates";

afterAll(async () => { if (hasDb) { await resetMarketplace(); await testPool().end(); } });

describe.skipIf(!hasDb)("public read queries", () => {
  beforeEach(resetMarketplace);

  it("lists only live listings from approved operators, filtered by category and region", async () => {
    const a = await publishedRental({ title: "Activa", makeModel: "Activa" }, { name: "Alpha Rentals" });
    await publishedSession();
    expect((await queryPublished({ categorySlug: "scooty-rental" })).map((l) => l.title)).toEqual(["Activa"]);
    expect((await queryPublished({ categorySlug: "rafting" })).map((l) => l.title)).toEqual(["Teesta River Rafting"]);
    expect(await queryPublished({ categorySlug: "scooty-rental", regionSlug: "gangtok" })).toEqual([]);
    expect(await queryPublished({ regionSlug: "pelling" })).toHaveLength(2);

    await testPool().query(`UPDATE companies SET status = 'suspended' WHERE id = $1`, [a.companyId]);
    expect(await queryPublished({ categorySlug: "scooty-rental" })).toEqual([]);
    await testPool().query(`UPDATE companies SET status = 'approved' WHERE id = $1`, [a.companyId]);
    await testPool().query(`UPDATE adventure_listings SET status = 'deactivated' WHERE id = $1`, [a.listingId]);
    expect(await queryPublished({ categorySlug: "scooty-rental" })).toEqual([]);
  });

  it("card data carries rental specs, cover image and price", async () => {
    await publishedRental({ unitPrice: 900, engineCc: 110, transmission: "automatic", helmetsIncluded: 2, unitsTotal: 4 });
    const [card] = await queryPublished({ categorySlug: "scooty-rental" });
    expect(card).toMatchObject({ unitPrice: 900, engineCc: 110, transmission: "automatic", unitsTotal: 4, helmets: 2, bookingModel: "rental_day", regionName: "Pelling", cover: "/media/c/x/a-t.webp" });
    expect(card.companyName).toBeTruthy();
  });

  it("listing detail returns the full picture, including category-specific extras", async () => {
    const r = await publishedRental({ kmLimitPerDay: 80, docsRequired: ["Original driving licence"] }, { name: "Detail Co" });
    const s = await publishedSession();
    const [card] = await queryPublished({ categorySlug: "scooty-rental" });
    const d = await queryListingDetail(card.companySlug, card.slug);
    expect(d?.rental).toMatchObject({ kmLimitPerDay: 80, docsRequired: ["Original driving licence"], pickupTime: "08:00", returnByTime: "19:00" });
    expect(d?.session).toBeNull();
    expect(d?.images).toHaveLength(1);
    expect(d?.company.name).toBe("Detail Co");
    expect(d?.cancellationPolicy).toMatch(/cancellation/i);

    const [sc] = await queryPublished({ categorySlug: "rafting" });
    const sd = await queryListingDetail(sc.companySlug, sc.slug);
    expect(sd?.session).toMatchObject({ maxWeightKg: 120, minWeightKg: 35, waiverRequired: true, swimRequired: false });
    expect(sd?.rental).toBeNull();
    expect(sd?.slotTimes).toEqual(["09:00"]);
    expect(await queryListingDetail(card.companySlug, "nope")).toBeNull();
    void r; void s;
  });

  it("hides unpublished/suspended listings at the detail and company page level", async () => {
    const r = await publishedRental();
    const [card] = await queryPublished({ categorySlug: "scooty-rental" });
    expect((await queryCompanyPage(card.companySlug))?.listings).toHaveLength(1);
    await testPool().query(`UPDATE companies SET status = 'suspended' WHERE id = $1`, [r.companyId]);
    expect(await queryListingDetail(card.companySlug, card.slug)).toBeNull();
    expect(await queryCompanyPage(card.companySlug)).toBeNull();
    expect(await querySitemapEntries()).toEqual([]);
  });

  it("category summary counts only live listings and reports the lowest price", async () => {
    await publishedRental({ unitPrice: 900 });
    await publishedRental({ unitPrice: 700 });
    const cats = await queryCategories();
    expect(cats.map((c) => c.slug)).toEqual([
      "bike-rental", "scooty-rental", "rafting", "paragliding", "guided-tours", "car-hire",
    ]);
    expect(cats.find((c) => c.slug === "scooty-rental")).toMatchObject({ listings: 2, fromPrice: 700 });
    expect(cats.find((c) => c.slug === "rafting")).toMatchObject({ listings: 0, fromPrice: null });
  });

  it("today board: free units today, and the next open day when today is full", async () => {
    const r = await publishedRental({ unitsTotal: 2, minNoticeHours: 0, pickupTime: "23:59" });
    let row = (await queryTodayBoard()).find((x) => x.categorySlug === "scooty-rental")!;
    expect(row).toMatchObject({ listings: 1, freeToday: 2, next: null });

    await insertBooking({ listingId: r.listingId, companyId: r.companyId, qty: 2, start: todayIST() });
    row = (await queryTodayBoard()).find((x) => x.categorySlug === "scooty-rental")!;
    expect(row.freeToday).toBe(0);
    expect(row.next).toMatchObject({ date: addDaysISO(todayIST(), 1), free: 2 });
  });

  it("public availability respects the notice window and the booking horizon", async () => {
    const r = await publishedRental({ unitsTotal: 2, minNoticeHours: 72 });
    const days = await getPublicAvailability(r.listingId, addDaysISO(todayIST(), -3), addDaysISO(todayIST(), 400));
    expect(days[0].date).toBe(todayIST()); // past days dropped
    expect(days[0].slots[0].available).toBe(0); // inside the notice window
    expect(days.length).toBeLessThanOrEqual(62); // range capped
    await testPool().query(`UPDATE companies SET status = 'pending' WHERE id = $1`, [r.companyId]);
    await expect(getPublicAvailability(r.listingId, todayIST(), todayIST())).rejects.toMatchObject({ status: 404 });
  });
});
