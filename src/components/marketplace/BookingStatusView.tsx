"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Clock, Phone, MessageCircle, TriangleAlert, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { CountdownTimer } from "./CountdownTimer";
import { UpiPaymentPanel } from "./UpiPaymentPanel";
import { api, ApiError } from "@/lib/client-api";
import { clock12, shortDate } from "@/lib/format";
import { formatINR } from "@/lib/pricing";
import { whatsappLink } from "@/lib/phone";
import { cn } from "@/lib/cn";
import type { PublicBooking } from "@/lib/booking/queries";

const LIVE = new Set(["pending_payment", "payment_submitted", "needs_reschedule"]);

function Banner({ tone, icon, title, children }: { tone: "green" | "amber" | "red" | "grey"; icon: React.ReactNode; title: React.ReactNode; children?: React.ReactNode }) {
  const styles = { green: "border-green/40 bg-green/10", amber: "border-amber-300 bg-amber-50", red: "border-red-300 bg-red-50", grey: "border-navy/15 bg-navy/[0.04]" }[tone];
  return (
    <div role="status" className={cn("flex gap-3 rounded-2xl border p-5", styles)}>
      <span className="mt-0.5 shrink-0 text-navy">{icon}</span>
      <div><h1 className="font-serif text-2xl font-bold leading-tight text-navy">{title}</h1>{children && <div className="mt-1.5 text-[15px] leading-relaxed text-navy/80">{children}</div>}</div>
    </div>
  );
}

/** For an expired hold: the customer may genuinely have paid, so let them send the reference. */
function LatePaymentForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form className="space-y-4 rounded-2xl border border-navy/15 bg-white p-5" noValidate onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError("");
      try { await api(`/api/book/${token}/payment`, { body: { utr } }); onDone(); }
      catch (err) { setError(err instanceof ApiError ? (err.fields?.utr ?? err.message) : "Couldn't send that."); setBusy(false); }
    }}>
      <h2 className="font-serif text-xl font-bold text-navy">Already paid?</h2>
      <Field label="UPI reference number (12 digits)" htmlFor="late-utr">
        <Input id="late-utr" inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))} className="font-mono tracking-wider" />
      </Field>
      <FormError>{error}</FormError>
      <Button type="submit" disabled={busy || utr.length !== 12}>{busy ? "Sending…" : "Send the reference"}</Button>
    </form>
  );
}

/** The advance row's label follows what actually happened to the money. */
function advanceLabel(b: { status: string; refundStatus: string }): string {
  if (b.refundStatus === "done") return "Advance refunded";
  if (b.refundStatus === "due") return "Advance to be refunded";
  if (["confirmed", "picked_up", "completed", "needs_reschedule"].includes(b.status)) return "Advance paid to the operator";
  return "Advance for the operator";
}

export function BookingStatusView({ initial, token, qrSvg, upiUri }: { initial: PublicBooking; token: string; qrSvg: string | null; upiUri: string | null }) {
  const router = useRouter();
  const b = initial;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Poll while something is pending; when the status changes, re-render from the server
  // (the parent is keyed by status, so this view resets cleanly).
  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => {
    if (!LIVE.has(b.status)) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await api<{ booking: PublicBooking }>(`/api/book/${token}`);
        if (res.booking.status !== b.status) refresh();
      } catch { /* try again next tick */ }
    }, 15000);
    return () => clearInterval(t);
  }, [b.status, token, refresh]);

  async function cancel() {
    if (!confirm("Cancel this reservation?")) return;
    setBusy(true); setError("");
    try { await api(`/api/book/${token}/cancel`, { body: {} }); refresh(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Couldn't cancel."); setBusy(false); }
  }

  const what = `${b.quantity} ${b.bookingModel === "rental_day" ? "×" : b.quantity === 1 ? "person:" : "people:"} ${b.title}`;
  const when = `${shortDate(b.date)}${b.slotTime ? `, ${clock12(b.slotTime)}` : b.pickupTime ? `, pick up from ${clock12(b.pickupTime)}` : ""}`;
  const wa = whatsappLink(b.companyWhatsapp ?? b.companyPhone, `Hi, about my booking ${b.code} for ${b.title} on ${shortDate(b.date)}`);

  return (
    <div className="space-y-6">
      {b.status === "pending_payment" && (
        <Banner tone="amber" icon={<Clock className="h-6 w-6" aria-hidden />} title={<>Pay {formatINR(b.advance)} to hold your booking</>}>
          We're holding it for <strong><CountdownTimer until={b.holdExpiresAt!} onDone={refresh} /></strong>. After that it's released.
        </Banner>
      )}
      {b.status === "payment_submitted" && (
        <Banner tone="amber" icon={<Clock className="h-6 w-6" aria-hidden />} title={`Waiting for ${b.companyName} to confirm`}>
          They'll check reference <strong className="font-mono tabular-nums">{b.paymentRef}</strong> in their UPI app. This page updates by itself, and we'll email you.
        </Banner>
      )}
      {b.status === "confirmed" && <Banner tone="green" icon={<CircleCheck className="h-6 w-6 text-green-600" aria-hidden />} title="You're booked">{b.companyName} confirmed your booking. Show this page, or booking code <strong>{b.code}</strong>, when you arrive.</Banner>}
      {b.status === "picked_up" && <Banner tone="green" icon={<CircleCheck className="h-6 w-6 text-green-600" aria-hidden />} title="Enjoy the ride">Your vehicle has been handed over. Bring it back by {b.returnByTime ? clock12(b.returnByTime) : "the agreed time"}.</Banner>}
      {b.status === "completed" && <Banner tone="grey" icon={<CircleCheck className="h-6 w-6" aria-hidden />} title="All done">Thanks for booking with {b.companyName}.</Banner>}
      {b.status === "needs_reschedule" && <Banner tone="amber" icon={<TriangleAlert className="h-6 w-6" aria-hidden />} title="Your booking needs a new date">{b.companyName} needs to move this booking. They'll contact you to pick a new day, or refund your advance if you'd rather not move.</Banner>}
      {b.status === "cancelled" && (
        <Banner tone="red" icon={<TriangleAlert className="h-6 w-6" aria-hidden />} title="This booking was cancelled">
          {b.cancelReason ? `${b.cancelReason}. ` : ""}
          {b.refundStatus === "due" && <>{b.companyName} will refund your {formatINR(b.advance)} advance. If you haven't heard soon, call them.</>}
          {b.refundStatus === "done" && <>Your advance has been refunded.</>}
        </Banner>
      )}
      {b.status === "expired" && <Banner tone="red" icon={<Clock className="h-6 w-6" aria-hidden />} title="The payment window ended">We released this booking. <strong>If you already paid</strong>, tell {b.companyName} — and you can still send the reference below to ask them to check.</Banner>}
      {b.status === "no_show" && <Banner tone="grey" icon={<TriangleAlert className="h-6 w-6" aria-hidden />} title="Marked as a no-show" />}

      {b.status === "expired" && <LatePaymentForm token={token} onDone={refresh} />}
      {(b.status === "pending_payment") && b.payTo && <UpiPaymentPanel booking={b} token={token} qrSvg={qrSvg} upiUri={upiUri} onSubmitted={refresh} />}

      <section aria-labelledby="sum-h" className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
        <h2 id="sum-h" className="font-serif text-xl font-bold text-navy">Your booking</h2>
        <dl className="mt-3 divide-y divide-navy/10 text-[15px]">
          {[
            ["Code", <span key="c" className="font-mono font-semibold tabular-nums">{b.code}</span>],
            ["What", what], ["When", when], ["Name", b.customerName],
            ["Total", <span key="t" className="tabular-nums">{formatINR(b.total)}</span>],
            [advanceLabel(b), <span key="a" className="font-semibold tabular-nums">{formatINR(b.advance)}</span>],
            [b.bookingModel === "rental_day" ? "Balance at the shop" : "Balance at the start", <span key="b" className="tabular-nums">{formatINR(b.balance)}</span>],
            ...(b.deposit > 0 ? [["Refundable deposit (in person)", <span key="d" className="tabular-nums">{formatINR(b.deposit)}</span>]] : []),
          ].map(([k, v]) => (
            <div key={String(k)} className="grid gap-0.5 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-4"><dt className="text-navy/60">{k}</dt><dd className="text-navy">{v}</dd></div>
          ))}
        </dl>
      </section>

      {(b.status === "confirmed" || b.status === "payment_submitted" || b.status === "pending_payment" || b.status === "picked_up") && (
        <section aria-labelledby="know-h" className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
          <h2 id="know-h" className="font-serif text-xl font-bold text-navy">Before you go</h2>
          <ul className="mt-3 space-y-2.5 text-[15px] text-navy/85">
            {b.meetingPoint && <li className="flex gap-2.5"><MapPin className="mt-0.5 h-[18px] w-[18px] shrink-0 text-navy/60" aria-hidden /><span>{b.meetingPoint}{b.mapsUrl && <> · <a href={b.mapsUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">Map</a></>}</span></li>}
            {b.docsRequired.length > 0 && <li><strong>Bring:</strong> {b.docsRequired.join("; ")}.</li>}
            {b.bookingModel === "rental_day" && b.returnByTime && <li><strong>Return by:</strong> {clock12(b.returnByTime)}.</li>}
            <li><strong>Pay in person:</strong> {formatINR(b.balance)}{b.deposit > 0 ? `, plus a ${formatINR(b.deposit)} refundable deposit` : ""}.</li>
            {b.cancellationPolicy && <li><strong>Cancellation:</strong> {b.cancellationPolicy}</li>}
          </ul>
        </section>
      )}

      <section aria-labelledby="op-h" className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
        <h2 id="op-h" className="font-serif text-xl font-bold text-navy">{b.companyName}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href={`tel:${b.companyPhone}`}><Phone className="h-4 w-4" aria-hidden /> Call</a></Button>
          <Button asChild variant="outline" size="sm"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</a></Button>
          <Button asChild variant="ghost" size="sm"><Link href={`/companies/${b.companySlug}/${b.listingSlug}`}>View the listing</Link></Button>
        </div>
      </section>

      <FormError>{error}</FormError>
      {b.status === "pending_payment" && <button type="button" onClick={cancel} disabled={busy} className="text-sm font-semibold text-red-700 underline underline-offset-2 hover:text-red-800">Cancel this reservation</button>}
      {(b.status === "cancelled" || b.status === "expired") && <Button asChild><Link href={`/companies/${b.companySlug}/${b.listingSlug}`}>Book again</Link></Button>}
    </div>
  );
}
