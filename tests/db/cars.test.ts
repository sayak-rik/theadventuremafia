import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { hasDb, testPool, resetMarketplace, publishedVehicle, guest, ipFor } from "../helpers/db";
import { createBooking } from "@/lib/booking/create";
import { operatorTransition, submitPayment } from "@/lib/booking/transitions";
const actor = { type: "operator" as const };
import { forCompany } from "@/lib/listings/repo";
import { vehicleListingSchema } from "@/lib/validation/listing";
import { addDaysISO, todayIST } from "@/lib/dates";
import type { CreateBookingInput } from "@/lib/validation/booking";
import { vehicleInput } from "../helpers/db";

afterAll(async () => { if (hasDb) { await resetMarketplace(); await testPool().end(); } });

const D = (n: number) => addDaysISO(todayIST(), n);
const bookCar = (listingId: number, over: Record<string, unknown> = {}) =>
  createBooking(guest({ date: D(5), quantity: 1, hasLicence: undefined, ...over }) as unknown as CreateBookingInput, { listingId, ipHash: ipFor() });

describe.skipIf(!hasDb)("cars (route_trip booking model)", () => {
  beforeEach(resetMarketplace);

  it("creates a custom-route vehicle listing with the origin/destination it was given", async () => {
    const { listingId } = await publishedVehicle({ originRegionSlug: "gangtok", destinationRegionSlug: "pelling" });
    const r = (await testPool().query(
      `SELECT g.slug AS origin, p.slug AS destination, vd.units_total, vd.route_catalog_id
         FROM listing_vehicle_details vd JOIN regions g ON g.id = vd.origin_region_id JOIN regions p ON p.id = vd.destination_region_id
        WHERE vd.listing_id = $1`,
      [listingId],
    )).rows[0];
    expect(r).toMatchObject({ origin: "gangtok", destination: "pelling", units_total: 2, route_catalog_id: null });
  });

  it("standardized route: picking a catalog route copies its regions in, and deactivating the catalog later doesn't retroactively break the listing", async () => {
    const route = await testPool().query<{ id: number }>(
      `SELECT id FROM vehicle_route_catalog WHERE origin_region_id = (SELECT id FROM regions WHERE slug = 'siliguri')
         AND destination_region_id = (SELECT id FROM regions WHERE slug = 'pelling')`,
    );
    const routeCatalogId = route.rows[0].id;
    const { listingId } = await publishedVehicle({ routeCatalogId, originRegionSlug: null, destinationRegionSlug: null });
    const before = (await testPool().query(
      `SELECT g.slug AS origin, p.slug AS destination FROM listing_vehicle_details vd
         JOIN regions g ON g.id = vd.origin_region_id JOIN regions p ON p.id = vd.destination_region_id WHERE vd.listing_id = $1`,
      [listingId],
    )).rows[0];
    expect(before).toEqual({ origin: "siliguri", destination: "pelling" });

    await testPool().query(`UPDATE vehicle_route_catalog SET is_active = FALSE WHERE id = $1`, [routeCatalogId]);
    const after = (await testPool().query(
      `SELECT g.slug AS origin, p.slug AS destination FROM listing_vehicle_details vd
         JOIN regions g ON g.id = vd.origin_region_id JOIN regions p ON p.id = vd.destination_region_id WHERE vd.listing_id = $1`,
      [listingId],
    )).rows[0];
    expect(after).toEqual(before); // untouched by deactivation — regions were copied in, not referenced live
  });

  it("rejects a vehicle listing pointed at a deactivated catalog route", async () => {
    const seed = await testPool().query<{ id: number }>(
      `INSERT INTO vehicle_route_catalog (origin_region_id, destination_region_id, is_active)
         SELECT (SELECT id FROM regions WHERE slug = 'gangtok'), (SELECT id FROM regions WHERE slug = 'namchi'), FALSE RETURNING id`,
    );
    const { companyId } = await publishedVehicle({});
    await expect(
      forCompany(companyId).save(null, vehicleListingSchema.parse(vehicleInput({ routeCatalogId: seed.rows[0].id, originRegionSlug: null, destinationRegionSlug: null }))),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("books a car (no licence check, no participants) and runs the full pickup/return lifecycle", async () => {
    const { listingId, companyId } = await publishedVehicle({ unitsTotal: 1 });
    const b = await bookCar(listingId);
    const row = (await testPool().query(`SELECT quantity, participants, status FROM listing_bookings WHERE id = $1`, [b.id])).rows[0];
    expect(row).toMatchObject({ quantity: 1, participants: null, status: "pending_payment" });

    await submitPayment(b.token, "300000000001", "Pema");
    await operatorTransition({ id: b.id, companyId }, { action: "confirm_payment" }, actor);
    await operatorTransition({ id: b.id, companyId }, { action: "pickup" }, actor);
    const r = await operatorTransition({ id: b.id, companyId }, { action: "return" }, actor);
    expect(r.status).toBe("completed");
  });

  it("a single-vehicle route is fully booked after one booking", async () => {
    const { listingId } = await publishedVehicle({ unitsTotal: 1 });
    await bookCar(listingId);
    await expect(bookCar(listingId)).rejects.toMatchObject({ status: 409 });
  });
});
