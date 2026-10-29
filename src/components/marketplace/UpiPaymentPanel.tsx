"use client";

import { useState } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";
import { formatINR } from "@/lib/pricing";
import type { PublicBooking } from "@/lib/booking/queries";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label}`}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); } catch { /* clipboard blocked — the value is still shown */ }
        setDone(true); setTimeout(() => setDone(false), 1800);
      }}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-navy/20 px-3 text-sm font-semibold text-navy hover:bg-navy/5">
      {done ? <><Check className="h-4 w-4 text-green-600" aria-hidden /> Copied</> : <><Copy className="h-4 w-4" aria-hidden /> Copy</>}
    </button>
  );
}

/**
 * Pay the operator directly. Several routes on purpose — UPI apps sometimes
 * refuse pay links to personal accounts, so the UPI ID + exact amount (and the
 * operator's own QR) must always be available.
 */
export function UpiPaymentPanel({ booking, token, qrSvg, upiUri, onSubmitted }: { booking: PublicBooking; token: string; qrSvg: string | null; upiUri: string | null; onSubmitted: () => void }) {
  const pay = booking.payTo!;
  const [utr, setUtr] = useState("");
  const [payer, setPayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api(`/api/book/${token}/payment`, { body: { utr, payerName: payer || undefined } });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields?.utr ?? err.message) : "Couldn't send that. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="pay-h" className="rounded-2xl border border-navy/15 bg-white p-5 sm:p-6">
      <h2 id="pay-h" className="font-serif text-xl font-bold text-navy">1. Pay {formatINR(booking.advance)} to {pay.payeeName}</h2>
      <p className="mt-1 text-sm text-navy/70">This goes straight to the operator. The Adventure Mafia never receives it.</p>

      {upiUri && (
        <Button asChild size="lg" className="mt-4 w-full sm:w-auto"><a href={upiUri}><Smartphone className="h-5 w-5" aria-hidden /> Pay {formatINR(booking.advance)} with a UPI app</a></Button>
      )}
      {upiUri && <p className="mt-2 text-[13px] text-navy/60">Opens GPay, PhonePe, Paytm or any UPI app. If your app won't take it, pay manually below.</p>}

      <dl className="mt-5 space-y-3 border-t border-navy/10 pt-5">
        {pay.upiVpa && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><dt className="text-sm text-navy/60">UPI ID</dt><dd className="truncate font-semibold text-navy">{pay.upiVpa}</dd></div>
            <CopyButton value={pay.upiVpa} label="UPI ID" />
          </div>
        )}
        {pay.upiNumber && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><dt className="text-sm text-navy/60">UPI number</dt><dd className="truncate font-semibold tabular-nums text-navy">{pay.upiNumber}</dd></div>
            <CopyButton value={pay.upiNumber} label="UPI number" />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div><dt className="text-sm text-navy/60">Exact amount</dt><dd className="text-lg font-bold tabular-nums text-navy">{formatINR(booking.advance)}</dd></div>
          <CopyButton value={String(booking.advance)} label="amount" />
        </div>
        <p className="rounded-lg bg-navy/[0.05] px-3 py-2.5 text-sm text-navy">Before you confirm, check the name shown is <strong>{pay.payeeName}</strong>.</p>
      </dl>

      {qrSvg && (
        <details className="group mt-5 border-t border-navy/10 pt-4 md:hidden">
          <summary className="cursor-pointer list-none text-sm font-semibold text-navy underline-offset-2 marker:hidden group-open:mb-3">Show a QR code to scan</summary>
          <div className="mx-auto w-48" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="mt-2 text-center text-[13px] text-navy/60">A phone can't scan its own screen — use this from another device, or screenshot it into your UPI app.</p>
        </details>
      )}
      {qrSvg && (
        <div className="mt-5 hidden border-t border-navy/10 pt-5 md:flex md:items-center md:gap-5">
          <div className="w-40 shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="text-sm leading-relaxed text-navy/70">Scan with any UPI app on your phone. The amount is filled in for you.</p>
        </div>
      )}
      {pay.qrImageUrl && (
        <div className="mt-5 border-t border-navy/10 pt-5">
          <p className="text-sm font-semibold text-navy">Or scan {pay.payeeName}'s own QR</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pay.qrImageUrl} alt={`${pay.payeeName}'s payment QR code`} width={192} height={192} className="mt-2 h-48 w-48 rounded-lg border border-navy/10 bg-white object-contain" />
          <p className="mt-1.5 text-[13px] text-navy/60">This one doesn't fill in the amount — type {formatINR(booking.advance)}.</p>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4 border-t border-navy/10 pt-6" noValidate>
        <h2 className="font-serif text-xl font-bold text-navy">2. Send us the reference number</h2>
        <Field label="UPI reference number (12 digits)" htmlFor="utr" hint="In your UPI app, open the payment and look for “UPI Ref No.” or “UTR”. It's 12 digits — not the longer ID that starts with T.">
          <Input id="utr" inputMode="numeric" autoComplete="off" maxLength={12} required value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))} className="font-mono text-lg tracking-wider" placeholder="328177460912" />
        </Field>
        <Field label="Name you paid from (optional)" htmlFor="payer"><Input id="payer" autoComplete="off" value={payer} onChange={(e) => setPayer(e.target.value)} /></Field>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={busy || utr.length !== 12}>{busy ? "Sending…" : "I've paid"}</Button>
      </form>
    </section>
  );
}
