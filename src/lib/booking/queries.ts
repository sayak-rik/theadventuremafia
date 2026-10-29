import { requirePool } from "../db";
import { todayIST, addDaysISO } from "../dates";
import { getAvailability } from "./availability";
import { expireLapsedHolds, type BookingStatus } from "./transitions";

export type PayTo = { payeeName: string; upiVpa: string | null; upiNumber: string | null; qrImageUrl: string | null };

export type PublicBooking = {
  code: string; status: BookingStatus; title: string; bookingModel: "rental_day" | "session";
  companyName: string; companySlug: string; companyPhone: string; companyWhatsapp: string | null; listingSlug: string;
  customerName: string; date: string; slotTime: string | null; quantity: number;
  unitPrice: number; total: number; advance: number; balance: number; deposit: number;
  holdExpiresAt: string | null; cancellationPolicy: string | null; meetingPoint: string | null; mapsUrl: string | null;
  docsRequired: string[]; pickupTime: string | null; returnByTime: string | null;
  payTo: PayTo | null; paymentRef: string | null; refundStatus: string; cancelReason: string | null; createdAt: string;
};

/** What a customer sees on their booking page. Payee details are only included while payment is relevant. */
export async function getBookingForCustomer(token: string): Promise<PublicBooking | null> {
  const pool = requirePool();
  // Cosmetic label sync for this one booking so "expired" shows up promptly.
  await pool.query(`UPDATE listing_bookings SET status = 'expired', updated_at = now() WHERE token = $1 AND status = 'pending_payment' AND hold_expires_at < now()`, [token]);
  const res = await pool.query(
    `SELECT b.code, b.status, b.title_snapshot, ac.booking_model, c.name AS company_name, c.slug AS company_slug, c.contact_phone, c.whatsapp_number,
            l.slug AS listing_slug, b.customer_name, to_char(b.start_date, 'YYYY-MM-DD') AS date, to_char(b.slot_time, 'HH24:MI') AS slot_time,
            b.quantity, b.unit_price, b.total_amount, b.advance_amount, b.balance_due, b.deposit_amount, b.hold_expires_at, b.policy_snapshot,
            l.meeting_point, c.maps_url, rd.docs_required, to_char(rd.pickup_time, 'HH24:MI') AS pickup_time, to_char(rd.return_by_time, 'HH24:MI') AS return_by_time,
            b.pay_to_snapshot, b.payment_ref, b.refund_status, b.cancel_reason, b.created_at
       FROM listing_bookings b
       JOIN adventure_listings l ON l.id = b.listing_id
       JOIN adventure_categories ac ON ac.id = l.category_id
       JOIN companies c ON c.id = b.company_id
       LEFT JOIN listing_rental_details rd ON rd.listing_id = l.id
      WHERE b.token = $1`,
    [token],
  );
  const r = res.rows[0];
  if (!r) return null;
  const showPay = r.status === "pending_payment" || r.status === "payment_submitted";
  return {
    code: r.code, status: r.status, title: r.title_snapshot, bookingModel: r.booking_model, companyName: r.company_name, companySlug: r.company_slug,
    companyPhone: r.contact_phone, companyWhatsapp: r.whatsapp_number, listingSlug: r.listing_slug, customerName: r.customer_name, date: r.date,
    slotTime: r.slot_time, quantity: r.quantity, unitPrice: r.unit_price, total: r.total_amount, advance: r.advance_amount, balance: r.balance_due,
    deposit: r.deposit_amount, holdExpiresAt: r.hold_expires_at ? new Date(r.hold_expires_at).toISOString() : null, cancellationPolicy: r.policy_snapshot,
    meetingPoint: r.meeting_point, mapsUrl: r.maps_url, docsRequired: r.docs_required ?? [], pickupTime: r.pickup_time, returnByTime: r.return_by_time,
    payTo: showPay ? (r.pay_to_snapshot as PayTo) : null, paymentRef: r.payment_ref, refundStatus: r.refund_status, cancelReason: r.cancel_reason,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export type OperatorBookingRow = {
  id: number; listingId: number; code: string; status: BookingStatus; source: string; title: string; bookingModel: "rental_day" | "session";
  customerName: string; customerPhone: string; customerEmail: string | null; date: string; slotTime: string | null; quantity: number;
  total: number; advance: number; balance: number; deposit: number; paymentRef: string | null; payerName: string | null;
  holdExpiresAt: string | null; participants: { name: string; age: number; weightKg: number }[] | null; refundStatus: string;
  assignedVehicleReg: string | null; opsNote: string | null; cancelReason: string | null; createdAt: string; paymentSubmittedAt: string | null;
};

export type BookingTab = "action" | "upcoming" | "past";

const BASE = `SELECT b.id, b.listing_id, b.code, b.status, b.source, b.title_snapshot, ac.booking_model, b.customer_name, b.customer_phone, b.customer_email,
    to_char(b.start_date, 'YYYY-MM-DD') AS date, to_char(b.slot_time, 'HH24:MI') AS slot_time, b.quantity, b.total_amount, b.advance_amount,
    b.balance_due, b.deposit_amount, b.payment_ref, b.payer_name, b.hold_expires_at, b.participants, b.refund_status, b.assigned_vehicle_reg,
    b.ops_note, b.cancel_reason, b.created_at, b.payment_submitted_at
  FROM listing_bookings b JOIN adventure_listings l ON l.id = b.listing_id JOIN adventure_categories ac ON ac.id = l.category_id`;

const mapRow = (r: Record<string, any>): OperatorBookingRow => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
  id: r.id, listingId: r.listing_id, code: r.code, status: r.status, source: r.source, title: r.title_snapshot, bookingModel: r.booking_model,
  customerName: r.customer_name, customerPhone: r.customer_phone, customerEmail: r.customer_email, date: r.date, slotTime: r.slot_time,
  quantity: r.quantity, total: r.total_amount, advance: r.advance_amount, balance: r.balance_due, deposit: r.deposit_amount,
  paymentRef: r.payment_ref, payerName: r.payer_name, holdExpiresAt: r.hold_expires_at ? new Date(r.hold_expires_at).toISOString() : null,
  participants: r.participants, refundStatus: r.refund_status, assignedVehicleReg: r.assigned_vehicle_reg, opsNote: r.ops_note,
  cancelReason: r.cancel_reason, createdAt: new Date(r.created_at).toISOString(),
  paymentSubmittedAt: r.payment_submitted_at ? new Date(r.payment_submitted_at).toISOString() : null,
});

/** The operator's bookings, scoped to their company. */
export async function listCompanyBookings(companyId: number, tab: BookingTab, limit = 100): Promise<OperatorBookingRow[]> {
  const pool = requirePool();
  await expireLapsedHolds(pool, { companyId });
  const where: Record<BookingTab, string> = {
    // Money to verify, problems to fix, refunds owed, and unpaid holds still ticking.
    action: `b.company_id = $1 AND (b.status IN ('payment_submitted','needs_reschedule') OR (b.status = 'pending_payment' AND b.hold_expires_at > now()) OR (b.status = 'cancelled' AND b.refund_status = 'due'))`,
    upcoming: `b.company_id = $1 AND b.status IN ('confirmed','picked_up')`,
    past: `b.company_id = $1 AND b.status IN ('completed','no_show','cancelled','expired') AND NOT (b.status = 'cancelled' AND b.refund_status = 'due')`,
  };
  const order = tab === "past" ? "b.start_date DESC, b.id DESC" : tab === "action" ? "(b.status = 'payment_submitted') DESC, b.payment_submitted_at NULLS LAST, b.created_at" : "b.start_date, b.slot_time NULLS FIRST, b.id";
  const res = await pool.query(`${BASE} WHERE ${where[tab]} ORDER BY ${order} LIMIT $2`, [companyId, limit]);
  return res.rows.map(mapRow);
}

export async function getCompanyBooking(companyId: number, id: number): Promise<{ booking: OperatorBookingRow; events: { at: string; actor: string; from: string | null; to: string | null; note: string | null }[] } | null> {
  const pool = requirePool();
  const res = await pool.query(`${BASE} WHERE b.company_id = $1 AND b.id = $2`, [companyId, id]);
  if (!res.rows[0]) return null;
  const ev = await pool.query(`SELECT created_at, actor_type, from_status, to_status, note FROM booking_events WHERE booking_id = $1 ORDER BY id`, [id]);
  return {
    booking: mapRow(res.rows[0]),
    events: ev.rows.map((e) => ({ at: new Date(e.created_at).toISOString(), actor: e.actor_type, from: e.from_status, to: e.to_status, note: e.note })),
  };
}

export type CompanyCounts = { action: number; upcoming: number };

export async function companyCounts(companyId: number): Promise<CompanyCounts> {
  const res = await requirePool().query<{ action: number; upcoming: number }>(
    `SELECT count(*) FILTER (WHERE status IN ('payment_submitted','needs_reschedule') OR (status = 'cancelled' AND refund_status = 'due'))::int AS action,
            count(*) FILTER (WHERE status IN ('confirmed','picked_up') AND end_date >= CURRENT_DATE)::int AS upcoming
       FROM listing_bookings WHERE company_id = $1`,
    [companyId],
  );
  return res.rows[0];
}

export type TodayBoard = {
  today: OperatorBookingRow[];
  outNow: OperatorBookingRow[];
  tomorrow: { listingId: number; title: string; bookingModel: "rental_day" | "session"; slots: { slotTime: string | null; available: number; capacity: number }[] }[];
};

/** The operator's "today board": who's arriving, what's out, and what's free tomorrow. */
export async function getTodayBoard(companyId: number): Promise<TodayBoard> {
  const pool = requirePool();
  const today = todayIST();
  const tomorrow = addDaysISO(today, 1);
  const todays = await pool.query(`${BASE} WHERE b.company_id = $1 AND b.start_date = $2 AND b.status IN ('confirmed','picked_up','completed') ORDER BY b.slot_time NULLS FIRST, b.id`, [companyId, today]);
  const out = await pool.query(`${BASE} WHERE b.company_id = $1 AND b.status = 'picked_up' AND b.start_date < $2 ORDER BY b.start_date`, [companyId, today]);
  const listings = await pool.query<{ id: number; title: string; booking_model: "rental_day" | "session" }>(
    `SELECT l.id, l.title, ac.booking_model FROM adventure_listings l JOIN adventure_categories ac ON ac.id = l.category_id
      WHERE l.company_id = $1 AND l.status = 'published' ORDER BY l.title`,
    [companyId],
  );
  const free = [];
  for (const l of listings.rows) {
    const rows = await getAvailability(pool, l.id, tomorrow, tomorrow);
    free.push({ listingId: l.id, title: l.title, bookingModel: l.booking_model, slots: rows.map((r) => ({ slotTime: r.slotTime, available: r.available, capacity: r.capacity })) });
  }
  return { today: todays.rows.map(mapRow), outNow: out.rows.map(mapRow), tomorrow: free };
}
