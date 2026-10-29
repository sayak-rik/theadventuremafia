"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/field";
import { AvailabilityDatePicker, type DaySlots } from "./AvailabilityDatePicker";
import { api, ApiError } from "@/lib/client-api";
import { advanceFor } from "@/lib/booking/pricing";
import { clock12, shortDate } from "@/lib/format";
import { formatINR } from "@/lib/pricing";
import { cn } from "@/lib/cn";

export type BookingCardProps = {
  listingId: number;
  title: string;
  bookingModel: "rental_day" | "session";
  unitPrice: number;
  advanceType: "percent" | "flat";
  advanceValue: number;
  securityDeposit: number;
  groupMin: number | null;
  groupMax: number | null;
  minAge: number | null;
  maxAge: number | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
  waiverRequired: boolean;
  /** Today in IST, computed on the server so client and server agree. */
  today: string;
};

type Participant = { name: string; age: string; weight: string };
const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

export function BookingCard(p: BookingCardProps) {
  const router = useRouter();
  const isSession = p.bookingModel === "session";
  const noun = isSession ? "seat" : "vehicle";
  const [ty, tm] = p.today.split("-").map(Number);

  const [cursor, setCursor] = useState({ y: ty, m: tm - 1 });
  const [days, setDays] = useState<Record<string, DaySlots>>({});
  const loaded = useRef(new Set<string>());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [people, setPeople] = useState<Participant[]>([{ name: "", age: "", weight: "" }]);

  const [step, setStep] = useState<"pick" | "details">("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", phone: "", email: "", terms: false, licence: false, waiver: false, website: "" });

  const loadMonth = useCallback(async (y: number, m: number) => {
    const key = ym(y, m);
    if (loaded.current.has(key)) return;
    loaded.current.add(key);
    setLoading(true);
    setLoadError("");
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    try {
      const res = await api<{ days: { date: string; slots: DaySlots }[] }>(`/api/public/listings/${p.listingId}/availability?from=${key}-01&to=${key}-${String(last).padStart(2, "0")}`);
      setDays((prev) => ({ ...prev, ...Object.fromEntries(res.days.map((d) => [d.date, d.slots])) }));
    } catch (err) {
      loaded.current.delete(key);
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load availability. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [p.listingId]);

  useEffect(() => { loadMonth(cursor.y, cursor.m); }, [cursor, loadMonth]);

  const daySlots = date ? days[date] ?? [] : [];
  const activeSlots = isSession ? daySlots.filter((s) => s.available > 0) : daySlots;
  const chosen = isSession ? daySlots.find((s) => s.slotTime === slot) : daySlots[0];
  const maxQty = Math.max(1, Math.min(chosen?.available ?? 1, p.groupMax ?? (isSession ? 20 : 10)));
  const minQty = isSession ? p.groupMin ?? 1 : 1;

  // Keep quantity and participant rows in sync with what's available.
  useEffect(() => { setQty((q) => Math.min(Math.max(q, minQty), maxQty)); }, [maxQty, minQty]);
  useEffect(() => {
    if (!isSession) return;
    setPeople((prev) => Array.from({ length: qty }, (_, i) => prev[i] ?? { name: "", age: "", weight: "" }));
  }, [qty, isSession]);

  const total = p.unitPrice * qty;
  const advance = useMemo(() => advanceFor(total, p.advanceType, p.advanceValue), [total, p.advanceType, p.advanceValue]);
  const deposit = isSession ? 0 : p.securityDeposit * qty;
  const canContinue = Boolean(date && (!isSession || slot) && chosen && chosen.available >= qty);

  function pickDate(d: string) {
    setDate(d);
    setSlot(null);
    setError("");
    const s = (days[d] ?? []).filter((x) => x.available > 0);
    if (isSession && s.length === 1) setSlot(s[0].slotTime);
  }
  function shift(delta: -1 | 1) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }
  const canPrev = cursor.y * 12 + cursor.m > ty * 12 + (tm - 1);
  const canNext = cursor.y * 12 + cursor.m < ty * 12 + (tm - 1) + 3;

  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setBusy(true); setError(""); setFields({});
    const body = {
      date, slotTime: isSession ? slot : null, quantity: qty, name: form.name, phone: form.phone, email: form.email,
      participants: isSession ? people.map((x) => ({ name: x.name, age: Number(x.age), weightKg: Number(x.weight) })) : undefined,
      acceptTerms: form.terms, waiverAccepted: isSession ? form.waiver : undefined, hasLicence: isSession ? undefined : form.licence, website: form.website,
    };
    try {
      const res = await api<{ token: string }>(`/api/public/listings/${p.listingId}/book`, { body });
      router.push(`/book/${res.token}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
        if (err.status === 409) { loaded.current.clear(); setDays({}); loadMonth(cursor.y, cursor.m); }
      } else setError("Couldn't reserve that. Please try again.");
      setBusy(false);
    }
  }

  const setP = (i: number, patch: Partial<Participant>) => setPeople((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <section id="book" aria-labelledby="book-h" className="scroll-mt-24 rounded-2xl border border-navy/15 bg-white p-5 shadow-luxe">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="book-h" className="font-serif text-xl font-bold text-navy">{step === "pick" ? (isSession ? "Pick a day and time" : "Pick your day") : "Your details"}</h2>
        <p className="text-sm tabular-nums text-navy/70"><strong className="text-lg text-navy">{formatINR(p.unitPrice)}</strong> {isSession ? "a person" : "a day"}</p>
      </div>

      {step === "pick" ? (
        <div className="mt-4 space-y-5">
          <AvailabilityDatePicker year={cursor.y} month={cursor.m} today={p.today} days={days} loading={loading} selected={date} noun={noun}
            onSelect={pickDate} onMonth={shift} canPrev={canPrev} canNext={canNext} />
          {loadError && <FormError>{loadError}</FormError>}

          {isSession && date && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-navy">Time on {shortDate(date)}</legend>
              {activeSlots.length === 0 ? <p className="text-sm text-navy/70">No seats left that day.</p> : (
                <div className="flex flex-wrap gap-2">
                  {activeSlots.map((s) => (
                    <button key={s.slotTime} type="button" aria-pressed={slot === s.slotTime} onClick={() => setSlot(s.slotTime)}
                      className={cn("min-h-12 rounded-lg border px-4 text-left transition", slot === s.slotTime ? "border-navy bg-navy text-cream" : "border-navy/20 bg-white text-navy hover:border-navy/50")}>
                      <span className="block font-semibold tabular-nums">{clock12(s.slotTime!)}</span>
                      <span className={cn("block text-xs", slot === s.slotTime ? "text-cream/70" : "text-navy/60")}>{s.available} {s.available === 1 ? "seat" : "seats"} left</span>
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {date && (!isSession || slot) && chosen && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-navy">{isSession ? "How many people?" : "How many vehicles?"}</p>
                <p className="text-xs text-navy/60">Up to {maxQty} available</p>
              </div>
              <div className="flex items-center gap-1" role="group" aria-label="Quantity">
                <button type="button" aria-label="One fewer" disabled={qty <= minQty} onClick={() => setQty((q) => q - 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-navy/20 disabled:opacity-30"><Minus className="h-4 w-4" aria-hidden /></button>
                <output aria-live="polite" className="w-10 text-center text-lg font-bold tabular-nums">{qty}</output>
                <button type="button" aria-label="One more" disabled={qty >= maxQty} onClick={() => setQty((q) => q + 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-navy/20 disabled:opacity-30"><Plus className="h-4 w-4" aria-hidden /></button>
              </div>
            </div>
          )}

          {canContinue && (
            <dl className="space-y-1.5 border-t border-navy/10 pt-4 text-[15px]">
              <div className="flex justify-between"><dt className="text-navy/70">Total</dt><dd className="font-semibold tabular-nums">{formatINR(total)}</dd></div>
              <div className="flex justify-between"><dt className="font-semibold text-navy">Pay now to hold it</dt><dd className="text-lg font-bold tabular-nums text-green-600">{formatINR(advance)}</dd></div>
              <div className="flex justify-between"><dt className="text-navy/70">Pay {isSession ? "at the start" : "at the shop"}</dt><dd className="tabular-nums text-navy/80">{formatINR(total - advance)}</dd></div>
              {deposit > 0 && <div className="flex justify-between"><dt className="text-navy/70">Refundable deposit (in person)</dt><dd className="tabular-nums text-navy/80">{formatINR(deposit)}</dd></div>}
            </dl>
          )}

          <Button size="lg" className="w-full" disabled={!canContinue} onClick={() => { setStep("details"); setError(""); }}>
            {canContinue ? "Continue" : date ? (isSession && !slot ? "Choose a time" : "Not enough available") : "Choose a date"}
          </Button>
        </div>
      ) : (
        <form onSubmit={reserve} className="mt-4 space-y-5" noValidate>
          <p className="rounded-lg bg-navy/[0.04] px-3 py-2.5 text-sm text-navy">
            {qty} × {p.title}, <strong>{date && shortDate(date)}</strong>{slot ? ` at ${clock12(slot)}` : ""}.{" "}
            <button type="button" onClick={() => setStep("pick")} className="font-semibold underline underline-offset-2">Change</button>
          </p>

          <Field label="Your name" htmlFor="b-name" error={fields.name}><Input id="b-name" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Mobile number" htmlFor="b-phone" hint="The operator may call or WhatsApp you." error={fields.phone}>
              <Input id="b-phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="b-email" hint="We'll send your booking link here." error={fields.email}>
              <Input id="b-email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>

          {isSession && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-navy">Who's joining?</legend>
              <p className="-mt-1 text-[13px] text-navy/65">
                {[p.minAge ? `Age ${p.minAge}${p.maxAge ? `–${p.maxAge}` : "+"}` : null, p.minWeightKg || p.maxWeightKg ? `weight ${p.minWeightKg ?? 0}–${p.maxWeightKg ?? "any"} kg` : null].filter(Boolean).join(", ") || "Add each person's details."}
              </p>
              {people.map((x, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2">
                  <Input aria-label={`Person ${i + 1} name`} placeholder={`Person ${i + 1}`} value={x.name} onChange={(e) => setP(i, { name: e.target.value })} />
                  <Input aria-label={`Person ${i + 1} age`} inputMode="numeric" placeholder="Age" value={x.age} onChange={(e) => setP(i, { age: e.target.value.replace(/\D/g, "") })} />
                  <Input aria-label={`Person ${i + 1} weight in kg`} inputMode="numeric" placeholder="Kg" value={x.weight} onChange={(e) => setP(i, { weight: e.target.value.replace(/\D/g, "") })} />
                </div>
              ))}
            </fieldset>
          )}

          <div className="space-y-2.5">
            {isSession ? (
              p.waiverRequired && <Checkbox checked={form.waiver} onChange={(e) => setForm({ ...form, waiver: e.target.checked })}
                label="Everyone joining accepts the safety waiver" hint="We're fit to take part, will follow the guide's instructions, and understand adventure sports carry risk." />
            ) : (
              <Checkbox checked={form.licence} onChange={(e) => setForm({ ...form, licence: e.target.checked })} label="I'll bring my original driving licence and photo ID" hint="The shop checks them before handing over the vehicle." />
            )}
            <Checkbox checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })}
              label={<>I agree to the <Link href="/terms" target="_blank" className="underline underline-offset-2">booking terms</Link></>}
              hint="You pay the advance directly to the operator. The Adventure Mafia never holds your money." />
          </div>

          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label></div>

          <FormError>{error}</FormError>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Reserving…" : `Reserve — pay ${formatINR(advance)} next`}</Button>
          <p className="text-center text-[13px] text-navy/60">We hold it for 30 minutes while you pay the advance by UPI.</p>
        </form>
      )}
    </section>
  );
}
