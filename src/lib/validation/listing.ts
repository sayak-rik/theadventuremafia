import { z } from "zod";
import { hhmm, isoDate, optionalText, slug } from "./common";

const textList = z.array(z.string().trim().min(1).max(100)).max(20);
const int = (min: number, max: number) => z.number().int().min(min).max(max);

const base = z.object({
  title: z.string().trim().min(3, "Give it a clear title").max(80),
  description: z.string().trim().min(20, "Describe it in a couple of sentences").max(2000),
  regionSlug: slug,
  unitPrice: int(1, 500_000),
  advanceType: z.enum(["percent", "flat"]),
  advanceValue: int(1, 500_000),
  minNoticeHours: int(0, 72),
  meetingPoint: optionalText(200),
  cancellationPolicy: z.string().trim().min(10, "Explain your cancellation / refund policy").max(1000),
  safetyNotes: optionalText(1500),
  inclusions: textList,
  exclusions: textList,
});

export const rentalListingSchema = base.extend({
  kind: z.literal("rental_day"),
  categorySlug: z.enum(["bike-rental", "scooty-rental"]),
  makeModel: z.string().trim().min(2, "Enter the make and model").max(80),
  engineCc: int(20, 2000).nullable(),
  transmission: z.enum(["gear", "automatic"]),
  fuelType: z.enum(["petrol", "electric"]),
  unitsTotal: int(1, 100),
  securityDeposit: int(0, 100_000),
  helmetsIncluded: int(0, 4),
  kmLimitPerDay: int(1, 1000).nullable(),
  fuelPolicy: optionalText(300),
  docsRequired: z.array(z.string().trim().min(1).max(100)).max(10),
  pickupTime: hhmm,
  returnByTime: hhmm,
  lateFeePerHour: int(0, 10_000).nullable(),
  areaRestrictions: optionalText(300),
});

const slotSchema = z.object({
  time: hhmm,
  capacity: int(1, 100),
  daysOfWeek: z.array(int(0, 6)).min(1, "Pick at least one day").max(7),
  validFrom: isoDate.nullable(),
  validTo: isoDate.nullable(),
});

export const sessionListingSchema = base
  .extend({
    kind: z.literal("session"),
    categorySlug: z.enum(["rafting", "paragliding"]),
    durationHours: int(1, 12),
    difficulty: z.enum(["easy", "moderate", "difficult", "extreme"]).nullable(),
    groupMin: int(1, 100).nullable(),
    groupMax: int(1, 100).nullable(),
    minAge: int(0, 100).nullable(),
    maxAge: int(1, 100).nullable(),
    minWeightKg: int(10, 300).nullable(),
    maxWeightKg: int(10, 300).nullable(),
    rapidsGrade: int(1, 6).nullable(),
    stretchName: optionalText(100),
    distanceKm: z.number().min(0.1).max(200).nullable(),
    flightMinutes: int(1, 240).nullable(),
    takeoffAltitudeM: int(0, 8000).nullable(),
    swimRequired: z.boolean(),
    certification: z.string().trim().min(3, "Tell customers who guides / flies (and their certification)").max(300),
    equipmentNotes: optionalText(500),
    waiverRequired: z.boolean(),
    weatherDependent: z.boolean(),
    season: optionalText(100),
    slots: z
      .array(slotSchema)
      .min(1, "Add at least one time slot")
      .max(12)
      .refine((s) => new Set(s.map((x) => x.time)).size === s.length, "Each slot needs a different start time"),
  })
  .refine((v) => v.minWeightKg === null || v.maxWeightKg === null || v.minWeightKg <= v.maxWeightKg, {
    path: ["maxWeightKg"],
    message: "Max weight must be at least the min weight",
  })
  .refine((v) => v.categorySlug !== "paragliding" || v.maxWeightKg !== null, {
    path: ["maxWeightKg"],
    message: "Paragliding needs a maximum passenger weight",
  });

const itineraryDay = z.object({
  day: int(1, 30),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().transform((v) => v || undefined),
});

export const tourListingSchema = base.extend({
  kind: z.literal("departure"),
  categorySlug: z.enum(["guided-tours"]),
  durationDays: int(1, 30),
  durationNights: int(0, 29),
  difficulty: z.enum(["easy", "moderate", "difficult", "extreme"]).nullable(),
  groupMin: int(1, 100).nullable(),
  groupMax: int(1, 100).nullable(),
  minAge: int(0, 100).nullable(),
  season: optionalText(100),
  weatherDependent: z.boolean(),
  tripType: z.enum(["circuit", "point_to_point"]),
  endRegionSlug: slug.nullish(),
  itinerary: z.array(itineraryDay).min(1, "Add at least one day to the itinerary").max(30),
  highlights: textList,
  accommodationType: optionalText(100),
  mealPlan: optionalText(100),
  transportIncluded: z.boolean(),
  maxAltitudeM: int(0, 9000).nullable(),
  docsRequired: z.array(z.string().trim().min(1).max(100)).max(10),
  slots: z
    .array(slotSchema)
    .min(1, "Add at least one departure day")
    .max(12)
    .refine((s) => new Set(s.map((x) => x.time)).size === s.length, "Each departure needs a different start time"),
}).refine((v) => v.tripType !== "point_to_point" || !!v.endRegionSlug, {
  path: ["endRegionSlug"],
  message: "A point-to-point tour needs an end region",
});

export const vehicleListingSchema = base.extend({
  kind: z.literal("route_trip"),
  categorySlug: z.enum(["car-hire"]),
  vehicleType: z.enum(["hatchback", "sedan", "suv", "innova", "traveller"]),
  seats: int(1, 30),
  ac: z.boolean(),
  luggageNote: optionalText(200),
  unitsTotal: int(1, 50),
  oneWay: z.boolean(),
  pickupTime: hhmm.nullable(),
  routeCatalogId: z.number().int().positive().nullable(),
  originRegionSlug: slug.nullable(),
  destinationRegionSlug: slug.nullable(),
  registrationNumber: optionalText(20),
  rcExpiry: isoDate.nullable(),
}).refine((v) => v.routeCatalogId !== null || (!!v.originRegionSlug && !!v.destinationRegionSlug), {
  path: ["originRegionSlug"],
  message: "Pick a standardized route, or set a custom origin and destination",
});

export const listingSchema = z.union([rentalListingSchema, sessionListingSchema, tourListingSchema, vehicleListingSchema]);
export type RentalListingInput = z.infer<typeof rentalListingSchema>;
export type SessionListingInput = z.infer<typeof sessionListingSchema>;
export type TourListingInput = z.infer<typeof tourListingSchema>;
export type VehicleListingInput = z.infer<typeof vehicleListingSchema>;
export type ListingInput = RentalListingInput | SessionListingInput | TourListingInput | VehicleListingInput;

export { advanceFor } from "../booking/pricing";
