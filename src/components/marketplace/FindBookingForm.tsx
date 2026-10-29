"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";

export function FindBookingForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) {
    return <p role="status" className="leading-relaxed text-navy">If those details match a booking, we've emailed the link to the address on it. Check your inbox (and spam) in a minute.</p>;
  }
  return (
    <form noValidate className="space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      setBusy(true); setError("");
      try { await api("/api/book/find", { body: { code: String(f.get("code") ?? ""), phone: String(f.get("phone") ?? "") } }); setDone(true); }
      catch (err) { setError(err instanceof ApiError ? err.message : "Something went wrong."); }
      finally { setBusy(false); }
    }}>
      <Field label="Booking code" htmlFor="code" hint="Looks like BK-7K3Q9X. It's in your emails and on your booking page."><Input id="code" name="code" required autoCapitalize="characters" placeholder="BK-7K3Q9X" /></Field>
      <Field label="Mobile number you booked with" htmlFor="phone"><Input id="phone" name="phone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="98765 43210" /></Field>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Sending…" : "Email me the link"}</Button>
    </form>
  );
}
