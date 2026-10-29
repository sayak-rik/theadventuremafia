import { Pool } from "pg";

export const hasDb = Boolean(process.env.TEST_DATABASE_URL);

// Point the app's shared pool at the throwaway test database *before* any
// app module reads DATABASE_URL.
if (hasDb) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

let pool: Pool | null = null;
export function testPool(): Pool {
  pool ??= new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 20 });
  return pool;
}

/** Remove everything the tests created (keeps seed taxonomy + Company #1). */
export async function resetMarketplace() {
  const p = testPool();
  await p.query(`DELETE FROM listing_bookings`);
  await p.query(`DELETE FROM adventure_listings`);
  await p.query(`DELETE FROM companies WHERE NOT is_seed`);
  await p.query(`DELETE FROM rate_limits`);
  await p.query(`DELETE FROM audit_log`);
}

let n = 0;
export const uniq = (prefix: string) => `${prefix}${Date.now().toString(36)}${(n++).toString(36)}`;

export const rentalInput = (over: Record<string, unknown> = {}) => ({
  kind: "rental_day" as const,
  categorySlug: "scooty-rental" as const,
  title: "Honda Activa 6G",
  description: "Easy automatic scooter, perfect for Pelling's town roads and nearby viewpoints.",
  regionSlug: "pelling",
  unitPrice: 800,
  advanceType: "percent" as const,
  advanceValue: 30,
  minNoticeHours: 2,
  meetingPoint: "Near the helipad",
  cancellationPolicy: "Free cancellation up to 24 hours before pickup.",
  safetyNotes: undefined,
  inclusions: ["Helmet"],
  exclusions: ["Fuel"],
  makeModel: "Honda Activa 6G",
  engineCc: 110,
  transmission: "automatic" as const,
  fuelType: "petrol" as const,
  unitsTotal: 3,
  securityDeposit: 1500,
  helmetsIncluded: 2,
  kmLimitPerDay: 80,
  fuelPolicy: "Return with same fuel",
  docsRequired: ["Original driving licence"],
  pickupTime: "08:00",
  returnByTime: "19:00",
  lateFeePerHour: 100,
  areaRestrictions: undefined,
  ...over,
});

export const sessionInput = (over: Record<string, unknown> = {}) => ({
  kind: "session" as const,
  categorySlug: "rafting" as const,
  title: "Teesta River Rafting",
  description: "Grade III-IV rapids with certified guides, safety kayaker and full gear included.",
  regionSlug: "pelling",
  unitPrice: 1500,
  advanceType: "percent" as const,
  advanceValue: 30,
  minNoticeHours: 4,
  meetingPoint: "Pelling main taxi stand",
  cancellationPolicy: "Full refund if cancelled for weather.",
  safetyNotes: "Life jackets and helmets mandatory.",
  inclusions: ["Guide", "Life jacket"],
  exclusions: [],
  durationHours: 3,
  difficulty: "moderate" as const,
  groupMin: 1,
  groupMax: 8,
  minAge: 12,
  maxAge: 65,
  minWeightKg: 35,
  maxWeightKg: 120,
  rapidsGrade: 3,
  stretchName: "Teesta",
  distanceKm: 12,
  flightMinutes: null,
  takeoffAltitudeM: null,
  swimRequired: false,
  certification: "Guides hold IMF-certified rafting guide licences",
  equipmentNotes: undefined,
  waiverRequired: true,
  weatherDependent: true,
  season: "Oct–May",
  slots: [{ time: "09:00", capacity: 10, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: null, validTo: null }],
  ...over,
});

import { signupSchema } from "@/lib/validation/operator";
import { registerOperator, verifyOperatorEmail } from "@/lib/operators/service";
import { applyOperatorAction } from "@/lib/operators/admin";

export async function createOperator(opts: { approved?: boolean; autoPublish?: boolean; name?: string; categories?: string[] } = {}) {
  const email = `${uniq("op")}@example.com`;
  const input = signupSchema.parse({
    businessName: opts.name ?? `Shop ${uniq("")}`, ownerName: "Owner Person", email, phone: "9876543210",
    password: "correct-horse-1", categories: opts.categories ?? ["scooty-rental", "bike-rental", "rafting", "paragliding"],
    regionSlug: "pelling", acceptTerms: true,
  });
  const { otp, companyId, companyUserId } = await registerOperator(input);
  await verifyOperatorEmail(email, otp);
  if (opts.approved !== false) await applyOperatorAction(companyId, "approve", {});
  if (opts.autoPublish) await applyOperatorAction(companyId, "set_auto_publish", { value: true });
  return { companyId, companyUserId, email };
}

export async function addPaymentMethod(companyId: number) {
  await testPool().query(
    `INSERT INTO company_payment_settings (company_id, payee_name, upi_vpa) VALUES ($1,'Test Payee','test@okaxis')
     ON CONFLICT (company_id) DO UPDATE SET upi_vpa = 'test@okaxis'`, [companyId]);
}

export async function addImageRow(listingId: number) {
  await testPool().query(`INSERT INTO listing_images (listing_id, url, thumb_url, width, height) VALUES ($1,'/media/c/x/a.webp','/media/c/x/a-t.webp',1200,800)`, [listingId]);
}

let seq = 0;
export async function insertBooking(o: {
  listingId: number; companyId: number; status?: string; qty?: number; start: string; end?: string; slot?: string | null;
  holdExpires?: string | null; // SQL expression, e.g. "now() + interval '10 minutes'"
}) {
  seq++;
  await testPool().query(
    `INSERT INTO listing_bookings (token, code, company_id, listing_id, status, customer_name, customer_phone, start_date, end_date, slot_time,
        quantity, unit_price, total_amount, advance_amount, balance_due, title_snapshot, hold_expires_at)
     VALUES ($1,$2,$3,$4,$5,'Test Customer','+919999999999',$6,$7,$8,$9,100,100,30,70,'Test', ${o.holdExpires ?? "NULL"})`,
    [`tok${Date.now()}${seq}`, `BK-T${seq}`.padEnd(9, "X"), o.companyId, o.listingId, o.status ?? "confirmed", o.start, o.end ?? o.start, o.slot ?? null, o.qty ?? 1],
  );
}

import { forCompany } from "@/lib/listings/repo";
import { rentalListingSchema, sessionListingSchema, tourListingSchema, vehicleListingSchema } from "@/lib/validation/listing";

export const tourInput = (over: Record<string, unknown> = {}) => ({
  kind: "departure" as const,
  categorySlug: "guided-tours" as const,
  title: "Classic Sikkim Circuit",
  description: "A guided loop through Gangtok, Lachung and Pelling with a fixed departure crew.",
  regionSlug: "gangtok",
  unitPrice: 12000,
  advanceType: "percent" as const,
  advanceValue: 30,
  minNoticeHours: 24,
  meetingPoint: "Gangtok bus stand",
  cancellationPolicy: "Full refund up to 72 hours before departure.",
  safetyNotes: undefined,
  inclusions: ["Stay", "Breakfast", "Transport"],
  exclusions: ["Lunch", "Dinner"],
  durationDays: 3,
  durationNights: 2,
  difficulty: "easy" as const,
  groupMin: 2,
  groupMax: 10,
  minAge: 10,
  season: "Oct–May",
  weatherDependent: true,
  tripType: "circuit" as const,
  endRegionSlug: null,
  itinerary: [
    { day: 1, title: "Gangtok arrival", description: "Local sightseeing." },
    { day: 2, title: "Lachung", description: "Drive to North Sikkim." },
    { day: 3, title: "Return via Pelling", description: undefined },
  ],
  highlights: ["Yumthang valley", "MG Marg"],
  accommodationType: "3-star hotels",
  mealPlan: "Breakfast included",
  transportIncluded: true,
  maxAltitudeM: 3500,
  docsRequired: ["Government photo ID"],
  slots: [{ time: "06:00", capacity: 8, daysOfWeek: [0], validFrom: null, validTo: null }],
  ...over,
});

export const vehicleInput = (over: Record<string, unknown> = {}) => ({
  kind: "route_trip" as const,
  categorySlug: "car-hire" as const,
  title: "Gangtok to Pelling cab",
  description: "Comfortable sedan for the Gangtok-Pelling route, door to door.",
  regionSlug: "gangtok",
  unitPrice: 3500,
  advanceType: "percent" as const,
  advanceValue: 30,
  minNoticeHours: 2,
  meetingPoint: "Gangtok taxi stand",
  cancellationPolicy: "Free cancellation up to 6 hours before pickup.",
  safetyNotes: undefined,
  inclusions: ["Driver", "Fuel"],
  exclusions: ["Toll", "Parking"],
  vehicleType: "sedan" as const,
  seats: 4,
  ac: true,
  luggageNote: "2 medium bags",
  unitsTotal: 2,
  oneWay: true,
  pickupTime: "07:00",
  routeCatalogId: null,
  originRegionSlug: "gangtok",
  destinationRegionSlug: "pelling",
  registrationNumber: "SK-01-AB-1234",
  rcExpiry: null,
  ...over,
});

/** An approved, trusted operator with payment details and one live listing. */
export async function publishedRental(over: Record<string, unknown> = {}, opOpts: { name?: string } = {}) {
  const op = await createOperator({ autoPublish: true, ...opOpts });
  await addPaymentMethod(op.companyId);
  const repo = forCompany(op.companyId);
  const { id } = await repo.save(null, rentalListingSchema.parse(rentalInput(over)));
  await addImageRow(id);
  await repo.submit(id);
  return { ...op, listingId: id };
}

export async function publishedSession(over: Record<string, unknown> = {}) {
  const op = await createOperator({ autoPublish: true });
  await addPaymentMethod(op.companyId);
  const repo = forCompany(op.companyId);
  const { id } = await repo.save(null, sessionListingSchema.parse(sessionInput(over)));
  await addImageRow(id);
  await repo.submit(id);
  return { ...op, listingId: id };
}

export async function publishedTour(over: Record<string, unknown> = {}, opOpts: { name?: string } = {}) {
  const op = await createOperator({ autoPublish: true, categories: ["guided-tours"], ...opOpts });
  await addPaymentMethod(op.companyId);
  const repo = forCompany(op.companyId);
  const { id } = await repo.save(null, tourListingSchema.parse(tourInput(over)));
  await addImageRow(id);
  await repo.submit(id);
  return { ...op, listingId: id };
}

export async function publishedVehicle(over: Record<string, unknown> = {}, opOpts: { name?: string } = {}) {
  const op = await createOperator({ autoPublish: true, categories: ["car-hire"], ...opOpts });
  await addPaymentMethod(op.companyId);
  const repo = forCompany(op.companyId);
  const { id } = await repo.save(null, vehicleListingSchema.parse(vehicleInput(over)));
  await addImageRow(id);
  await repo.submit(id);
  return { ...op, listingId: id };
}

let phoneSeq = 0;
/** A distinct, valid-looking customer + client IP per call, so abuse caps don't interfere. */
export function guest(over: Record<string, unknown> = {}) {
  phoneSeq++;
  return {
    date: "", slotTime: null as string | null, quantity: 1, name: "Test Guest", phone: `+9190000${String(phoneSeq).padStart(5, "0")}`,
    email: `guest${phoneSeq}@example.com`, acceptTerms: true as const, hasLicence: true, ...over,
  };
}
export const ipFor = () => `ip-${Date.now().toString(36)}-${phoneSeq}-${Math.random().toString(36).slice(2, 8)}`;
