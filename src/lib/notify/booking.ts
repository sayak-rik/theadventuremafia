import { requirePool } from "../db";
import { send } from "../email";
import * as t from "./booking-templates";
import type { BookingMailData } from "./booking-templates";

export type BookingEvent =
  | "created" | "link" | "payment_submitted" | "confirmed" | "payment_not_received" | "cancelled" | "moved"
  | { type: "needs_reschedule"; why: string };

async function load(bookingId: number): Promise<BookingMailData | null> {
  const res = await requirePool().query(
    `SELECT b.token, b.code, b.title_snapshot, ac.booking_model, b.customer_name, b.customer_phone, b.customer_email,
            to_char(b.start_date, 'YYYY-MM-DD') AS date, to_char(b.slot_time, 'HH24:MI') AS slot_time, b.quantity,
            b.total_amount, b.advance_amount, b.balance_due, b.deposit_amount, b.payment_ref, b.payer_name, b.cancel_reason, b.refund_status,
            c.name AS company_name, c.contact_phone, c.whatsapp_number, c.contact_email, l.meeting_point, c.maps_url, b.policy_snapshot,
            rd.docs_required, to_char(rd.pickup_time, 'HH24:MI') AS pickup_time, to_char(rd.return_by_time, 'HH24:MI') AS return_by_time,
            b.pay_to_snapshot
       FROM listing_bookings b
       JOIN adventure_listings l ON l.id = b.listing_id
       JOIN adventure_categories ac ON ac.id = l.category_id
       JOIN companies c ON c.id = b.company_id
       LEFT JOIN listing_rental_details rd ON rd.listing_id = l.id
      WHERE b.id = $1`,
    [bookingId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    token: r.token, code: r.code, title: r.title_snapshot, bookingModel: r.booking_model, customerName: r.customer_name, customerPhone: r.customer_phone,
    customerEmail: r.customer_email, date: r.date, slotTime: r.slot_time, quantity: r.quantity, total: r.total_amount, advance: r.advance_amount,
    balance: r.balance_due, deposit: r.deposit_amount, paymentRef: r.payment_ref, payerName: r.payer_name, cancelReason: r.cancel_reason, refundStatus: r.refund_status,
    company: { name: r.company_name, phone: r.contact_phone, whatsapp: r.whatsapp_number, email: r.contact_email },
    meetingPoint: r.meeting_point, mapsUrl: r.maps_url, docsRequired: r.docs_required ?? [], pickupTime: r.pickup_time, returnByTime: r.return_by_time,
    cancellationPolicy: r.policy_snapshot, payeeName: r.pay_to_snapshot?.payeeName ?? null, upiVpa: r.pay_to_snapshot?.upiVpa ?? null,
  };
}

/**
 * Fan a booking event out to the right people. Email today; SMS / WhatsApp
 * (MSG91) plugs in here later. Never throws — notifications can't fail a booking.
 */
export async function notifyBooking(bookingId: number, event: BookingEvent): Promise<void> {
  try {
    const d = await load(bookingId);
    if (!d) return;
    const toCustomer = (mail: { subject: string; html: string; text: string }) =>
      d.customerEmail ? send({ to: d.customerEmail, replyTo: d.company.email, ...mail }) : Promise.resolve(false);
    const toOperator = (mail: { subject: string; html: string; text: string }) => send({ to: d.company.email, ...mail });
    const kind = typeof event === "string" ? event : event.type;

    switch (kind) {
      case "created": await toCustomer(t.awaitingPaymentEmail(d)); break;
      case "link": await toCustomer(t.bookingLinkEmail(d)); break;
      case "payment_submitted": await Promise.all([toOperator(t.operatorPaymentSubmittedEmail(d)), toCustomer(t.paymentReceivedEmail(d))]); break;
      case "confirmed": await toCustomer(t.confirmedEmail(d)); break;
      case "payment_not_received": await toCustomer(t.paymentNotReceivedEmail(d)); break;
      case "cancelled": await toCustomer(t.cancelledEmail(d)); break;
      case "moved": await toCustomer(t.movedEmail(d)); break;
      case "needs_reschedule": {
        const why = typeof event === "object" ? event.why : "";
        await Promise.all([toCustomer(t.needsRescheduleEmail(d, why)), toOperator(t.operatorNeedsRescheduleEmail(d, why))]);
        break;
      }
    }
  } catch (err) {
    console.error("[notify] booking notification failed:", (err as { code?: string }).code ?? (err as Error).message);
  }
}

/** Notify every booking a blackout just flagged. */
export async function notifyFlagged(bookingIds: number[], why: string): Promise<void> {
  for (const id of bookingIds) await notifyBooking(id, { type: "needs_reschedule", why });
}
