import Link from "next/link";
import { OperatorBookingItem } from "@/components/dashboard/OperatorBookingItem";
import { AddBookingButton } from "@/components/dashboard/AddBookingButton";
import { requireOperatorPage } from "@/lib/operator-auth";
import { listCompanyBookings, companyCounts, type BookingTab } from "@/lib/booking/queries";
import { forCompany } from "@/lib/listings/repo";
import { cn } from "@/lib/cn";

export const metadata = { title: "Bookings" };

const TABS: { key: BookingTab; label: string }[] = [
  { key: "action", label: "Needs action" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];
const EMPTY: Record<BookingTab, string> = {
  action: "Nothing needs you right now. New payments and problems show up here.",
  upcoming: "No upcoming bookings yet.",
  past: "Finished and cancelled bookings will show up here.",
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireOperatorPage();
  const { tab: raw } = await searchParams;
  const tab = (TABS.find((t) => t.key === raw)?.key ?? "action") as BookingTab;
  const [bookings, counts, listings] = await Promise.all([
    listCompanyBookings(session.companyId, tab),
    companyCounts(session.companyId),
    forCompany(session.companyId).list(),
  ]);
  const live = listings.filter((l) => l.status === "published");
  const canWork = session.companyStatus === "approved";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy">Bookings</h1>
          <p className="mt-1 text-navy/70">Confirm payments, hand over vehicles, and keep your days accurate.</p>
        </div>
        {canWork && live.length > 0 && <AddBookingButton listings={live.map((l) => ({ id: l.id, title: l.title, bookingModel: l.bookingModel as "rental_day" | "session" }))} />}
      </div>

      <div className="flex gap-2 text-sm" role="tablist" aria-label="Booking views">
        {TABS.map((t) => {
          const n = t.key === "action" ? counts.action : t.key === "upcoming" ? counts.upcoming : 0;
          return (
            <Link key={t.key} href={`/dashboard/bookings?tab=${t.key}`} role="tab" aria-selected={tab === t.key}
              className={cn("inline-flex h-11 items-center gap-2 rounded-full border px-4 font-medium", tab === t.key ? "border-navy bg-navy text-cream" : "border-navy/15 bg-white text-navy/70 hover:bg-white")}>
              {t.label}
              {n > 0 && <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", t.key === "action" ? "bg-amber-400 text-navy" : tab === t.key ? "bg-white/20" : "bg-navy/10")}>{n}</span>}
            </Link>
          );
        })}
      </div>

      {bookings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-navy/20 bg-white px-5 py-10 text-center text-navy/70">{EMPTY[tab]}</p>
      ) : (
        <ul className="space-y-4">{bookings.map((b) => <OperatorBookingItem key={b.id} b={b} companyName={session.companyName} canWork={canWork || b.status === "cancelled"} />)}</ul>
      )}
    </div>
  );
}
