import { requirePool } from "../db";

/** A payment the customer says they made that the operator hasn't confirmed for this long needs a nudge. */
export const STALE_PAYMENT_HOURS = 2;

export type OverviewStats = {
  last30: Record<string, number>;
  total30: number;
  confirmed30: number;
  advanceConfirmed30: number;
  operatorsApproved: number;
  operatorsPending: number;
  staleCount: number;
  refundsDue: number;
  needsReschedule: number;
};

export type AdminBookingRow = {
  id: number; code: string; status: string; companyId: number; companyName: string; listingTitle: string;
  customerName: string; customerPhone: string; startDate: string; slotTime: string | null; quantity: number;
  total: number; advance: number; paymentRef: string | null; refundStatus: string; source: string;
  createdAt: string; paymentSubmittedAt: string | null; hoursWaiting: number | null;
};

export async function getOverviewStats(): Promise<OverviewStats> {
  const pool = requirePool();
  const [byStatus, advance, ops, attention] = await Promise.all([
    pool.query<{ status: string; n: number }>(
      `SELECT status, count(*)::int AS n FROM listing_bookings WHERE created_at > now() - interval '30 days' GROUP BY status`),
    pool.query<{ s: number | null }>(
      `SELECT COALESCE(sum(advance_amount), 0)::int AS s FROM listing_bookings
        WHERE status IN ('confirmed', 'picked_up', 'completed') AND source = 'online' AND created_at > now() - interval '30 days'`),
    pool.query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM companies WHERE NOT is_seed GROUP BY status`),
    pool.query<{ stale: number; refunds: number; resched: number }>(
      `SELECT count(*) FILTER (WHERE status = 'payment_submitted' AND payment_submitted_at < now() - make_interval(hours => $1))::int AS stale,
              count(*) FILTER (WHERE refund_status = 'due')::int AS refunds,
              count(*) FILTER (WHERE status = 'needs_reschedule')::int AS resched
         FROM listing_bookings`, [STALE_PAYMENT_HOURS]),
  ]);
  const last30: Record<string, number> = {};
  for (const r of byStatus.rows) last30[r.status] = r.n;
  const opCount = (s: string) => ops.rows.find((r) => r.status === s)?.n ?? 0;
  const confirmed30 = (last30.confirmed ?? 0) + (last30.picked_up ?? 0) + (last30.completed ?? 0);
  return {
    last30, total30: Object.values(last30).reduce((a, b) => a + b, 0), confirmed30, advanceConfirmed30: advance.rows[0].s ?? 0,
    operatorsApproved: opCount("approved"), operatorsPending: opCount("pending"),
    staleCount: attention.rows[0].stale, refundsDue: attention.rows[0].refunds, needsReschedule: attention.rows[0].resched,
  };
}

/**
 * "attention": stale payments, refunds due and bookings that need a new day —
 * oldest first. "recent": the latest bookings of any kind.
 */
export async function listAdminBookings(view: "attention" | "recent", limit = 100): Promise<AdminBookingRow[]> {
  const where = view === "attention"
    ? `(b.status = 'payment_submitted' AND b.payment_submitted_at < now() - make_interval(hours => $2)) OR b.refund_status = 'due' OR b.status = 'needs_reschedule'`
    : `TRUE`;
  const order = view === "attention" ? `COALESCE(b.payment_submitted_at, b.updated_at) ASC` : `b.created_at DESC`;
  const res = await requirePool().query(
    `SELECT b.id, b.code, b.status, b.company_id, c.name AS company_name, b.title_snapshot, b.customer_name, b.customer_phone,
            b.start_date::text AS start_date, to_char(b.slot_time, 'HH24:MI') AS slot_time, b.quantity, b.total_amount, b.advance_amount,
            b.payment_ref, b.refund_status, b.source, b.created_at, b.payment_submitted_at,
            CASE WHEN b.status = 'payment_submitted' THEN round(extract(epoch FROM now() - b.payment_submitted_at) / 3600.0, 1)::float END AS hours_waiting
       FROM listing_bookings b JOIN companies c ON c.id = b.company_id
      WHERE ${where}
      ORDER BY ${order}
      LIMIT $1`,
    view === "attention" ? [limit, STALE_PAYMENT_HOURS] : [limit],
  );
  return res.rows.map((r) => ({
    id: r.id, code: r.code, status: r.status, companyId: r.company_id, companyName: r.company_name, listingTitle: r.title_snapshot,
    customerName: r.customer_name, customerPhone: r.customer_phone, startDate: r.start_date, slotTime: r.slot_time, quantity: r.quantity,
    total: r.total_amount, advance: r.advance_amount, paymentRef: r.payment_ref, refundStatus: r.refund_status, source: r.source,
    createdAt: new Date(r.created_at).toISOString(), paymentSubmittedAt: r.payment_submitted_at ? new Date(r.payment_submitted_at).toISOString() : null,
    hoursWaiting: r.hours_waiting,
  }));
}
