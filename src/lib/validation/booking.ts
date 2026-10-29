import { z } from "zod";
import { email, hhmm, isoDate, personName, phone, utr } from "./common";

const participant = z.object({
  name: personName,
  age: z.number().int().min(1, "Enter an age").max(100),
  weightKg: z.number().int().min(10, "Enter a weight in kg").max(300),
});

/** Public booking request (guest checkout). Prices are never accepted from the client. */
export const createBookingSchema = z.object({
  date: isoDate,
  slotTime: hhmm.nullish(),
  quantity: z.number().int().min(1).max(100),
  name: personName,
  phone,
  email,
  participants: z.array(participant).max(100).optional(),
  acceptTerms: z.literal(true, "Please accept the booking terms to continue"),
  waiverAccepted: z.boolean().optional(),
  /** Rentals: the rider confirms they'll bring an original licence. */
  hasLicence: z.boolean().optional(),
  /** Honeypot. */
  website: z.string().max(200).optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const submitPaymentSchema = z.object({
  utr,
  payerName: z.string().trim().max(80).optional().transform((v) => v || undefined),
});

export const cancelSchema = z.object({ reason: z.string().trim().max(300).optional().transform((v) => v || undefined) });

/** Operator actions on a booking. */
export const operatorActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm_payment") }),
  z.object({ action: z.literal("reject_payment") }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(300).optional(), noRefund: z.boolean().optional() }),
  z.object({ action: z.literal("pickup"), vehicleReg: z.string().trim().max(30).optional(), depositCollected: z.boolean().optional() }),
  z.object({ action: z.literal("return"), depositReturned: z.boolean().optional() }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("no_show") }),
  z.object({ action: z.literal("move"), date: isoDate, slotTime: hhmm.nullish() }),
  z.object({ action: z.literal("refund_done") }),
  z.object({ action: z.literal("note"), note: z.string().trim().max(500) }),
]);
export type OperatorAction = z.infer<typeof operatorActionSchema>;

/** Operator-entered booking for a walk-in / WhatsApp customer (reserves real inventory). */
export const walkInSchema = z.object({
  listingId: z.number().int().positive(),
  date: isoDate,
  slotTime: hhmm.nullish(),
  quantity: z.number().int().min(1).max(100),
  name: personName,
  phone,
  note: z.string().trim().max(300).optional(),
});
export type WalkInInput = z.infer<typeof walkInSchema>;

export const blackoutSchema = z.object({
  dateFrom: isoDate,
  dateTo: isoDate,
  slotTime: hhmm.nullish(),
  /** null / omitted = closed entirely. */
  unitsBlocked: z.number().int().min(1).max(100).nullish(),
  reason: z.string().trim().max(200).optional(),
});
export type BlackoutInput = z.infer<typeof blackoutSchema>;
