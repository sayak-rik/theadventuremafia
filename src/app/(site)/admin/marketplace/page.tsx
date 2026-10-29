import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusDot } from "@/components/ui/status";
import { adminConfigured, isAdminAuthed } from "@/lib/admin-auth";
import { getOverviewStats, listAdminBookings, STALE_PAYMENT_HOURS, type AdminBookingRow } from "@/lib/booking/admin-overview";
import { expireLapsedHolds } from "@/lib/booking/transitions";
import { requirePool } from "@/lib/db";
import { whatsappLink } from "@/lib/phone";
import { formatINR } from "@/lib/pricing";
import { shortDate, clock12 } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Admin · Marketplace bookings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "green" | "amber" | "grey" | "red" | "blue" }> = {
  pending_payment: { label: "Waiting for payment", tone: "amber" },
  payment_submitted: { label: "Payment sent, not confirmed", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "green" },
  picked_up: { label: "Out on rental", tone: "blue" },
  completed: { label: "Completed", tone: "grey" },
  cancelled: { label: "Cancelled", tone: "grey" },
  expired: { label: "Hold ran out", tone: "grey" },
  no_show: { label: "No-show", tone: "red" },
  needs_reschedule: { label: "Needs a new day", tone: "red" },
};

function Stat({ value, label, hint, alert }: { value: string | number; label: string; hint?: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-white p-4", alert ? "border-amber-300 bg-amber-50" : "border-navy/10")}>
      <p className="font-serif text-2xl font-bold tabular-nums text-navy">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-navy">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-navy/55">{hint}</p>}
    </div>
  );
}

function Row({ b }: { b: AdminBookingRow }) {
  const st = STATUS[b.status] ?? { label: b.status, tone: "grey" as const };
  const when = `${shortDate(b.startDate)}${b.slotTime ? `, ${clock12(b.slotTime)}` : ""}`;
  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-navy">
          <span className="font-mono tabular-nums">{b.code}</span> · {b.quantity} × {b.listingTitle}
        </p>
        <p className="text-sm text-navy/70">
          <Link href={`/admin/operators/${b.companyId}`} className="underline underline-offset-2">{b.companyName}</Link> · {when}
          {b.source === "walk_in" && " · added by the operator"}
        </p>
        <p className="text-sm text-navy/70">
          {b.customerName} · <a className="underline underline-offset-2" href={`tel:${b.customerPhone}`}>{b.customerPhone}</a> ·{" "}
          <a className="underline underline-offset-2" href={whatsappLink(b.customerPhone, `Hi, about booking ${b.code} on The Adventure Mafia`)} target="_blank" rel="noreferrer">WhatsApp</a>
        </p>
        <p className="text-sm text-navy/70">
          {formatINR(b.total)} total, {formatINR(b.advance)} advance{b.paymentRef ? <> · UPI ref <span className="font-mono tabular-nums">{b.paymentRef}</span></> : null}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <StatusDot tone={st.tone}>{st.label}</StatusDot>
        {b.status === "payment_submitted" && b.hoursWaiting != null && (
          <span className={cn("text-xs", b.hoursWaiting >= STALE_PAYMENT_HOURS ? "font-semibold text-amber-800" : "text-navy/55")}>
            waiting {b.hoursWaiting < 1 ? "under an hour" : `${b.hoursWaiting} h`}
          </span>
        )}
        {b.refundStatus === "due" && <span className="text-xs font-semibold text-red-700">Refund due from the operator</span>}
      </div>
    </li>
  );
}

export default async function AdminMarketplacePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!adminConfigured() || !(await isAdminAuthed())) redirect("/admin/login");
  const { view } = await searchParams;
  const current = view === "recent" ? "recent" : "attention";
  await expireLapsedHolds(requirePool()); // keep labels honest before showing them
  const [stats, rows] = await Promise.all([getOverviewStats(), listAdminBookings(current)]);
  const attention = stats.staleCount + stats.refundsDue + stats.needsReschedule;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="marketplace" />
      <h1 className="mt-3 font-serif text-3xl font-bold text-navy">Marketplace bookings</h1>
      <p className="mt-1 text-sm text-navy/60">Bookings across all operators. Operators confirm their own payments; this is where you spot the ones that are stuck.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={stats.total30} label="Bookings, last 30 days" hint={`${stats.confirmed30} confirmed or done`} />
        <Stat value={formatINR(stats.advanceConfirmed30)} label="Advances confirmed" hint="Paid to operators, not to us" />
        <Stat value={stats.operatorsApproved} label="Approved operators" hint={stats.operatorsPending > 0 ? `${stats.operatorsPending} waiting for approval` : "None waiting"} alert={stats.operatorsPending > 0} />
        <Stat value={attention} label="Need a look" hint={`${stats.staleCount} unconfirmed over ${STALE_PAYMENT_HOURS} h · ${stats.refundsDue} refunds · ${stats.needsReschedule} to move`} alert={attention > 0} />
      </div>

      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        {[{ key: "attention", label: `Needs a look (${attention})` }, { key: "recent", label: "Latest bookings" }].map((t) => (
          <Link key={t.key} href={`/admin/marketplace?view=${t.key}`} aria-current={current === t.key ? "page" : undefined}
            className={cn("rounded-full border px-3.5 py-1.5 font-medium", current === t.key ? "border-navy bg-navy text-cream" : "border-navy/15 bg-white text-navy/70 hover:bg-cream")}>
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-navy/10 bg-white px-4 py-8 text-center text-navy/60">
          {current === "attention" ? "Nothing is stuck." : "No bookings yet."}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
          {rows.map((b) => <Row key={b.id} b={b} />)}
        </ul>
      )}
    </section>
  );
}
