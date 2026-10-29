"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { StatusDot } from "@/components/ui/status";
import { CountdownTimer } from "@/components/marketplace/CountdownTimer";
import { api, ApiError } from "@/lib/client-api";
import { clock12, shortDate } from "@/lib/format";
import { formatINR } from "@/lib/pricing";
import { whatsappLink } from "@/lib/phone";
import { cn } from "@/lib/cn";
import type { OperatorBookingRow } from "@/lib/booking/queries";

const STATUS: Record<string, { label: string; tone: "green" | "amber" | "grey" | "red" | "blue" }> = {
  pending_payment: { label: "Waiting for payment", tone: "grey" },
  payment_submitted: { label: "Check your UPI", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "green" },
  picked_up: { label: "Out with customer", tone: "blue" },
  completed: { label: "Completed", tone: "grey" },
  no_show: { label: "No-show", tone: "grey" },
  cancelled: { label: "Cancelled", tone: "red" },
  expired: { label: "Expired", tone: "grey" },
  needs_reschedule: { label: "Needs a new date", tone: "amber" },
};

type Dialog = null | "confirm" | "pickup" | "return" | "move" | "cancel";

export function OperatorBookingItem({ b, companyName, canWork }: { b: OperatorBookingRow; companyName: string; canWork: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [depositFlag, setDepositFlag] = useState(true);
  const [reason, setReason] = useState("");
  const [noRefund, setNoRefund] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [moveSlots, setMoveSlots] = useState<{ slotTime: string | null; available: number }[]>([]);
  const [moveSlot, setMoveSlot] = useState<string | null>(null);

  const st = STATUS[b.status] ?? STATUS.pending_payment;
  const isSession = b.bookingModel === "session";
  const when = `${shortDate(b.date)}${b.slotTime ? `, ${clock12(b.slotTime)}` : ""}`;
  const wa = whatsappLink(b.customerPhone, `Hi ${b.customerName}, this is ${companyName} about your booking ${b.code} for ${b.title} on ${shortDate(b.date)}`);

  async function act(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      await api(`/api/operator/bookings/${b.id}/action`, { body });
      setDialog(null); setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // For "move": look up what's free on the chosen day.
  useEffect(() => {
    if (dialog !== "move" || !moveDate) return;
    let live = true;
    api<{ days: { date: string; slots: { slotTime: string | null; available: number }[] }[] }>(`/api/public/listings/${b.listingId}/availability?from=${moveDate}&to=${moveDate}`)
      .then((r) => { if (live) { setMoveSlots(r.days[0]?.slots ?? []); setMoveSlot(null); } })
      .catch(() => live && setMoveSlots([]));
    return () => { live = false; };
  }, [dialog, moveDate, b.listingId]);

  const open = (d: Dialog) => { setError(""); setDialog(d); };
  const close = (v: boolean) => { if (!v) { setDialog(null); setError(""); } };
  const moveOk = moveDate && moveSlots.some((s) => s.available >= b.quantity && (!isSession || s.slotTime === moveSlot));

  return (
    <li className={cn("rounded-2xl border bg-white p-4 sm:p-5", b.status === "payment_submitted" ? "border-amber-300 shadow-sm" : "border-navy/10")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusDot tone={st.tone}>{st.label}</StatusDot>
        <span className="text-sm tabular-nums text-navy/50">{b.code}{b.source === "walk_in" ? " · walk-in" : ""}</span>
      </div>

      <p className="mt-2 text-lg font-semibold text-navy">{b.customerName}</p>
      <p className="text-[15px] text-navy/85">{b.quantity} {isSession ? (b.quantity === 1 ? "person" : "people") : "×"} {b.title}</p>
      <p className="text-[15px] font-medium text-navy">{when}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><a href={`tel:${b.customerPhone}`}><Phone className="h-4 w-4" aria-hidden /> {b.customerPhone}</a></Button>
        <Button asChild variant="outline" size="sm"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</a></Button>
      </div>

      {b.status === "payment_submitted" && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4">
          <p className="text-[15px] text-navy">Look for <strong className="text-lg tabular-nums">{formatINR(b.advance)}</strong> in your UPI app.</p>
          <p className="mt-1 text-sm text-navy/80">UPI reference <strong className="font-mono tabular-nums">{b.paymentRef}</strong>{b.payerName ? ` · paid by ${b.payerName}` : ""}</p>
        </div>
      )}

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-navy/70">
        <div className="flex gap-1.5"><dt>Total</dt><dd className="font-semibold tabular-nums text-navy">{formatINR(b.total)}</dd></div>
        <div className="flex gap-1.5"><dt>Advance</dt><dd className="font-semibold tabular-nums text-navy">{formatINR(b.advance)}</dd></div>
        <div className="flex gap-1.5"><dt>Balance</dt><dd className="font-semibold tabular-nums text-navy">{formatINR(b.balance)}</dd></div>
        {b.deposit > 0 && <div className="flex gap-1.5"><dt>Deposit</dt><dd className="font-semibold tabular-nums text-navy">{formatINR(b.deposit)}</dd></div>}
      </dl>

      {b.participants && b.participants.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-navy underline-offset-2">Who's coming ({b.participants.length})</summary>
          <ul className="mt-2 space-y-1 text-navy/80">{b.participants.map((p, i) => <li key={i} className="tabular-nums">{p.name} · {p.age} yrs · {p.weightKg} kg</li>)}</ul>
        </details>
      )}
      {b.assignedVehicleReg && <p className="mt-2 text-sm text-navy/70">Vehicle: <strong className="text-navy">{b.assignedVehicleReg}</strong></p>}
      {b.status === "cancelled" && b.cancelReason && <p className="mt-2 text-sm text-navy/70">Reason: {b.cancelReason}</p>}
      {b.status === "pending_payment" && b.holdExpiresAt && <p className="mt-2 text-sm text-navy/70">Held for <strong><CountdownTimer until={b.holdExpiresAt} onDone={() => router.refresh()} /></strong> more minutes</p>}
      {b.status === "needs_reschedule" && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-navy">Move this booking to another day, or cancel and refund the advance.</p>}
      {b.status === "cancelled" && b.refundStatus === "due" && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-navy">They paid {formatINR(b.advance)}. Refund it to their UPI, then mark it done.</p>}

      {canWork && (
        <div className="mt-4 flex flex-wrap gap-2">
          {b.status === "payment_submitted" && <Button onClick={() => open("confirm")}>Check payment</Button>}
          {b.status === "confirmed" && !isSession && <Button onClick={() => open("pickup")}>Hand over vehicle</Button>}
          {b.status === "confirmed" && isSession && <Button onClick={() => act({ action: "complete" })} disabled={busy}>Mark completed</Button>}
          {b.status === "confirmed" && <Button variant="outline" onClick={() => act({ action: "no_show" })} disabled={busy}>No-show</Button>}
          {b.status === "picked_up" && <Button onClick={() => open("return")}>Mark returned</Button>}
          {["payment_submitted", "confirmed", "needs_reschedule"].includes(b.status) && <Button variant="outline" onClick={() => { setMoveDate(""); setMoveSlots([]); open("move"); }}>Move to another day</Button>}
          {["pending_payment", "payment_submitted", "confirmed", "needs_reschedule"].includes(b.status) && <Button variant="ghost" onClick={() => open("cancel")}>Cancel</Button>}
          {b.status === "cancelled" && b.refundStatus === "due" && <Button onClick={() => act({ action: "refund_done" })} disabled={busy}>I've refunded it</Button>}
        </div>
      )}
      {!dialog && <div className="mt-2"><FormError>{error}</FormError></div>}

      <Sheet open={dialog === "confirm"} onOpenChange={close} title="Did the money arrive?" description={`Open your UPI app and look for ${formatINR(b.advance)} with reference ${b.paymentRef}.`}>
        <div className="space-y-3">
          <FormError>{error}</FormError>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => act({ action: "confirm_payment" })}>Yes, it's there — confirm</Button>
          <Button size="lg" variant="outline" className="w-full" disabled={busy} onClick={() => act({ action: "reject_payment" })}>I can't see it</Button>
          <p className="text-[13px] text-navy/60">Only confirm if the money has reached your account. If you can't see it, the customer is asked to re-check the reference.</p>
        </div>
      </Sheet>

      <Sheet open={dialog === "pickup"} onOpenChange={close} title="Hand over the vehicle" description="Check their original licence and photo ID first.">
        <div className="space-y-4">
          <Field label="Vehicle registration (optional)" htmlFor={`reg-${b.id}`}><Input id={`reg-${b.id}`} value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} placeholder="SK 04 1234" /></Field>
          {b.deposit > 0 && <Checkbox checked={depositFlag} onChange={(e) => setDepositFlag(e.target.checked)} label={`I collected the ${formatINR(b.deposit)} deposit`} />}
          <FormError>{error}</FormError>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => act({ action: "pickup", vehicleReg: vehicleReg || undefined, depositCollected: b.deposit > 0 ? depositFlag : false })}>Vehicle handed over</Button>
        </div>
      </Sheet>

      <Sheet open={dialog === "return"} onOpenChange={close} title="Vehicle returned" description="Check it over before you close this out.">
        <div className="space-y-4">
          {b.deposit > 0 && <Checkbox checked={depositFlag} onChange={(e) => setDepositFlag(e.target.checked)} label={`I gave back the ${formatINR(b.deposit)} deposit`} />}
          <FormError>{error}</FormError>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => act({ action: "return", depositReturned: b.deposit > 0 ? depositFlag : false })}>Mark returned</Button>
        </div>
      </Sheet>

      <Sheet open={dialog === "move"} onOpenChange={close} title="Move to another day" description="Only days with room for this booking can be chosen.">
        <div className="space-y-4">
          <Field label="New date" htmlFor={`mv-${b.id}`}><Input id={`mv-${b.id}`} type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} /></Field>
          {moveDate && isSession && (
            <div className="flex flex-wrap gap-2">
              {moveSlots.length === 0 ? <p className="text-sm text-navy/70">Nothing is offered that day.</p> : moveSlots.map((s) => (
                <button key={s.slotTime} type="button" disabled={s.available < b.quantity} aria-pressed={moveSlot === s.slotTime} onClick={() => setMoveSlot(s.slotTime)}
                  className={cn("min-h-12 rounded-lg border px-4 text-left disabled:opacity-40", moveSlot === s.slotTime ? "border-navy bg-navy text-cream" : "border-navy/20")}>
                  <span className="block font-semibold tabular-nums">{clock12(s.slotTime!)}</span><span className="block text-xs opacity-70">{s.available} seats left</span>
                </button>
              ))}
            </div>
          )}
          {moveDate && !isSession && <p className="text-sm text-navy/70">{moveSlots[0] ? `${moveSlots[0].available} free that day.` : "Not available that day."}</p>}
          <FormError>{error}</FormError>
          <Button size="lg" className="w-full" disabled={busy || !moveOk} onClick={() => act({ action: "move", date: moveDate, slotTime: isSession ? moveSlot : null })}>Move booking</Button>
          <p className="text-[13px] text-navy/60">The customer is emailed the new date.</p>
        </div>
      </Sheet>

      <Sheet open={dialog === "cancel"} onOpenChange={close} title="Cancel this booking?" description="The customer is emailed and the vehicle or seats go back on sale.">
        <div className="space-y-4">
          <Field label="Reason (optional)" htmlFor={`rs-${b.id}`}><Textarea id={`rs-${b.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown to the customer" /></Field>
          {b.paymentRef && <Checkbox checked={noRefund} onChange={(e) => setNoRefund(e.target.checked)} label="No refund is due" hint="Tick this only if your cancellation policy means they don't get the advance back." />}
          <FormError>{error}</FormError>
          <Button size="lg" variant="danger" className="w-full" disabled={busy} onClick={() => act({ action: "cancel", reason: reason || undefined, noRefund })}>Cancel booking</Button>
        </div>
      </Sheet>
    </li>
  );
}
