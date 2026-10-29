"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/client-api";
import { clock12 } from "@/lib/format";
import { cn } from "@/lib/cn";

type L = { id: number; title: string; bookingModel: "rental_day" | "session" };

/** Walk-in / phone / WhatsApp booking — takes real inventory so the shop and the site never collide. */
export function AddBookingButton({ listings }: { listings: L[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [listingId, setListingId] = useState(listings[0]?.id ?? 0);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ slotTime: string | null; available: number }[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [qty, setQty] = useState("1");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listing = listings.find((l) => l.id === listingId);
  const isSession = listing?.bookingModel === "session";

  useEffect(() => {
    if (!open || !date || !listingId) return;
    let live = true;
    api<{ days: { slots: { slotTime: string | null; available: number }[] }[] }>(`/api/public/listings/${listingId}/availability?from=${date}&to=${date}`)
      .then((r) => { if (live) { setSlots(r.days[0]?.slots ?? []); setSlot(null); } })
      .catch(() => live && setSlots([]));
    return () => { live = false; };
  }, [open, date, listingId]);

  const free = slots.find((s) => (isSession ? s.slotTime === slot : true))?.available ?? 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/api/operator/bookings", { body: { listingId, date, slotTime: isSession ? slot : null, quantity: Number(qty), name, phone, note: note || undefined } });
      setOpen(false); setName(""); setPhone(""); setNote(""); setDate("");
      router.push("/dashboard/bookings?tab=upcoming"); router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Add booking</Button>
      <Sheet open={open} onOpenChange={setOpen} title="Add a booking" description="For walk-ins and phone or WhatsApp customers. It blocks the vehicle or seats so nobody double-books.">
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="What" htmlFor="ab-l"><Select id="ab-l" value={listingId} onChange={(e) => { setListingId(Number(e.target.value)); setSlots([]); setSlot(null); }}>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</Select></Field>
          <Field label="Date" htmlFor="ab-d"><Input id="ab-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          {date && isSession && (
            <div className="flex flex-wrap gap-2">
              {slots.length === 0 ? <p className="text-sm text-navy/70">Nothing is offered that day.</p> : slots.map((s) => (
                <button key={s.slotTime} type="button" disabled={s.available < 1} aria-pressed={slot === s.slotTime} onClick={() => setSlot(s.slotTime)}
                  className={cn("min-h-12 rounded-lg border px-4 text-left disabled:opacity-40", slot === s.slotTime ? "border-navy bg-navy text-cream" : "border-navy/20")}>
                  <span className="block font-semibold tabular-nums">{clock12(s.slotTime!)}</span><span className="block text-xs opacity-70">{s.available} seats left</span>
                </button>
              ))}
            </div>
          )}
          {date && !isSession && <p className="text-sm text-navy/70">{slots[0] ? `${slots[0].available} free that day.` : "Not available that day."}</p>}
          <Field label={isSession ? "How many people" : "How many vehicles"} htmlFor="ab-q"><Input id="ab-q" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="Customer's name" htmlFor="ab-n"><Input id="ab-n" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Customer's mobile" htmlFor="ab-p"><Input id="ab-p" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
          <Field label="Note (optional)" htmlFor="ab-note"><Textarea id="ab-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" className="w-full" disabled={busy || !date || (isSession && !slot) || Number(qty) < 1 || (date !== "" && Number(qty) > free)}>{busy ? "Saving…" : "Add booking"}</Button>
        </form>
      </Sheet>
    </>
  );
}
