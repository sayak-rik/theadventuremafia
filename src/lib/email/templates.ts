// Branded, email-client-safe HTML templates (inline styles + table layout).
// Two designs: a booking confirmation and a contact/enquiry notification.

import { SITE } from "@/data/site";
import { formatMoney } from "@/lib/pricing";
import { formatPretty } from "@/lib/dates";

// Format a booking fare in its currency (defaults to INR for older records).
const money = (d: BookingEmailData) => (n: number) => formatMoney(n, d.currency ?? "INR");

const COLORS = {
  navy: "#0e1a24",
  navy2: "#122332",
  green: "#5bb02e",
  gold: "#c69c6d",
  cream: "#f5f3e8",
  ink: "#1f2a33",
  muted: "#6b7680",
};

export type BookingEmailData = {
  name: string;
  email: string;
  phone: string;
  tripDate: string;
  option: "bike" | "cab";
  bikeName?: string; // option = 'bike'
  rider?: "single" | "double"; // option = 'bike'
  seats: number; // riders on the bike, or cab seats
  residence?: "IN" | "INTL";
  price: number; // per rider (bike) or per seat (cab), in `currency`
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

// ---- Shared chrome -------------------------------------------------------
function shell(opts: { preheader: string; accent: string; heading: string; tagline: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<title>${SITE.name}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:Helvetica,Arial,sans-serif;color:${COLORS.ink};">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${opts.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cream};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px -20px rgba(14,26,36,0.35);">
  <!-- header -->
  <tr><td style="background:${COLORS.navy};padding:28px 32px;">
    <table role="presentation" width="100%"><tr>
      <td style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:${COLORS.cream};">The Adventure Mafia</td>
      <td align="right" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${opts.accent};">West Sikkim</td>
    </tr></table>
  </td></tr>
  <!-- accent bar -->
  <tr><td style="height:4px;background:${opts.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
  <!-- hero heading -->
  <tr><td style="padding:32px 32px 8px 32px;">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${opts.accent};font-weight:bold;">${opts.tagline}</p>
    <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:${COLORS.navy};">${opts.heading}</h1>
  </td></tr>
  <!-- body -->
  <tr><td style="padding:12px 32px 8px 32px;font-size:15px;line-height:1.6;color:${COLORS.ink};">${opts.body}</td></tr>
  <!-- footer -->
  <tr><td style="padding:24px 32px 32px;border-top:1px solid #eee;color:${COLORS.muted};font-size:12px;line-height:1.6;">
    <strong style="color:${COLORS.navy};">${SITE.name}</strong> &middot; Untouched West Sikkim Expedition<br/>
    <a href="mailto:${SITE.email}" style="color:${COLORS.green};text-decoration:none;">${SITE.email}</a> &middot; ${SITE.phone}<br/>
    <span style="color:${COLORS.muted};">Departures every Sunday &middot; Sep&ndash;May &middot; Sikkim ILP permits required</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0efe6;font-size:13px;color:${COLORS.muted};width:42%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f0efe6;font-size:14px;color:${COLORS.navy};font-weight:bold;">${value}</td>
  </tr>`;
}

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
  const summary = d.option === "cab"
    ? `${d.seats} shared-cab seat${d.seats > 1 ? "s" : ""}`
    : `the ${d.bikeName ?? "Royal Enfield"}`;
  const details = `<table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;">
    ${bookingRows(d)}
  </table>`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${d.name.split(" ")[0]},</p>
    <p style="margin:0 0 14px;">Thank you for choosing the <strong>Untouched West Sikkim Expedition</strong>. We&rsquo;ve received your request and our crew will confirm seat availability and permits within 24 hours.</p>
    ${details}
    ${d.message ? `<p style="margin:0 0 14px;color:${COLORS.muted};"><em>Your note:</em> ${escapeHtml(d.message)}</p>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="border-radius:999px;background:${COLORS.green};">
      <a href="${SITE.url}/itinerary" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">Review the 7-day itinerary</a>
    </td></tr></table>
    <p style="margin:0;color:${COLORS.muted};font-size:13px;">No payment is due yet &mdash; we confirm availability and permits first. Reply to this email with any questions.</p>`;

  return {
    subject: `Your West Sikkim Expedition request — ${date}`,
    html: shell({ preheader: `We received your booking for ${date}.`, accent: COLORS.green, tagline: "Booking received", heading: "We've got your booking request", body }),
    text: `Hi ${d.name},\n\nThanks for booking the Untouched West Sikkim Expedition (${summary}).\n\nDeparture: ${date} (Sunday)\nOption: ${d.option === "cab" ? "Shared cab seat" : "Ride a motorbike"}\n${d.option === "cab" ? `Seats: ${d.seats}\nFare: ${money(d)(d.price)}/seat` : `Bike: ${d.bikeName}\nRiders: ${d.rider}\nFare: ${money(d)(d.price)}/rider`}${d.residence === "INTL" ? "\nNote: inner-line permit costs are extra." : ""}\n\nWe'll confirm availability and permits within 24 hours.\n\n— ${SITE.name}`,
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
  const body = `
    <p style="margin:0 0 14px;">A new booking request just came in. Follow up within 24 hours.</p>
    ${details}
    ${d.message ? `<p style="margin:0;color:${COLORS.muted};"><strong>Message:</strong> ${escapeHtml(d.message)}</p>` : ""}`;
  const optLabel = d.option === "cab" ? "Shared cab seat" : "Ride a motorbike";
  return {
    subject: `🏍️ New booking — ${escapeHtml(d.name)} · ${date}`,
    html: shell({ preheader: `New booking from ${d.name} for ${date}.`, accent: COLORS.gold, tagline: "New booking", heading: "New expedition booking", body }),
    text: `New booking\n\nName: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone}\nResidence: ${d.residence === "INTL" ? "Outside India (USD, permit extra)" : "India"}\nDeparture: ${date}\nOption: ${optLabel}\n${d.option === "cab" ? `Seats: ${d.seats}\nFare: ${money(d)(d.price)}/seat\nTotal: ${money(d)(d.price * d.seats)}` : `Bike: ${d.bikeName}\nRiders: ${d.rider}\nFare: ${money(d)(d.price)}/rider`}\nMessage: ${d.message ?? "-"}`,
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
