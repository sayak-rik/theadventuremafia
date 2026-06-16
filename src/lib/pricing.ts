import type { BikeModel } from "./data";

// Pricing rule (also encoded directly in the seed prices so admins can override
// any individual cell in the DB):
//
//   single  = double + SINGLE_PREMIUM
//   each step DOWN in engine size  =  -ENGINE_STEP per rider
//
// Top of range: Himalayan 450 -> double ₹45,000 / single ₹55,000.
export const SINGLE_PREMIUM = 10_000;
export const ENGINE_STEP = 2_000;

// Shared cab: a seat in the support cab instead of riding a motorcycle.
// Flat ₹40,000 per seat, with 10 seats available each Sunday departure.
export const SHARED_CAB_PRICE = 40_000;

// Per-departure capacity.
export const BIKES_PER_DEPARTURE = 20;
export const CAB_SEATS_PER_DEPARTURE = 10;

export function priceFor(bike: BikeModel, rider: "single" | "double"): number {
  return rider === "single" ? bike.price_single : bike.price_double;
}

// Non-India residents are charged in USD at 50% above the India fare, and
// inner-line permit costs are extra (billed separately).
export const FOREIGN_MARKUP = 1.5; // +50%
export const INR_PER_USD = 80; // conversion rate

/** Convert an INR fare to the foreign-resident USD price (50% extra, rounded up to $10). */
export function toForeignUSD(inr: number): number {
  const usd = (inr * FOREIGN_MARKUP) / INR_PER_USD;
  return Math.ceil(usd / 10) * 10;
}

export const formatINR = (n: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export const formatUSD = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export type Residence = "IN" | "INTL";
export type Currency = "INR" | "USD";

/** Resolve a base-INR fare into the amount + currency for a given residence. */
export function fareFor(inr: number, residence: Residence): { amount: number; currency: Currency } {
  return residence === "INTL"
    ? { amount: toForeignUSD(inr), currency: "USD" }
    : { amount: inr, currency: "INR" };
}

export function formatMoney(amount: number, currency: Currency): string {
  return currency === "USD" ? formatUSD(amount) : formatINR(amount);
}
