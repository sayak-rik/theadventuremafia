// Branded, email-client-safe HTML templates (inline styles + table layout).
// Two designs: a booking confirmation and a contact/enquiry notification.

import { SITE } from "@/data/site";
import { formatMoney } from "@/lib/pricing";
import { formatPretty } from "@/lib/dates";
import { COLORS, escapeHtml, row, shell } from "./layout";

// Format a booking fare in its currency (defaults to INR for older records).
const money = (d: BookingEmailData) => (n: number) => formatMoney(n, d.currency ?? "INR");

export type BookingEmailData = {
  name: string;
  email: string;
  phone: string;
  tripDate: string;
  productType?: "expedition" | "trek";
  option: "bike" | "cab" | "trek";
  bikeName?: string; // option = 'bike'
  trekName?: string; // product = 'trek'
  priceNote?: string; // product = 'trek' (e.g. "+ taxi fare")
  rider?: "single" | "double"; // option = 'bike'
  seats: number; // riders on the bike, cab seats, or people on a trek
  residence?: "IN" | "INTL";
  price: number; // per rider (bike), per seat (cab) or per person (trek), in `currency`
  currency?: "INR" | "USD";
  advCashDiscount?: number; // adv cash applied (in INR), 0 if none
  message?: string;
};

export type ContactEmailData = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
};

// Build the per-option detail rows shared by both booking emails.
function bookingRows(d: BookingEmailData): string {
  const date = formatPretty(d.tripDate);
  const fmt = money(d);
  const permit = d.residence === "INTL" ? `${row("Permit", "Inner-line permit costs are extra")}` : "";
  // d.seats = people on the booking (2 for a two-up/pillion bike).
  const total = d.price * d.seats;
  const discount = d.advCashDiscount ?? 0;
  const advRows = discount > 0
    ? `${row("Adv cash applied", `– ${money(d)(discount)}`)}${row("You pay", money(d)(Math.max(0, total - discount)))}`
    : "";
  if (d.productType === "trek") {
    return `${row("Trek", d.trekName ?? "Day trek")}
      ${row("Date", date)}
      ${row("People", String(d.seats))}
      ${row("Fare", `${fmt(d.price)} / person`)}
      ${row("Total", `${fmt(total)}${d.seats > 1 ? ` (${d.seats} × ${fmt(d.price)})` : ""}`)}
      ${d.priceNote ? row("Note", d.priceNote) : ""}
      ${advRows}`;
  }
  if (d.option === "cab") {
    return `${row("Departure", `${date} (Sunday)`)}
      ${row("Riding option", "Shared cab seat")}
      ${row("Seats", String(d.seats))}
      ${row("Fare", `${fmt(d.price)} / seat`)}
      ${row("Total", `${fmt(total)} (${d.seats} × ${fmt(d.price)})`)}
      ${advRows}
      ${permit}`;
  }
  return `${row("Departure", `${date} (Sunday)`)}
    ${row("Riding option", "Ride a motorbike")}
    ${row("Motorcycle", d.bikeName ?? "Royal Enfield")}
    ${row("Riders", d.rider === "double" ? "Two-up (rider + pillion)" : "Solo (single)")}
    ${row("Fare", `${fmt(d.price)} / rider`)}
    ${row("Total", `${fmt(total)}${d.seats > 1 ? ` (${d.seats} × ${fmt(d.price)})` : ""}`)}
    ${advRows}
    ${permit}`;
}

// ---- Booking confirmation (to customer) ----------------------------------
export function bookingConfirmation(d: BookingEmailData): { subject: string; html: string; text: string } {
  const date = formatPretty(d.tripDate);
  const isTrek = d.productType === "trek";
  const productName = isTrek ? (d.trekName ?? "day trek") : "Untouched West Sikkim Expedition";
  const summary = isTrek
    ? `${d.seats} ${d.seats > 1 ? "people" : "person"}`
    : d.option === "cab"
      ? `${d.seats} shared-cab seat${d.seats > 1 ? "s" : ""}`
      : `the ${d.bikeName ?? "Royal Enfield"}`;
  const details = `<table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;">
    ${bookingRows(d)}
  </table>`;
  const ctaHref = isTrek ? `${SITE.url}/adventures` : `${SITE.url}/itinerary`;
  const ctaLabel = isTrek ? "Explore more adventures" : "Review the 7-day itinerary";

  const body = `
    <p style="margin:0 0 14px;">Hi ${d.name.split(" ")[0]},</p>
    <p style="margin:0 0 14px;">Thank you for choosing the <strong>${escapeHtml(productName)}</strong>. We&rsquo;ve received your request and our crew will confirm availability${isTrek ? "" : " and permits"} within 24 hours.</p>
    ${details}
    ${d.message ? `<p style="margin:0 0 14px;color:${COLORS.muted};"><em>Your note:</em> ${escapeHtml(d.message)}</p>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="border-radius:999px;background:${COLORS.green};">
      <a href="${ctaHref}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${ctaLabel}</a>
    </td></tr></table>
    <p style="margin:0;color:${COLORS.muted};font-size:13px;">No payment is due yet &mdash; we confirm availability first. Reply to this email with any questions.</p>`;

  const textDetail = isTrek
    ? `Trek: ${d.trekName}\nDate: ${date}\nPeople: ${d.seats}\nFare: ${money(d)(d.price)}/person${d.priceNote ? `\nNote: ${d.priceNote}` : ""}`
    : `Departure: ${date} (Sunday)\nOption: ${d.option === "cab" ? "Shared cab seat" : "Ride a motorbike"}\n${d.option === "cab" ? `Seats: ${d.seats}\nFare: ${money(d)(d.price)}/seat` : `Bike: ${d.bikeName}\nRiders: ${d.rider}\nFare: ${money(d)(d.price)}/rider`}${d.residence === "INTL" ? "\nNote: inner-line permit costs are extra." : ""}`;

  return {
    subject: isTrek ? `Your ${d.trekName} booking — ${date}` : `Your West Sikkim Expedition request — ${date}`,
    html: shell({ preheader: `We received your booking for ${date}.`, accent: COLORS.green, tagline: "Booking received", heading: "We've got your booking request", body }),
    text: `Hi ${d.name},\n\nThanks for booking the ${productName} (${summary}).\n\n${textDetail}\n\nWe'll confirm availability within 24 hours.\n\n— ${SITE.name}`,
  };
}

// ---- Booking notification (to team) --------------------------------------
export function bookingTeamNotification(d: BookingEmailData): { subject: string; html: string; text: string } {
  const date = formatPretty(d.tripDate);
  const details = `<table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;">
    ${row("Name", escapeHtml(d.name))}
    ${row("Email", `<a href="mailto:${d.email}" style="color:${COLORS.green};text-decoration:none;">${escapeHtml(d.email)}</a>`)}
    ${row("Phone", escapeHtml(d.phone))}
    ${bookingRows(d)}
  </table>`;
  const isTrek = d.productType === "trek";
  const body = `
    <p style="margin:0 0 14px;">A new booking request just came in. Follow up within 24 hours.</p>
    ${details}
    ${d.message ? `<p style="margin:0;color:${COLORS.muted};"><strong>Message:</strong> ${escapeHtml(d.message)}</p>` : ""}`;
  const optLabel = isTrek ? `Trek · ${d.trekName}` : d.option === "cab" ? "Shared cab seat" : "Ride a motorbike";
  const textDetail = isTrek
    ? `Trek: ${d.trekName}\nDate: ${date}\nPeople: ${d.seats}\nFare: ${money(d)(d.price)}/person\nTotal: ${money(d)(d.price * d.seats)}${d.priceNote ? `\nNote: ${d.priceNote}` : ""}`
    : `Departure: ${date}\nOption: ${optLabel}\n${d.option === "cab" ? `Seats: ${d.seats}\nFare: ${money(d)(d.price)}/seat\nTotal: ${money(d)(d.price * d.seats)}` : `Bike: ${d.bikeName}\nRiders: ${d.rider}\nFare: ${money(d)(d.price)}/rider`}`;
  return {
    subject: `${isTrek ? "🥾" : "🏍️"} New booking — ${escapeHtml(d.name)} · ${date}`,
    html: shell({ preheader: `New booking from ${d.name} for ${date}.`, accent: COLORS.gold, tagline: "New booking", heading: isTrek ? "New trek booking" : "New expedition booking", body }),
    text: `New booking\n\nName: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone}\nResidence: ${d.residence === "INTL" ? "Outside India (USD)" : "India"}\n${textDetail}\nMessage: ${d.message ?? "-"}`,
  };
}

// ---- Contact / enquiry notification (to team) ----------------------------
export function contactNotification(d: ContactEmailData): { subject: string; html: string; text: string } {
  const details = `<table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;">
    ${row("Name", escapeHtml(d.name))}
    ${row("Email", `<a href="mailto:${d.email}" style="color:${COLORS.green};text-decoration:none;">${escapeHtml(d.email)}</a>`)}
    ${d.phone ? row("Phone", escapeHtml(d.phone)) : ""}
    ${d.subject ? row("Subject", escapeHtml(d.subject)) : ""}
  </table>`;
  const body = `
    <p style="margin:0 0 14px;">A visitor reached out through the website contact form.</p>
    ${details}
    <div style="margin-top:8px;padding:16px 18px;background:${COLORS.cream};border-left:4px solid ${COLORS.gold};border-radius:8px;font-size:14px;line-height:1.6;color:${COLORS.ink};">
      ${escapeHtml(d.message).replace(/\n/g, "<br/>")}
    </div>`;
  return {
    subject: `✉️ New enquiry — ${escapeHtml(d.name)}`,
    html: shell({ preheader: `New enquiry from ${d.name}.`, accent: COLORS.gold, tagline: "New enquiry", heading: "Someone wants to ride with you", body }),
    text: `New enquiry\n\nName: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone ?? "-"}\nSubject: ${d.subject ?? "-"}\n\n${d.message}`,
  };
}

// ---- Contact acknowledgement (to sender) ---------------------------------
export function contactAcknowledgement(d: ContactEmailData): { subject: string; html: string; text: string } {
  const body = `
    <p style="margin:0 0 14px;">Hi ${d.name.split(" ")[0]},</p>
    <p style="margin:0 0 14px;">Thanks for reaching out to The Adventure Mafia. We&rsquo;ve received your message and a member of our crew will reply shortly &mdash; usually within one working day.</p>
    <p style="margin:0 0 14px;color:${COLORS.muted};">In the meantime, feel free to explore the full day-by-day route and the machines on offer.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${COLORS.green};">
      <a href="${SITE.url}/itinerary" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">See the itinerary</a>
    </td></tr></table>`;
  return {
    subject: `We received your message — ${SITE.name}`,
    html: shell({ preheader: "Thanks for reaching out — we'll reply within a day.", accent: COLORS.green, tagline: "Message received", heading: "Thanks for reaching out", body }),
    text: `Hi ${d.name},\n\nThanks for contacting The Adventure Mafia. We'll reply within one working day.\n\n— ${SITE.name}`,
  };
}

// ---- Rewards OTP -----------------------------------------------------------
export function otpEmail(otp: string): { subject: string; html: string; text: string } {
  const body = `
    <p style="margin:0 0 14px;">Use this code to verify your email and unlock your Adventure Mafia rewards account:</p>
    <div style="margin:18px 0;text-align:center;">
      <span style="display:inline-block;font-family:'Courier New',monospace;font-size:38px;font-weight:bold;letter-spacing:12px;color:${COLORS.navy};background:${COLORS.cream};border:1px solid ${COLORS.gold};border-radius:12px;padding:18px 28px;">${otp}</span>
    </div>
    <p style="margin:0;color:${COLORS.muted};font-size:13px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`;
  return {
    subject: `${otp} is your Adventure Mafia verification code`,
    html: shell({ preheader: `Your code is ${otp}`, accent: COLORS.green, tagline: "Verify your email", heading: "Your verification code", body }),
    text: `Your Adventure Mafia verification code is ${otp}. It expires in 10 minutes.`,
  };
}
