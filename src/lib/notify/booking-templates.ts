import { SITE } from "@/data/site";
import { COLORS, MARKETPLACE_BRAND, button, detailsTable, escapeHtml, paragraph, row, shell, type RenderedMail } from "../email/layout";
import { formatPretty } from "../dates";
import { formatINR } from "../pricing";
import { whatsappLink } from "../phone";

const brand = MARKETPLACE_BRAND;

export type BookingMailData = {
  token: string; code: string; title: string; bookingModel: "rental_day" | "session";
  customerName: string; customerPhone: string; customerEmail: string | null;
  date: string; slotTime: string | null; quantity: number;
  total: number; advance: number; balance: number; deposit: number;
  paymentRef: string | null; payerName: string | null; cancelReason: string | null; refundStatus: string;
  company: { name: string; phone: string; whatsapp: string | null; email: string };
  meetingPoint: string | null; mapsUrl: string | null; docsRequired: string[]; pickupTime: string | null; returnByTime: string | null;
  cancellationPolicy: string | null; payeeName: string | null; upiVpa: string | null;
};

const first = (n: string) => escapeHtml(n.trim().split(" ")[0] || "there");
const when = (d: BookingMailData) => `${formatPretty(d.date)}${d.slotTime ? `, ${d.slotTime}` : d.pickupTime ? `, pickup from ${d.pickupTime}` : ""}`;
const what = (d: BookingMailData) => `${d.quantity} ${d.bookingModel === "rental_day" ? "×" : d.quantity === 1 ? "person:" : "people:"} ${escapeHtml(d.title)}`;
export const bookingUrl = (d: Pick<BookingMailData, "token">) => `${SITE.url}/book/${d.token}`;
const balanceLabel = (d: Pick<BookingMailData, "bookingModel">) => (d.bookingModel === "rental_day" ? "Balance at the shop" : "Balance at the start");
const summary = (d: BookingMailData) =>
  detailsTable(
    row("Booking", escapeHtml(d.code)) + row("What", what(d)) + row("When", escapeHtml(when(d))) + row("Total", formatINR(d.total)) +
    row("Advance", formatINR(d.advance)) + row(balanceLabel(d), formatINR(d.balance)) + (d.deposit > 0 ? row("Refundable deposit", formatINR(d.deposit)) : ""),
  );
const contactLine = (d: BookingMailData) =>
  paragraph(`Questions? Call ${escapeHtml(d.company.name)} on <a href="tel:${d.company.phone}" style="color:${COLORS.green};">${escapeHtml(d.company.phone)}</a> or <a href="${whatsappLink(d.company.whatsapp ?? d.company.phone, `Hi, about booking ${d.code}`)}" style="color:${COLORS.green};">WhatsApp them</a>.`, true);

// ---- to the customer -------------------------------------------------------
export function awaitingPaymentEmail(d: BookingMailData): RenderedMail {
  const body = `${paragraph(`Hi ${first(d.customerName)},`)}
    ${paragraph(`We're holding your booking with <strong>${escapeHtml(d.company.name)}</strong> for 30 minutes. Pay the ${formatINR(d.advance)} advance straight to them by UPI to lock it in.`)}
    ${summary(d)}
    ${button("Pay and confirm", bookingUrl(d))}
    ${paragraph("The advance goes directly to the operator &mdash; The Adventure Mafia never holds your money.", true)}`;
  return {
    subject: `Pay ${formatINR(d.advance)} to confirm — ${d.title}`,
    html: shell({ brand, preheader: `Your booking is held for 30 minutes.`, accent: COLORS.gold, tagline: "Held for 30 minutes", heading: "One step left", body }),
    text: `Hi ${d.customerName},\n\nWe're holding your booking for 30 minutes. Pay the ${formatINR(d.advance)} advance to ${d.company.name} by UPI: ${bookingUrl(d)}\n\n${d.code} — ${d.title}, ${when(d)}`,
  };
}

export function paymentReceivedEmail(d: BookingMailData): RenderedMail {
  const body = `${paragraph(`Hi ${first(d.customerName)},`)}
    ${paragraph(`We've passed your payment reference <strong>${escapeHtml(d.paymentRef ?? "")}</strong> to ${escapeHtml(d.company.name)}. They'll check it in their UPI app and confirm &mdash; usually within a few minutes during the day.`)}
    ${summary(d)}${button("Track your booking", bookingUrl(d))}${contactLine(d)}`;
  return {
    subject: `Payment sent — waiting for ${d.company.name} to confirm`,
    html: shell({ brand, preheader: "The operator will confirm shortly.", accent: COLORS.gold, tagline: "Payment sent", heading: "Waiting for confirmation", body }),
    text: `Hi ${d.customerName}, we passed your payment reference ${d.paymentRef} to ${d.company.name}. They'll confirm shortly. ${bookingUrl(d)}`,
  };
}

export function confirmedEmail(d: BookingMailData): RenderedMail {
  const bring = d.docsRequired.length ? paragraph(`<strong>Bring:</strong> ${escapeHtml(d.docsRequired.join(", "))}.`) : "";
  const where = d.meetingPoint ? paragraph(`<strong>Where:</strong> ${escapeHtml(d.meetingPoint)}${d.mapsUrl ? ` &mdash; <a href="${d.mapsUrl}" style="color:${COLORS.green};">open map</a>` : ""}`) : "";
  const body = `${paragraph(`Hi ${first(d.customerName)},`)}
    ${paragraph(`<strong>${escapeHtml(d.company.name)}</strong> has confirmed your booking.`)}
    ${summary(d)}${where}${bring}
    ${d.cancellationPolicy ? paragraph(`<strong>Cancellation:</strong> ${escapeHtml(d.cancellationPolicy)}`, true) : ""}
    ${button("View your booking", bookingUrl(d))}${contactLine(d)}`;
  return {
    subject: `Confirmed: ${d.title}, ${formatPretty(d.date)}`,
    html: shell({ brand, preheader: `You're booked for ${formatPretty(d.date)}.`, accent: COLORS.green, tagline: "Confirmed", heading: "You're booked", body }),
    text: `Confirmed: ${d.title}, ${when(d)} (${d.code}). ${balanceLabel(d)}: ${formatINR(d.balance)}. ${bookingUrl(d)}`,
  };
}

export function paymentNotReceivedEmail(d: BookingMailData): RenderedMail {
  const body = `${paragraph(`Hi ${first(d.customerName)},`)}
    ${paragraph(`${escapeHtml(d.company.name)} couldn't find your payment yet. Please check the reference number you entered and try again &mdash; your booking is held for another 30 minutes.`)}
    ${button("Check and resend", bookingUrl(d), COLORS.gold)}${contactLine(d)}`;
  return {
    subject: `We couldn't find your payment — ${d.title}`,
    html: shell({ brand, preheader: "Please re-check the UPI reference.", accent: COLORS.gold, tagline: "Payment not found", heading: "Let's try that again", body }),
    text: `${d.company.name} couldn't find your payment. Re-check the reference and resend: ${bookingUrl(d)}`,
  };
}

export function cancelledEmail(d: BookingMailData): RenderedMail {
  const refund = d.refundStatus === "due" ? paragraph(`<strong>Refund:</strong> ${escapeHtml(d.company.name)} will refund your ${formatINR(d.advance)} advance directly. If you haven't heard from them soon, contact them using the details below.`) : "";
  const body = `${paragraph(`Hi ${first(d.customerName)},`)}
    ${paragraph(`Your booking <strong>${escapeHtml(d.code)}</strong> for ${what(d)} on ${escapeHtml(formatPretty(d.date))} was cancelled.${d.cancelReason ? ` Reason: ${escapeHtml(d.cancelReason)}.` : ""}`)}
    ${refund}${contactLine(d)}`;
  return {
    subject: `Cancelled: ${d.title}, ${formatPretty(d.date)}`,
    html: shell({ brand, preheader: "Your booking was cancelled.", accent: COLORS.gold, tagline: "Cancelled", heading: "Booking cancelled", body }),
    text: `Your booking ${d.code} (${d.title}, ${when(d)}) was cancelled.${d.cancelReason ? ` Reason: ${d.cancelReason}.` : ""}${d.refundStatus === "due" ? ` ${d.company.name} will refund your advance.` : ""}`,
  };
}

export function needsRescheduleEmail(d: BookingMailData, why: string): RenderedMail {
  const body = `${paragraph(`Hi ${first(d.customerName)},`)}
    ${paragraph(`${escapeHtml(d.company.name)} needs to move your booking <strong>${escapeHtml(d.code)}</strong> (${what(d)}, ${escapeHtml(formatPretty(d.date))}). ${escapeHtml(why)}`)}
    ${paragraph("They'll contact you to pick a new date, or refund your advance if you'd rather not move.")}
    ${button("View your booking", bookingUrl(d), COLORS.gold)}${contactLine(d)}`;
  return {
    subject: `Your booking needs a new date — ${d.title}`,
    html: shell({ brand, preheader: "The operator will contact you.", accent: COLORS.gold, tagline: "Needs a new date", heading: "We need to move your booking", body }),
    text: `${d.company.name} needs to move your booking ${d.code}. ${why} They'll contact you. ${bookingUrl(d)}`,
  };
}

export function movedEmail(d: BookingMailData): RenderedMail {
  const body = `${paragraph(`Hi ${first(d.customerName)},`)}
    ${paragraph(`${escapeHtml(d.company.name)} moved your booking to <strong>${escapeHtml(when(d))}</strong>.`)}
    ${summary(d)}${button("View your booking", bookingUrl(d))}${contactLine(d)}`;
  return {
    subject: `New date for your booking — ${formatPretty(d.date)}`,
    html: shell({ brand, preheader: `Now ${formatPretty(d.date)}.`, accent: COLORS.green, tagline: "Rescheduled", heading: "Your booking has a new date", body }),
    text: `${d.company.name} moved your booking ${d.code} to ${when(d)}. ${bookingUrl(d)}`,
  };
}

// ---- to the operator -------------------------------------------------------
export function operatorPaymentSubmittedEmail(d: BookingMailData): RenderedMail {
  const body = `${paragraph(`<strong>${escapeHtml(d.customerName)}</strong> says they've paid the advance for ${what(d)} on ${escapeHtml(when(d))}.`)}
    ${detailsTable(
      row("Amount to look for", `<span style="font-size:18px;">${formatINR(d.advance)}</span>`) + row("UPI reference", escapeHtml(d.paymentRef ?? "")) +
      (d.payerName ? row("Paid by", escapeHtml(d.payerName)) : "") + row("Customer", `${escapeHtml(d.customerName)}, ${escapeHtml(d.customerPhone)}`) + row("Booking", escapeHtml(d.code)),
    )}
    ${paragraph("<strong>Confirm only if the money has reached your account.</strong> If you can't see it, tap &ldquo;Not received&rdquo; and the customer is asked to re-check.")}
    ${button("Open the booking", `${SITE.url}/dashboard/bookings`)}
    ${paragraph(`Message the customer: <a href="${whatsappLink(d.customerPhone, `Hi ${d.customerName}, this is ${d.company.name} about booking ${d.code}`)}" style="color:${COLORS.green};">WhatsApp ${escapeHtml(d.customerPhone)}</a>`, true)}`;
  return {
    subject: `Check your UPI: ${formatINR(d.advance)} from ${d.customerName}`,
    html: shell({ brand, preheader: `Look for ${formatINR(d.advance)}, ref ${d.paymentRef}.`, accent: COLORS.gold, tagline: "Action needed", heading: "Confirm a payment", body }),
    text: `${d.customerName} says they paid ${formatINR(d.advance)} (UPI ref ${d.paymentRef}) for ${d.title} on ${when(d)}. Confirm only if you can see it: ${SITE.url}/dashboard/bookings`,
  };
}

export function operatorNeedsRescheduleEmail(d: BookingMailData, why: string): RenderedMail {
  const body = `${paragraph(`Booking <strong>${escapeHtml(d.code)}</strong> from ${escapeHtml(d.customerName)} (${escapeHtml(d.customerPhone)}) needs your attention.`)}
    ${paragraph(escapeHtml(why))}${summary(d)}${button("Move or refund it", `${SITE.url}/dashboard/bookings`, COLORS.gold)}`;
  return {
    subject: `Needs action: ${d.code} — ${d.customerName}`,
    html: shell({ brand, preheader: why, accent: COLORS.gold, tagline: "Action needed", heading: "A booking needs a new date", body }),
    text: `Booking ${d.code} from ${d.customerName} (${d.customerPhone}) needs attention: ${why} ${SITE.url}/dashboard/bookings`,
  };
}

export function bookingLinkEmail(d: BookingMailData): RenderedMail {
  const body = `${paragraph(`Hi ${first(d.customerName)},`)}
    ${paragraph(`Here's the link to your booking <strong>${escapeHtml(d.code)}</strong> with ${escapeHtml(d.company.name)}.`)}
    ${summary(d)}${button("Open your booking", bookingUrl(d))}
    ${paragraph("Anyone with this link can see your booking, so don't forward it.", true)}`;
  return {
    subject: `Your booking link — ${d.code}`,
    html: shell({ brand, preheader: "Your private booking link.", accent: COLORS.green, tagline: "Your booking", heading: "Here's your booking link", body }),
    text: `Your booking ${d.code}: ${bookingUrl(d)}`,
  };
}
