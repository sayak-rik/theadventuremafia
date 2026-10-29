import { z } from "zod";
import { normalizePhone } from "../phone";
import { isValidISODate } from "../dates";

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

/** Required phone, normalised to E.164 (+91… for Indian numbers). */
export const phone = z
  .string()
  .min(1, "Phone number is required")
  .refine((s) => normalizePhone(s) !== null, "Enter a valid phone number (10-digit mobile, or +country code)")
  .transform((s) => normalizePhone(s) as string);

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long");

export const personName = z.string().trim().min(2, "Enter a name").max(80);

export const isoDate = z.string().refine(isValidISODate, "Enter a valid date");

/** HH:MM, 24-hour. */
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

export const otpCode = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug").max(80);

/** Optional free text: trims, blank becomes undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .refine((v) => !v || /^https?:\/\//i.test(v), "Must start with http:// or https://")
  .transform((v) => (v ? v : undefined));

/** UPI VPA, e.g. name@okaxis. Matches the DB CHECK constraint. */
export const upiVpa = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,30}$/, "Enter a valid UPI ID like name@bank");

/** UPI reference / UTR is 12 digits. */
export const utr = z.string().trim().regex(/^\d{12}$/, "The UTR / reference number is 12 digits");
