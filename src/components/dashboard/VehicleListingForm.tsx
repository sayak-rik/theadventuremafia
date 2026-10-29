"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";
import { advanceFor } from "@/lib/booking/pricing";
import { formatINR } from "@/lib/pricing";
import type { VehicleListingInput } from "@/lib/validation/listing";
import type { RegionOption, RouteCatalogOption } from "@/lib/taxonomy";

type S = {
  title: string; description: string; regionSlug: string; unitPrice: string; advanceType: "percent" | "flat"; advanceValue: string;
  minNoticeHours: string; meetingPoint: string; cancellationPolicy: string; safetyNotes: string; inclusions: string; exclusions: string;
  vehicleType: "hatchback" | "sedan" | "suv" | "innova" | "traveller"; seats: string; ac: boolean; luggageNote: string; unitsTotal: string;
  oneWay: boolean; pickupTime: string; routeMode: "standard" | "custom"; routeCatalogId: string; originRegionSlug: string; destinationRegionSlug: string;
  registrationNumber: string; rcExpiry: string;
};

const n = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function initialState(regionDefault: string, from?: VehicleListingInput): S {
  const base: S = {
    title: "", description: "", regionSlug: regionDefault, unitPrice: "", advanceType: "percent", advanceValue: "30", minNoticeHours: "2",
    meetingPoint: "", safetyNotes: "", inclusions: "", exclusions: "",
    cancellationPolicy: "Free cancellation up to 6 hours before pickup. After that the advance is not refunded.",
    vehicleType: "sedan", seats: "4", ac: true, luggageNote: "", unitsTotal: "1", oneWay: true, pickupTime: "07:00",
    routeMode: "standard", routeCatalogId: "", originRegionSlug: "", destinationRegionSlug: "", registrationNumber: "", rcExpiry: "",
  };
  if (!from) return base;
  return {
    ...base,
    title: from.title, description: from.description, regionSlug: from.regionSlug, unitPrice: s(from.unitPrice), advanceType: from.advanceType,
    advanceValue: s(from.advanceValue), minNoticeHours: s(from.minNoticeHours), meetingPoint: from.meetingPoint ?? "",
    cancellationPolicy: from.cancellationPolicy, safetyNotes: from.safetyNotes ?? "", inclusions: from.inclusions.join("\n"), exclusions: from.exclusions.join("\n"),
    vehicleType: from.vehicleType, seats: s(from.seats), ac: from.ac, luggageNote: from.luggageNote ?? "", unitsTotal: s(from.unitsTotal),
    oneWay: from.oneWay, pickupTime: from.pickupTime ?? "", routeMode: from.routeCatalogId !== null ? "standard" : "custom",
    routeCatalogId: s(from.routeCatalogId), originRegionSlug: from.originRegionSlug ?? "", destinationRegionSlug: from.destinationRegionSlug ?? "",
    registrationNumber: from.registrationNumber ?? "", rcExpiry: from.rcExpiry ?? "",
  };
}

function toPayload(f: S): VehicleListingInput {
  return {
    kind: "route_trip", categorySlug: "car-hire", title: f.title.trim(), description: f.description.trim(), regionSlug: f.regionSlug,
    unitPrice: n(f.unitPrice) ?? 0, advanceType: f.advanceType, advanceValue: n(f.advanceValue) ?? 0, minNoticeHours: n(f.minNoticeHours) ?? 0,
    meetingPoint: f.meetingPoint.trim(), cancellationPolicy: f.cancellationPolicy.trim(), safetyNotes: f.safetyNotes.trim(),
    inclusions: lines(f.inclusions), exclusions: lines(f.exclusions),
    vehicleType: f.vehicleType, seats: n(f.seats) ?? 4, ac: f.ac, luggageNote: f.luggageNote.trim(), unitsTotal: n(f.unitsTotal) ?? 1,
    oneWay: f.oneWay, pickupTime: f.pickupTime || null,
    routeCatalogId: f.routeMode === "standard" ? (n(f.routeCatalogId) ?? null) : null,
    originRegionSlug: f.routeMode === "custom" ? (f.originRegionSlug || null) : null,
    destinationRegionSlug: f.routeMode === "custom" ? (f.destinationRegionSlug || null) : null,
    registrationNumber: f.registrationNumber.trim(), rcExpiry: f.rcExpiry || null,
  };
}

export function VehicleListingForm({
  mode, listingId, initial, regions, routes,
}: { mode: "create" | "edit"; listingId?: number; initial?: VehicleListingInput; regions: RegionOption[]; routes: RouteCatalogOption[] }) {
  const router = useRouter();
  const [f, setF] = useState<S>(() => initialState(regions[0]?.slug ?? "gangtok", initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = <K extends keyof S>(k: K, v: S[K]) => { setSaved(false); setF((p) => ({ ...p, [k]: v })); };
  const bind = (k: keyof S) => ({
    id: k as string, value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never),
    "aria-invalid": !!fields[k as string],
  });
  const err = (k: string) => fields[k];

  const advancePreview = useMemo(() => {
    const price = n(f.unitPrice), val = n(f.advanceValue);
    if (!price || !val) return null;
    return { total: price, advance: advanceFor(price, f.advanceType, val) };
  }, [f.unitPrice, f.advanceType, f.advanceValue]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setFields({}); setSaved(false);
    const body = toPayload(f);
    try {
      if (mode === "create") {
        const res = await api<{ id: number }>("/api/operator/listings", { body });
        router.push(`/dashboard/listings/${res.id}?created=1`);
        router.refresh();
      } else {
        await api(`/api/operator/listings/${listingId}`, { method: "PUT", body });
        setSaved(true);
        router.refresh();
      }
    } catch (ex) {
      if (ex instanceof ApiError) { setError(ex.message); setFields(ex.fields ?? {}); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else setError("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError>{error}</FormError>

      <div className="grid gap-4 rounded-2xl border border-navy/15 bg-white p-5 sm:grid-cols-2">
        <h2 className="font-serif text-lg font-bold text-navy sm:col-span-2">The vehicle</h2>
        <Field label="Listing title" htmlFor="title" error={err("title")} className="sm:col-span-2">
          <Input {...bind("title")} placeholder="e.g. Gangtok to Pelling cab" required />
        </Field>
        <Field label="Vehicle type" htmlFor="vehicleType">
          <Select {...bind("vehicleType")}>
            <option value="hatchback">Hatchback</option><option value="sedan">Sedan</option><option value="suv">SUV</option>
            <option value="innova">Innova / MUV</option><option value="traveller">Traveller / minibus</option>
          </Select>
        </Field>
        <Field label="Seats" htmlFor="seats" error={err("seats")}><Input {...bind("seats")} inputMode="numeric" required /></Field>
        <Field label="How many vehicles?" htmlFor="unitsTotal" hint="Bookings stop when they're all taken for a day." error={err("unitsTotal")}>
          <Input {...bind("unitsTotal")} inputMode="numeric" required />
        </Field>
        <Field label="Registration number (optional)" htmlFor="registrationNumber"><Input {...bind("registrationNumber")} placeholder="SK-01-AB-1234" /></Field>
        <Checkbox label="Air conditioned" checked={f.ac} onChange={(e) => set("ac", e.target.checked)} />
        <Checkbox label="One-way trip" hint="Off for a round trip" checked={f.oneWay} onChange={(e) => set("oneWay", e.target.checked)} />
        <Field label="Luggage (optional)" htmlFor="luggageNote" className="sm:col-span-2"><Input {...bind("luggageNote")} placeholder="e.g. 2 medium bags" /></Field>
        <Field label="Describe it" htmlFor="description" hint="What the trip is like, what customers should know." error={err("description")} className="sm:col-span-2">
          <Textarea {...bind("description")} rows={3} required />
        </Field>
      </div>

      <div className="space-y-4 rounded-2xl border border-navy/15 bg-white p-5">
        <h2 className="font-serif text-lg font-bold text-navy">Route</h2>
        <div role="group" aria-label="Route type" className="flex gap-2">
          <button type="button" onClick={() => set("routeMode", "standard")}
            className={`h-10 rounded-lg px-4 text-sm font-semibold ${f.routeMode === "standard" ? "bg-navy text-cream" : "border border-navy/20 text-navy/70"}`}>
            Standardized route
          </button>
          <button type="button" onClick={() => set("routeMode", "custom")}
            className={`h-10 rounded-lg px-4 text-sm font-semibold ${f.routeMode === "custom" ? "bg-navy text-cream" : "border border-navy/20 text-navy/70"}`}>
            Custom route
          </button>
        </div>
        {f.routeMode === "standard" ? (
          <Field label="Route" htmlFor="routeCatalogId" error={err("originRegionSlug")}>
            <Select {...bind("routeCatalogId")}>
              <option value="">Choose a route…</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.originName} → {r.destinationName}{r.distanceKm ? ` (${r.distanceKm} km)` : ""}</option>)}
            </Select>
            {routes.length === 0 && <p className="mt-1.5 text-[13px] text-navy/60">No standardized routes yet — use a custom route instead.</p>}
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" htmlFor="originRegionSlug" error={err("originRegionSlug")}>
              <Select {...bind("originRegionSlug")}><option value="">Choose…</option>{regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</Select>
            </Field>
            <Field label="To" htmlFor="destinationRegionSlug" error={err("destinationRegionSlug")}>
              <Select {...bind("destinationRegionSlug")}><option value="">Choose…</option>{regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</Select>
            </Field>
          </div>
        )}
        <Field label="Where are you based?" htmlFor="regionSlug" error={err("regionSlug")} hint="Which region this listing is filed under.">
          <Select {...bind("regionSlug")}>{regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</Select>
        </Field>
        <Field label="Pickup time" htmlFor="pickupTime" error={err("pickupTime")}><Input id="pickupTime" type="time" value={f.pickupTime} onChange={(e) => set("pickupTime", e.target.value)} /></Field>
        <Field label="Pickup place" htmlFor="meetingPoint" error={err("meetingPoint")}><Input {...bind("meetingPoint")} placeholder="e.g. Gangtok taxi stand" /></Field>
      </div>

      <div className="grid gap-4 rounded-2xl border border-navy/15 bg-white p-5 sm:grid-cols-2">
        <h2 className="font-serif text-lg font-bold text-navy sm:col-span-2">Price and advance</h2>
        <Field label="Price per vehicle (₹)" htmlFor="unitPrice" error={err("unitPrice")}><Input {...bind("unitPrice")} inputMode="numeric" required /></Field>
        <Field label="Ask for the advance as" htmlFor="advanceType">
          <Select {...bind("advanceType")}><option value="percent">A percentage of the total</option><option value="flat">A fixed amount</option></Select>
        </Field>
        <Field label={f.advanceType === "percent" ? "Advance (%)" : "Advance (₹)"} htmlFor="advanceValue" error={err("advanceValue")}>
          <Input {...bind("advanceValue")} inputMode="numeric" required />
        </Field>
        <Field label="Notice needed for same-day bookings" htmlFor="minNoticeHours" error={err("minNoticeHours")}>
          <Select {...bind("minNoticeHours")}>{[0, 1, 2, 4, 6, 12, 24].map((h) => <option key={h} value={h}>{h === 0 ? "None" : `${h} ${h === 1 ? "hour" : "hours"}`}</option>)}</Select>
        </Field>
        {advancePreview && (
          <p className="rounded-lg bg-green/10 px-4 py-3 text-[15px] text-navy sm:col-span-2" role="status">
            On one vehicle ({formatINR(advancePreview.total)}), the customer pays <strong className="tabular-nums">{formatINR(advancePreview.advance)}</strong> now and <strong className="tabular-nums">{formatINR(advancePreview.total - advancePreview.advance)}</strong> in person.
          </p>
        )}
      </div>

      <div className="grid gap-4 rounded-2xl border border-navy/15 bg-white p-5 sm:grid-cols-2">
        <h2 className="font-serif text-lg font-bold text-navy sm:col-span-2">Policies and details</h2>
        <Field label="What's included" htmlFor="inclusions" hint="One per line." error={err("inclusions")}><Textarea {...bind("inclusions")} rows={3} placeholder={"Driver\nFuel"} /></Field>
        <Field label="What's not included" htmlFor="exclusions" hint="One per line." error={err("exclusions")}><Textarea {...bind("exclusions")} rows={3} placeholder={"Toll\nParking"} /></Field>
        <Field label="Cancellation and refunds" htmlFor="cancellationPolicy" error={err("cancellationPolicy")} className="sm:col-span-2"><Textarea {...bind("cancellationPolicy")} rows={3} required /></Field>
        <Field label="Safety notes (optional)" htmlFor="safetyNotes" error={err("safetyNotes")} className="sm:col-span-2"><Textarea {...bind("safetyNotes")} rows={2} /></Field>
        <Field label="Vehicle RC expiry (optional)" htmlFor="rcExpiry"><Input id="rcExpiry" type="date" value={f.rcExpiry} onChange={(e) => set("rcExpiry", e.target.value)} /></Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Saving…" : mode === "create" ? "Save as draft" : "Save changes"}</Button>
        {saved && <p role="status" className="text-sm font-medium text-green-600">Saved.</p>}
      </div>
    </form>
  );
}
