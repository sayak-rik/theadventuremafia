import { z } from "zod";
import { email, phone, password, personName, slug, optionalText, otpCode, upiVpa } from "./common";

export const signupSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(80),
  ownerName: personName,
  email,
  phone,
  password,
  categories: z.array(slug).min(1, "Choose at least one thing you offer").max(8),
  regionSlug: slug,
  address: optionalText(300),
  acceptTerms: z.literal(true, "You must accept the partner terms to continue"),
  /** 'driver' reuses the same signup/approval/payment pipeline as an operator — just a different kind of thing they list. */
  companyType: z.enum(["operator", "driver"]).default("operator"),
  /** Honeypot — real users never fill this in. */
  website: z.string().max(200).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const verifySchema = z.object({ email, otp: otpCode });
export const resendSchema = z.object({ email });
export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
export const resetSchema = z.object({ email, otp: otpCode, password });

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalText(1000),
  contactPhone: phone,
  whatsappNumber: z.string().optional().transform((v) => v || undefined).pipe(phone.optional()),
  address: optionalText(300),
  mapsUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), "Must start with http:// or https://")
    .transform((v) => v || undefined),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), "Must start with http:// or https://")
    .transform((v) => v || undefined),
  instagramUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), "Must start with http:// or https://")
    .transform((v) => v || undefined),
  categories: z.array(slug).min(1).max(8),
  regions: z.array(slug).min(1).max(12),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const paymentSettingsSchema = z.object({
  payeeName: z.string().trim().min(2, "Enter the name on your UPI account").max(80),
  upiVpa: z.string().trim().max(80).optional().transform((v) => v || undefined).pipe(upiVpa.optional()),
  upiNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || /^\+?\d{10,13}$/.test(v.replace(/[\s-]/g, "")), "Enter a valid UPI number (usually your mobile number)")
    .transform((v) => (v ? v.replace(/[\s-]/g, "") : undefined)),
  /** Required to change existing payment details (protects against account takeover). */
  currentPassword: z.string().max(200).optional(),
});
