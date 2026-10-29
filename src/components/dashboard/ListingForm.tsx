"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldSet, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client-api";
import { advanceFor } from "@/lib/booking/pricing";
import { formatINR } from "@/lib/pricing";
import { cn } from "@/lib/cn";
import type { ListingInput } from "@/lib/validation/listing";
import type { RegionOption } from "@/lib/taxonomy";

type Slot = { time: string; capacity: string; daysOfWeek: number[]; validFrom: string; validTo: string };
type S = {
  title: string; description: string; regionSlug: string; unitPrice: string; advanceType: "percent" | "flat"; advanceValue: string;
  minNoticeHours: string; meetingPoint: string; cancellationPolicy: string; safetyNotes: string; inclusions: string; exclusions: string;
  // rentals
  makeModel: string; engineCc: string; transmission: "gear" | "automatic"; fuelType: "petrol" | "electric"; unitsTotal: string;
  securityDeposit: string; helmetsIncluded: string; kmLimitPerDay: string; fuelPolicy: string; docsRequired: string[];
  pickupTime: string; returnByTime: string; lateFeePerHour: string; areaRestrictions: string;
  // sessions
  durationHours: string; difficulty: string; groupMin: string; groupMax: string; minAge: string; maxAge: string;
  minWeightKg: string; maxWeightKg: string; rapidsGrade: string; stretchName: string; distanceKm: string; flightMinutes: string;
  takeoffAltitudeM: string; swimRequired: boolean; certification: string; equipmentNotes: string; waiverRequired: boolean;
  weatherDependent: boolean; season: string; slots: Slot[];
};

const DOCS = ["Original driving licence", "Government photo ID (Aadhaar, passport or voter ID)", "Passport and visa for foreign guests"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const n = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function initialState(kind: "rental_day" | "session", category: string, regionDefault: string, from?: ListingInput): S {
  const base: S = {
    title: "", description: "", regionSlug: regionDefault, unitPrice: "", advanceType: "percent", advanceValue: "30", minNoticeHours: "2",
    meetingPoint: "", safetyNotes: "", inclusions: "", exclusions: "",
    cancellationPolicy: kind === "rental_day"
      ? "Free cancellation up to 24 hours before pickup. After that the advance is not refunded."
      : "Full refund or a free reschedule if we cancel for weather or safety. Otherwise the advance is not refunded within 24 hours of the slot.",
    makeModel: "", engineCc: "", transmission: category === "scooty-rental" ? "automatic" : "gear", fuelType: "petrol", unitsTotal: "1",
    securityDeposit: "0", helmetsIncluded: "2", kmLimitPerDay: "", fuelPolicy: "", docsRequired: [DOCS[0], DOCS[1]],
    pickupTime: "08:00", returnByTime: "19:00", lateFeePerHour: "", areaRestrictions: "",
    durationHours: "2", difficulty: "", groupMin: "", groupMax: "", minAge: "", maxAge: "", minWeightKg: "", maxWeightKg: "",
    rapidsGrade: "", stretchName: "", distanceKm: "", flightMinutes: "", takeoffAltitudeM: "", swimRequired: false, certification: "",
    equipmentNotes: "", waiverRequired: true, weatherDependent: true, season: "",
    slots: [{ time: "09:00", capacity: "10", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: "", validTo: "" }],
  };
  if (!from) return base;
  const common = {
    title: from.title, description: from.description, regionSlug: from.regionSlug, unitPrice: s(from.unitPrice), advanceType: from.advanceType,
    advanceValue: s(from.advanceValue), minNoticeHours: s(from.minNoticeHours), meetingPoint: from.meetingPoint ?? "",
    cancellationPolicy: from.cancellationPolicy, safetyNotes: from.safetyNotes ?? "", inclusions: from.inclusions.join("\n"), exclusions: from.exclusions.join("\n"),
  };
  if (from.kind === "rental_day") {
    return { ...base, ...common, makeModel: from.makeModel, engineCc: s(from.engineCc), transmission: from.transmission, fuelType: from.fuelType,
      unitsTotal: s(from.unitsTotal), securityDeposit: s(from.securityDeposit), helmetsIncluded: s(from.helmetsIncluded), kmLimitPerDay: s(from.kmLimitPerDay),
      fuelPolicy: from.fuelPolicy ?? "", docsRequired: from.docsRequired, pickupTime: from.pickupTime, returnByTime: from.returnByTime,
      lateFeePerHour: s(from.lateFeePerHour), areaRestrictions: from.areaRestrictions ?? "" };
  }
  if (from.kind === "session") {
    return { ...base, ...common, durationHours: s(from.durationHours), difficulty: from.difficulty ?? "", groupMin: s(from.groupMin), groupMax: s(from.groupMax),
      minAge: s(from.minAge), maxAge: s(from.maxAge), minWeightKg: s(from.minWeightKg), maxWeightKg: s(from.maxWeightKg), rapidsGrade: s(from.rapidsGrade),
      stretchName: from.stretchName ?? "", distanceKm: s(from.distanceKm), flightMinutes: s(from.flightMinutes), takeoffAltitudeM: s(from.takeoffAltitudeM),
      swimRequired: from.swimRequired, certification: from.certification, equipmentNotes: from.equipmentNotes ?? "", waiverRequired: from.waiverRequired,
      weatherDependent: from.weatherDependent, season: from.season ?? "",
      slots: from.slots.map((x) => ({ time: x.time, capacity: s(x.capacity), daysOfWeek: x.daysOfWeek, validFrom: x.validFrom ?? "", validTo: x.validTo ?? "" })) };
  }
  // Tours ("departure") and cars ("route_trip") have their own editor UI (not this component) — never reached today.
  return base;
}

function toPayload(f: S, kind: "rental_day" | "session", categorySlug: string) {
  const common = {
    categorySlug, title: kind === "rental_day" ? f.makeModel.trim() : f.title.trim(), description: f.description.trim(), regionSlug: f.regionSlug,
    unitPrice: n(f.unitPrice), advanceType: f.advanceType, advanceValue: n(f.advanceValue), minNoticeHours: n(f.minNoticeHours) ?? 0,
    meetingPoint: f.meetingPoint.trim(), cancellationPolicy: f.cancellationPolicy.trim(), safetyNotes: f.safetyNotes.trim(),
    inclusions: lines(f.inclusions), exclusions: lines(f.exclusions),
  };
  if (kind === "rental_day") {
    return { ...common, kind, makeModel: f.makeModel.trim(), engineCc: n(f.engineCc), transmission: f.transmission, fuelType: f.fuelType,
      unitsTotal: n(f.unitsTotal), securityDeposit: n(f.securityDeposit) ?? 0, helmetsIncluded: n(f.helmetsIncluded) ?? 0, kmLimitPerDay: n(f.kmLimitPerDay),
      fuelPolicy: f.fuelPolicy.trim(), docsRequired: f.docsRequired, pickupTime: f.pickupTime, returnByTime: f.returnByTime,
      lateFeePerHour: n(f.lateFeePerHour), areaRestrictions: f.areaRestrictions.trim() };
  }
  return { ...common, kind, durationHours: n(f.durationHours), difficulty: f.difficulty || null, groupMin: n(f.groupMin), groupMax: n(f.groupMax),
    minAge: n(f.minAge), maxAge: n(f.maxAge), minWeightKg: n(f.minWeightKg), maxWeightKg: n(f.maxWeightKg),
    rapidsGrade: categorySlug === "rafting" ? n(f.rapidsGrade) : null, stretchName: categorySlug === "rafting" ? f.stretchName.trim() : "",
    distanceKm: categorySlug === "rafting" ? n(f.distanceKm) : null, flightMinutes: categorySlug === "paragliding" ? n(f.flightMinutes) : null,
    takeoffAltitudeM: categorySlug === "paragliding" ? n(f.takeoffAltitudeM) : null, swimRequired: categorySlug === "rafting" ? f.swimRequired : false,
    certification: f.certification.trim(), equipmentNotes: f.equipmentNotes.trim(), waiverRequired: f.waiverRequired,
    weatherDependent: f.weatherDependent, season: f.season.trim(),
    slots: f.slots.map((x) => ({ time: x.time, capacity: n(x.capacity), daysOfWeek: x.daysOfWeek, validFrom: x.validFrom || null, validTo: x.validTo || null })) };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <FieldSet title={title} hint={hint}>{children}</FieldSet>;
}

export function ListingForm({
  mode, listingId, initial, categorySlug, kind, regions,
}: { mode: "create" | "edit"; listingId?: number; initial?: ListingInput; categorySlug: string; kind: "rental_day" | "session"; regions: RegionOption[] }) {
  const router = useRouter();
  const [f, setF] = useState<S>(() => initialState(kind, categorySlug, regions[0]?.slug ?? "pelling", initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = <K extends keyof S>(k: K, v: S[K]) => { setSaved(false); setF((p) => ({ ...p, [k]: v })); };
  const bind = (k: keyof S) => ({ id: k as string, value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never), "aria-invalid": !!fields[k as string] });
  const err = (k: string) => fields[k];
  const isRaft = categorySlug === "rafting";
  const isGlide = categorySlug === "paragliding";

  const advancePreview = useMemo(() => {
    const price = n(f.unitPrice), val = n(f.advanceValue);
    if (!price || !val) return null;
    const total = kind === "rental_day" ? price : price;
    return { total, advance: advanceFor(total, f.advanceType, val) };
  }, [f.unitPrice, f.advanceType, f.advanceValue, kind]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setFields({}); setSaved(false);
    const body = toPayload(f, kind, categorySlug);
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

  const updateSlot = (i: number, patch: Partial<Slot>) => { setSaved(false); setF((p) => ({ ...p, slots: p.slots.map((x, j) => (j === i ? { ...x, ...patch } : x)) })); };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError>{error}</FormError>

      <Section title={kind === "rental_day" ? "The vehicle" : "The trip"}>
        {kind === "rental_day" ? (
          <>
            <Field label="Make and model" htmlFor="makeModel" error={err("makeModel") ?? err("title")} className="sm:col-span-2">
              <Input {...bind("makeModel")} placeholder={categorySlug === "scooty-rental" ? "e.g. Honda Activa 6G" : "e.g. Royal Enfield Classic 350"} required />
            </Field>
            <Field label="Engine size (cc)" htmlFor="engineCc" error={err("engineCc")}><Input {...bind("engineCc")} inputMode="numeric" placeholder="110" /></Field>
            <Field label="Gears" htmlFor="transmission">
              <Select {...bind("transmission")}><option value="gear">Gear</option><option value="automatic">Automatic</option></Select>
            </Field>
            <Field label="Fuel" htmlFor="fuelType"><Select {...bind("fuelType")}><option value="petrol">Petrol</option><option value="electric">Electric</option></Select></Field>
            <Field label="How many do you have?" htmlFor="unitsTotal" hint="Bookings stop when they're all taken for a day." error={err("unitsTotal")}>
              <Input {...bind("unitsTotal")} inputMode="numeric" required />
            </Field>
          </>
        ) : (
          <>
            <Field label="Trip name" htmlFor="title" error={err("title")} className="sm:col-span-2">
              <Input {...bind("title")} placeholder={isRaft ? "e.g. Teesta river rafting, Grade III" : "e.g. Tandem paragliding over the Rangit valley"} required />
            </Field>
            <Field label="Length of the whole trip (hours)" htmlFor="durationHours" hint="Including briefing and transfers." error={err("durationHours")}><Input {...bind("durationHours")} inputMode="numeric" required /></Field>
            <Field label="Difficulty" htmlFor="difficulty">
              <Select {...bind("difficulty")}><option value="">Not specified</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="difficult">Difficult</option><option value="extreme">Extreme</option></Select>
            </Field>
            {isRaft && (<>
              <Field label="Rapids grade (1–6)" htmlFor="rapidsGrade" error={err("rapidsGrade")}><Input {...bind("rapidsGrade")} inputMode="numeric" placeholder="3" /></Field>
              <Field label="River and stretch" htmlFor="stretchName"><Input {...bind("stretchName")} placeholder="Teesta, Melli to Sirwani" /></Field>
              <Field label="Distance (km)" htmlFor="distanceKm" error={err("distanceKm")}><Input {...bind("distanceKm")} inputMode="decimal" /></Field>
            </>)}
            {isGlide && (<>
              <Field label="Flight time (minutes)" htmlFor="flightMinutes" error={err("flightMinutes")}><Input {...bind("flightMinutes")} inputMode="numeric" /></Field>
              <Field label="Take-off altitude (m)" htmlFor="takeoffAltitudeM" error={err("takeoffAltitudeM")}><Input {...bind("takeoffAltitudeM")} inputMode="numeric" /></Field>
            </>)}
          </>
        )}
        <Field label="Where is it?" htmlFor="regionSlug" error={err("regionSlug")}>
          <Select {...bind("regionSlug")}>{regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}</Select>
        </Field>
        <Field label={kind === "rental_day" ? "Pickup place" : "Meeting point"} htmlFor="meetingPoint" error={err("meetingPoint")}>
          <Input {...bind("meetingPoint")} placeholder="e.g. Opposite the helipad, Upper Pelling" />
        </Field>
        <Field label="Describe it" htmlFor="description" hint="What it's like, who it suits, anything customers should know." error={err("description")} className="sm:col-span-2">
          <Textarea {...bind("description")} rows={4} required />
        </Field>
      </Section>

      {kind === "session" && (
        <Section title="Safety and who can join" hint="Customers see this before they book. Be accurate — it protects them and you.">
          <Field label="Who guides or flies, and their certification" htmlFor="certification" error={err("certification")} className="sm:col-span-2">
            <Textarea {...bind("certification")} rows={2} placeholder={isGlide ? "e.g. Pilots hold PAI/APPI tandem licences, 500+ flights each" : "e.g. Guides hold IMF-certified rafting licences"} required />
          </Field>
          <Field label="Minimum age" htmlFor="minAge" error={err("minAge")}><Input {...bind("minAge")} inputMode="numeric" /></Field>
          <Field label="Maximum age" htmlFor="maxAge" error={err("maxAge")}><Input {...bind("maxAge")} inputMode="numeric" /></Field>
          <Field label="Minimum weight (kg)" htmlFor="minWeightKg" error={err("minWeightKg")}><Input {...bind("minWeightKg")} inputMode="numeric" /></Field>
          <Field label={isGlide ? "Maximum weight (kg), required" : "Maximum weight (kg)"} htmlFor="maxWeightKg" error={err("maxWeightKg")}><Input {...bind("maxWeightKg")} inputMode="numeric" required={isGlide} /></Field>
          <Field label="Smallest group" htmlFor="groupMin" error={err("groupMin")}><Input {...bind("groupMin")} inputMode="numeric" /></Field>
          <Field label="Largest group per booking" htmlFor="groupMax" error={err("groupMax")}><Input {...bind("groupMax")} inputMode="numeric" /></Field>
          {isRaft && <Checkbox className="sm:col-span-2" label="Guests must be able to swim" checked={f.swimRequired} onChange={(e) => set("swimRequired", e.target.checked)} />}
          <Checkbox className="sm:col-span-2" label="Guests sign a safety waiver before they join" checked={f.waiverRequired} onChange={(e) => set("waiverRequired", e.target.checked)} />
          <Checkbox className="sm:col-span-2" label="The weather can cancel a slot" hint="We'll show customers your weather policy." checked={f.weatherDependent} onChange={(e) => set("weatherDependent", e.target.checked)} />
          <Field label="Best season" htmlFor="season"><Input {...bind("season")} placeholder="e.g. October to May" /></Field>
          <Field label="Equipment notes" htmlFor="equipmentNotes"><Input {...bind("equipmentNotes")} placeholder="e.g. Life jackets and helmets provided" /></Field>
        </Section>
      )}

      {kind === "session" && (
        <Section title="Time slots" hint="When this runs and how many people each slot can take.">
          <div className="space-y-4 sm:col-span-2">
            {f.slots.map((slot, i) => (
              <div key={i} className="rounded-xl border border-navy/15 p-4">
                <div className="grid gap-4 sm:grid-cols-[9.5rem_7rem_1fr]">
                  <Field label="Starts at" htmlFor={`slot-time-${i}`} error={err(`slots.${i}.time`)}>
                    <Input id={`slot-time-${i}`} type="time" value={slot.time} onChange={(e) => updateSlot(i, { time: e.target.value })} required />
                  </Field>
                  <Field label="Seats" htmlFor={`slot-cap-${i}`} error={err(`slots.${i}.capacity`)}>
                    <Input id={`slot-cap-${i}`} inputMode="numeric" value={slot.capacity} onChange={(e) => updateSlot(i, { capacity: e.target.value })} required />
                  </Field>
                  <div>
                    <p className="mb-1.5 text-sm font-semibold text-navy">Runs on</p>
                    <div className="flex gap-1.5">
                      {DAYS.map((d, dow) => {
                        const on = slot.daysOfWeek.includes(dow);
                        return (
                          <button key={dow} type="button" aria-pressed={on} aria-label={DAY_NAMES[dow]}
                            onClick={() => updateSlot(i, { daysOfWeek: on ? slot.daysOfWeek.filter((x) => x !== dow) : [...slot.daysOfWeek, dow].sort() })}
                            className={cn("h-11 w-11 rounded-lg border text-sm font-semibold transition", on ? "border-green bg-green/15 text-navy" : "border-navy/20 bg-white text-navy/50")}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    {err(`slots.${i}.daysOfWeek`) && <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-700">{err(`slots.${i}.daysOfWeek`)}</p>}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Only from (optional)" htmlFor={`slot-from-${i}`}><Input id={`slot-from-${i}`} type="date" value={slot.validFrom} onChange={(e) => updateSlot(i, { validFrom: e.target.value })} /></Field>
                  <Field label="Only until (optional)" htmlFor={`slot-to-${i}`}><Input id={`slot-to-${i}`} type="date" value={slot.validTo} onChange={(e) => updateSlot(i, { validTo: e.target.value })} /></Field>
                </div>
                {f.slots.length > 1 && (
                  <button type="button" onClick={() => { setSaved(false); setF((p) => ({ ...p, slots: p.slots.filter((_, j) => j !== i) })); }}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:underline"><X className="h-4 w-4" aria-hidden /> Remove this slot</button>
                )}
              </div>
            ))}
            {fields.slots && <p role="alert" className="text-[13px] font-medium text-red-700">{fields.slots}</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => { setSaved(false); setF((p) => ({ ...p, slots: [...p.slots, { time: "14:00", capacity: "10", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], validFrom: "", validTo: "" }] })); }}>
              <Plus className="h-4 w-4" aria-hidden /> Add another slot
            </Button>
          </div>
        </Section>
      )}

      {kind === "rental_day" && (
        <Section title="Rental terms">
          <Field label="Pickup from" htmlFor="pickupTime" error={err("pickupTime")}><Input id="pickupTime" type="time" value={f.pickupTime} onChange={(e) => set("pickupTime", e.target.value)} required /></Field>
          <Field label="Return by" htmlFor="returnByTime" error={err("returnByTime")}><Input id="returnByTime" type="time" value={f.returnByTime} onChange={(e) => set("returnByTime", e.target.value)} required /></Field>
          <Field label="Security deposit (₹)" htmlFor="securityDeposit" hint="You collect this in person at pickup and return it at the end. We never handle it." error={err("securityDeposit")}>
            <Input {...bind("securityDeposit")} inputMode="numeric" />
          </Field>
          <Field label="Helmets included" htmlFor="helmetsIncluded" error={err("helmetsIncluded")}><Select {...bind("helmetsIncluded")}>{[0, 1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>
          <Field label="Kilometre limit per day (optional)" htmlFor="kmLimitPerDay" error={err("kmLimitPerDay")}><Input {...bind("kmLimitPerDay")} inputMode="numeric" placeholder="e.g. 80" /></Field>
          <Field label="Late return fee per hour (₹, optional)" htmlFor="lateFeePerHour" error={err("lateFeePerHour")}><Input {...bind("lateFeePerHour")} inputMode="numeric" /></Field>
          <Field label="Fuel" htmlFor="fuelPolicy"><Input {...bind("fuelPolicy")} placeholder="e.g. Return with the same fuel level" /></Field>
          <Field label="Where it can't go (optional)" htmlFor="areaRestrictions"><Input {...bind("areaRestrictions")} placeholder="e.g. Not beyond Pelling–Geyzing" /></Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold text-navy">Customers must bring</legend>
            <div className="grid gap-2.5">
              {DOCS.map((d) => (
                <Checkbox key={d} label={d} checked={f.docsRequired.includes(d)}
                  onChange={(e) => set("docsRequired", e.target.checked ? [...f.docsRequired, d] : f.docsRequired.filter((x) => x !== d))} />
              ))}
            </div>
            <p className="mt-2 text-[13px] text-navy/60">You check the originals at pickup. We never store licence numbers.</p>
          </fieldset>
        </Section>
      )}

      <Section title="Price and advance" hint="Customers pay the advance to your UPI to hold their booking. The rest is paid in person.">
        <Field label={kind === "rental_day" ? "Price per day for one vehicle (₹)" : "Price per person (₹)"} htmlFor="unitPrice" error={err("unitPrice")}>
          <Input {...bind("unitPrice")} inputMode="numeric" required />
        </Field>
        <Field label="Ask for the advance as" htmlFor="advanceType">
          <Select {...bind("advanceType")}><option value="percent">A percentage of the total</option><option value="flat">A fixed amount</option></Select>
        </Field>
        <Field label={f.advanceType === "percent" ? "Advance (%)" : "Advance (₹)"} htmlFor="advanceValue" error={err("advanceValue")}>
          <Input {...bind("advanceValue")} inputMode="numeric" required />
        </Field>
        <Field label="Notice you need for same-day bookings" htmlFor="minNoticeHours" error={err("minNoticeHours")}>
          <Select {...bind("minNoticeHours")}>{[0, 1, 2, 4, 6, 12, 24].map((h) => <option key={h} value={h}>{h === 0 ? "None" : `${h} ${h === 1 ? "hour" : "hours"}`}</option>)}</Select>
        </Field>
        {advancePreview && (
          <p className="rounded-lg bg-green/10 px-4 py-3 text-[15px] text-navy sm:col-span-2" role="status">
            On {kind === "rental_day" ? "one vehicle for a day" : "one person"} ({formatINR(advancePreview.total)}), the customer pays <strong className="tabular-nums">{formatINR(advancePreview.advance)}</strong> now and <strong className="tabular-nums">{formatINR(advancePreview.total - advancePreview.advance)}</strong> in person.
          </p>
        )}
      </Section>

      <Section title="Policies and details">
        <Field label="What's included" htmlFor="inclusions" hint="One per line." error={err("inclusions")}><Textarea {...bind("inclusions")} rows={4} placeholder={kind === "rental_day" ? "2 helmets\nBasic toolkit" : "Life jackets\nCertified guide"} /></Field>
        <Field label="What's not included" htmlFor="exclusions" hint="One per line." error={err("exclusions")}><Textarea {...bind("exclusions")} rows={4} placeholder={kind === "rental_day" ? "Fuel" : "Transport to the start point"} /></Field>
        <Field label="Cancellation and refunds" htmlFor="cancellationPolicy" hint="Customers see this before paying." error={err("cancellationPolicy")} className="sm:col-span-2">
          <Textarea {...bind("cancellationPolicy")} rows={3} required />
        </Field>
        <Field label="Safety notes (optional)" htmlFor="safetyNotes" error={err("safetyNotes")} className="sm:col-span-2"><Textarea {...bind("safetyNotes")} rows={3} /></Field>
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Saving…" : mode === "create" ? "Save as draft" : "Save changes"}</Button>
        {saved && <p role="status" className="text-sm font-medium text-green-600">Saved.</p>}
      </div>
    </form>
  );
}
