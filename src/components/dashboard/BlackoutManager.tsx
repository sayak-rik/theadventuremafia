"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/client-api";
import { clock12, shortDate } from "@/lib/format";
import type { BlackoutRow } from "@/lib/booking/blackouts";

/** Close dates, a single slot, or some units — service, weather, off-season. */
export function BlackoutManager({ listingId, isSession, slotTimes, blackouts, canEdit, today }: {
  listingId: number; isSession: boolean; slotTimes: string[]; blackouts: BlackoutRow[]; canEdit: boolean; today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [slot, setSlot] = useState("");
  const [mode, setMode] = useState<"all" | "some">("all");
  const [units, setUnits] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await api<{ flagged: number; releasedHolds: number }>(`/api/operator/listings/${listingId}/blackouts`, {
        body: { dateFrom: from, dateTo: to || from, slotTime: isSession && slot ? slot : null, unitsBlocked: mode === "some" ? Number(units) : null, reason: reason || undefined },
      });
      setResult(res.flagged || res.releasedHolds
        ? `Closed. ${res.flagged} paid ${res.flagged === 1 ? "booking was" : "bookings were"} flagged for you to move or refund, and ${res.releasedHolds} unpaid ${res.releasedHolds === 1 ? "hold was" : "holds were"} released. Customers are being emailed.`
        : "Closed.");
      setOpen(false); setFrom(""); setTo(""); setReason(""); setSlot(""); setMode("all");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Re-open these dates? Bookings already flagged stay flagged until you move or cancel them.")) return;
    try { await api(`/api/operator/listings/${listingId}/blackouts/${id}`, { method: "DELETE" }); router.refresh(); }
    catch (err) { setResult(err instanceof ApiError ? err.message : "Couldn't remove that."); }
  }

  return (
    <div>
      {blackouts.length === 0 ? <p className="text-sm text-navy/70">Nothing closed. Use this for servicing, bad weather or off-season.</p> : (
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
          {blackouts.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0 text-[15px]">
                <p className="font-semibold text-navy">{b.dateFrom === b.dateTo ? shortDate(b.dateFrom) : `${shortDate(b.dateFrom)} to ${shortDate(b.dateTo)}`}</p>
                <p className="text-sm text-navy/70">{b.slotTime ? `${clock12(b.slotTime)} only` : "All day"} · {b.unitsBlocked ? `${b.unitsBlocked} ${isSession ? "seats" : "vehicles"} off` : "Closed"}{b.reason ? ` · ${b.reason}` : ""}</p>
              </div>
              {canEdit && <button type="button" onClick={() => remove(b.id)} aria-label="Re-open these dates" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" aria-hidden /></button>}
            </li>
          ))}
        </ul>
      )}
      {result && <p role="status" className="mt-3 rounded-lg bg-green/10 px-4 py-3 text-sm text-navy">{result}</p>}
      {canEdit && <Button className="mt-4" variant="outline" onClick={() => { setError(""); setResult(""); setOpen(true); }}><Plus className="h-4 w-4" aria-hidden /> Close dates</Button>}

      <Sheet open={open} onOpenChange={setOpen} title="Close dates" description="Customers can't book closed dates. Paid bookings in the way are flagged so you can move or refund them.">
        <form onSubmit={add} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="bo-from"><Input id="bo-from" type="date" min={today} value={from} onChange={(e) => { setFrom(e.target.value); if (!to) setTo(e.target.value); }} required /></Field>
            <Field label="To" htmlFor="bo-to"><Input id="bo-to" type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} required /></Field>
          </div>
          {isSession && (
            <Field label="Which slot" htmlFor="bo-slot"><Select id="bo-slot" value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">All slots</option>{slotTimes.map((t) => <option key={t} value={t}>{clock12(t)} only</option>)}</Select></Field>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-navy">How much</legend>
            <label className="flex items-center gap-2 text-[15px]"><input type="radio" className="h-5 w-5 accent-green" checked={mode === "all"} onChange={() => setMode("all")} /> Closed completely</label>
            <label className="flex items-center gap-2 text-[15px]"><input type="radio" className="h-5 w-5 accent-green" checked={mode === "some"} onChange={() => setMode("some")} /> Only some {isSession ? "seats" : "vehicles"} off</label>
            {mode === "some" && <Input aria-label="How many" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} className="max-w-[8rem]" />}
          </fieldset>
          <Field label="Reason (optional)" htmlFor="bo-reason" hint="Shown to customers whose booking is affected."><Input id="bo-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Heavy rain, landslide, servicing" /></Field>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" className="w-full" disabled={busy || !from}>{busy ? "Saving…" : "Close these dates"}</Button>
        </form>
      </Sheet>
    </div>
  );
}
