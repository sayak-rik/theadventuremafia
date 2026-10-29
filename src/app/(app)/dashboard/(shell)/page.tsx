import Link from "next/link";
import { Check, Circle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status";
import { requireOperatorPage } from "@/lib/operator-auth";
import { forCompany } from "@/lib/listings/repo";
import { getCompanyProfile, getPaymentSettings } from "@/lib/operators/account";
import { companyCounts, getTodayBoard } from "@/lib/booking/queries";
import { clock12, shortDate } from "@/lib/format";
import { todayIST } from "@/lib/dates";

export const metadata = { title: "Today" };

function Step({ done, href, title, body }: { done: boolean; href: string; title: string; body: string }) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-4 py-4 hover:bg-navy/[0.02]">
        <span aria-hidden className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-green text-navy" : "border-2 border-navy/25 text-navy/25"}`}>
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-2 w-2 fill-current" />}
        </span>
        <span>
          <span className={`block font-semibold ${done ? "text-navy/60 line-through decoration-navy/30" : "text-navy"}`}>{title}</span>
          <span className="mt-0.5 block text-sm text-navy/65">{body}</span>
        </span>
      </Link>
    </li>
  );
}

export default async function DashboardHome() {
  const session = await requireOperatorPage();
  const [profile, payment, listings, counts, board] = await Promise.all([
    getCompanyProfile(session.companyId),
    getPaymentSettings(session.companyId),
    forCompany(session.companyId).list(),
    companyCounts(session.companyId),
    getTodayBoard(session.companyId),
  ]);

  const hasPayment = Boolean(payment && (payment.upiVpa || payment.upiNumber || payment.qrImageUrl));
  const hasListing = listings.length > 0;
  const hasPhotos = listings.some((l) => l.imageCount > 0);
  const submitted = listings.some((l) => l.status !== "draft");
  const live = listings.filter((l) => l.status === "published").length;
  const first = (session.name ?? "").trim().split(" ")[0];
  const setupDone = hasPayment && hasListing && hasPhotos && submitted;
  const today = todayIST();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy">{first ? `Hello, ${first}` : "Hello"}</h1>
        <p className="mt-1 text-navy/70">{profile.name} · {shortDate(today)}</p>
      </div>

      {session.companyStatus === "pending" && (
        <div role="status" className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-[15px] leading-relaxed text-navy">
          <strong>We're reviewing your application.</strong> We'll email you and may call {profile.contactPhone} to verify your business.
          You can set everything up now — your listings go live after you're approved and each one is reviewed.
        </div>
      )}
      {session.companyStatus === "rejected" && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-[15px] leading-relaxed text-navy">
          <strong>We couldn't approve your application yet.</strong> {profile.rejectionReason}
        </div>
      )}
      {session.companyStatus === "suspended" && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-[15px] leading-relaxed text-navy">
          <strong>Your account is suspended and your listings are hidden.</strong> {profile.rejectionReason} Call us to sort this out.
        </div>
      )}

      {counts.action > 0 && (
        <Link href="/dashboard/bookings" className="flex items-center justify-between gap-4 rounded-2xl bg-navy p-5 text-cream transition hover:bg-navy-700">
          <span><strong className="block font-serif text-2xl tabular-nums">{counts.action} {counts.action === 1 ? "booking needs" : "bookings need"} you</strong><span className="text-sm text-cream/70">Payments to check, dates to move, refunds to send.</span></span>
          <span className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-navy">Open</span>
        </Link>
      )}

      {session.companyStatus === "approved" && live > 0 && (
        <>
          <section aria-labelledby="today-h">
            <h2 id="today-h" className="font-serif text-xl font-bold text-navy">Today</h2>
            {board.today.length === 0 ? (
              <p className="mt-2 text-navy/70">Nothing booked for today yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
                {board.today.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{b.slotTime ? clock12(b.slotTime) : "Pick-up"} · {b.customerName}</p>
                      <p className="truncate text-sm text-navy/70">{b.quantity} {b.bookingModel === "session" ? (b.quantity === 1 ? "person" : "people") : "×"} {b.title}</p>
                      <StatusDot tone={b.status === "picked_up" ? "blue" : b.status === "completed" ? "grey" : "green"} className="mt-1 text-[13px]">{b.status === "picked_up" ? "Out with customer" : b.status === "completed" ? "Completed" : "Confirmed"}</StatusDot>
                    </div>
                    <Button asChild variant="outline" size="sm"><a href={`tel:${b.customerPhone}`} aria-label={`Call ${b.customerName}`}><Phone className="h-4 w-4" aria-hidden /></a></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {board.outNow.length > 0 && (
            <section aria-labelledby="out-h">
              <h2 id="out-h" className="font-serif text-xl font-bold text-navy">Still out</h2>
              <ul className="mt-2 divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
                {board.outNow.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0"><p className="font-semibold text-navy">{b.customerName}</p><p className="truncate text-sm text-navy/70">{b.title}{b.assignedVehicleReg ? ` · ${b.assignedVehicleReg}` : ""} · since {shortDate(b.date)}</p></div>
                    <Button asChild variant="outline" size="sm"><Link href="/dashboard/bookings?tab=upcoming">Open</Link></Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="tom-h">
            <h2 id="tom-h" className="font-serif text-xl font-bold text-navy">Free tomorrow</h2>
            <ul className="mt-2 divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
              {board.tomorrow.map((l) => (
                <li key={l.listingId} className="p-4">
                  <p className="font-semibold text-navy">{l.title}</p>
                  {l.slots.length === 0 ? <p className="text-sm text-navy/60">Closed tomorrow</p> : (
                    <p className="mt-0.5 text-sm text-navy/75 tabular-nums">
                      {l.slots.map((s, i) => <span key={i} className="mr-4 inline-block">{s.slotTime ? `${clock12(s.slotTime)}: ` : ""}<strong className={s.available === 0 ? "text-red-700" : "text-navy"}>{s.available}</strong> of {s.capacity} free</span>)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {!setupDone && (
        <section aria-labelledby="setup">
          <h2 id="setup" className="font-serif text-xl font-bold text-navy">Get set up</h2>
          <ul className="mt-2 divide-y divide-navy/10 border-y border-navy/10">
            <Step done={hasPayment} href="/dashboard/payments" title="Add your payment details" body="Your UPI ID or QR — customers pay your advance straight to you." />
            <Step done={hasListing} href={hasListing ? "/dashboard/listings" : "/dashboard/listings/new"} title="Add your first listing" body="A vehicle you rent out, or a rafting or paragliding trip with time slots." />
            <Step done={hasPhotos} href="/dashboard/listings" title="Add photos" body="A few clear photos help customers choose. We shrink them automatically." />
            <Step done={submitted} href="/dashboard/listings" title="Submit for review" body="We check each listing once before it goes live." />
          </ul>
        </section>
      )}

      {setupDone && live === 0 && <p className="text-[15px] text-navy/80">Your listing is with our team for review. We'll email you the moment it's decided.</p>}

      <div><Button asChild variant={hasListing ? "outline" : "primary"}><Link href="/dashboard/listings/new">Add a listing</Link></Button></div>
    </div>
  );
}
