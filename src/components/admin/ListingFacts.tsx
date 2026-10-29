import { formatINR } from "@/lib/pricing";
import type { ListingDetail } from "@/lib/listings/repo";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-navy/60">{label}</dt>
      <dd className="text-[15px] text-navy">{value}</dd>
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const list = (items: string[]) => (items.length ? items.join(", ") : null);

/** Read-only rendering of everything an operator entered, for admin review. */
export function ListingFacts({ detail, regionName, categoryName }: { detail: ListingDetail; regionName: string; categoryName: string }) {
  const f = detail.form;
  return (
    <div className="space-y-6">
      {detail.images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {detail.images.map((i) => (
            <li key={i.id} className="aspect-[4/3] overflow-hidden rounded-lg bg-navy/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-navy">No photos yet.</p>
      )}

      <dl className="divide-y divide-navy/10 rounded-2xl border border-navy/10 bg-white px-5">
        <Row label="Category" value={categoryName} />
        <Row label="Place" value={regionName} />
        <Row label="Description" value={<span className="whitespace-pre-line">{f.description}</span>} />
        <Row label="Meeting / pickup" value={f.meetingPoint} />
        <Row label={f.kind === "rental_day" ? "Price per day" : "Price per person"} value={<span className="tabular-nums">{formatINR(f.unitPrice)}</span>} />
        <Row label="Advance" value={f.advanceType === "percent" ? `${f.advanceValue}% of the total` : `${formatINR(f.advanceValue)} fixed`} />
        <Row label="Same-day notice" value={`${f.minNoticeHours} hours`} />

        {f.kind === "rental_day" && (
          <>
            <Row label="Vehicle" value={`${f.makeModel}${f.engineCc ? `, ${f.engineCc}cc` : ""}, ${f.transmission}, ${f.fuelType}`} />
            <Row label="Units" value={f.unitsTotal} />
            <Row label="Security deposit" value={<span className="tabular-nums">{formatINR(f.securityDeposit)} (collected in person)</span>} />
            <Row label="Helmets" value={f.helmetsIncluded} />
            <Row label="Pickup / return" value={`${f.pickupTime} – ${f.returnByTime}`} />
            <Row label="Km limit" value={f.kmLimitPerDay ? `${f.kmLimitPerDay} km/day` : null} />
            <Row label="Late fee" value={f.lateFeePerHour ? `${formatINR(f.lateFeePerHour)} per hour` : null} />
            <Row label="Fuel" value={f.fuelPolicy} />
            <Row label="Restrictions" value={f.areaRestrictions} />
            <Row label="Customers bring" value={list(f.docsRequired)} />
          </>
        )}

        {f.kind === "session" && (
          <>
            <Row label="Total length" value={`${f.durationHours} hours`} />
            <Row label="Difficulty" value={f.difficulty} />
            <Row label="Guides / pilots" value={f.certification} />
            <Row label="Age" value={f.minAge || f.maxAge ? `${f.minAge ?? "any"} to ${f.maxAge ?? "any"}` : null} />
            <Row label="Weight (kg)" value={f.minWeightKg || f.maxWeightKg ? `${f.minWeightKg ?? "any"} to ${f.maxWeightKg ?? "any"}` : null} />
            <Row label="Group" value={f.groupMin || f.groupMax ? `${f.groupMin ?? 1} to ${f.groupMax ?? "any"} people` : null} />
            <Row label="Rapids" value={f.rapidsGrade ? `Grade ${f.rapidsGrade}${f.stretchName ? `, ${f.stretchName}` : ""}${f.distanceKm ? `, ${f.distanceKm} km` : ""}` : f.stretchName} />
            <Row label="Flight" value={f.flightMinutes ? `${f.flightMinutes} min${f.takeoffAltitudeM ? `, take-off ${f.takeoffAltitudeM} m` : ""}` : null} />
            <Row label="Must swim" value={f.swimRequired ? "Yes" : null} />
            <Row label="Waiver" value={f.waiverRequired ? "Required" : "Not required"} />
            <Row label="Weather" value={f.weatherDependent ? "Can cancel a slot" : null} />
            <Row label="Season" value={f.season} />
            <Row label="Equipment" value={f.equipmentNotes} />
            <Row
              label="Slots"
              value={
                <ul className="space-y-1">
                  {f.slots.map((s) => (
                    <li key={s.time} className="tabular-nums">
                      {s.time}, {s.capacity} seats, {s.daysOfWeek.length === 7 ? "every day" : s.daysOfWeek.map((d) => DAYS[d]).join(" ")}
                      {s.validFrom || s.validTo ? ` (${s.validFrom ?? "…"} to ${s.validTo ?? "…"})` : ""}
                    </li>
                  ))}
                </ul>
              }
            />
          </>
        )}

        {f.kind === "departure" && (
          <>
            <Row label="Length" value={`${f.durationDays} days / ${f.durationNights} nights`} />
            <Row label="Difficulty" value={f.difficulty} />
            <Row label="Trip type" value={f.tripType === "point_to_point" ? `Point to point${f.endRegionSlug ? ` (ends in ${f.endRegionSlug})` : ""}` : "Circuit (returns to start)"} />
            <Row label="Age" value={f.minAge ? `${f.minAge}+` : null} />
            <Row label="Group" value={f.groupMin || f.groupMax ? `${f.groupMin ?? 1} to ${f.groupMax ?? "any"} people` : null} />
            <Row label="Accommodation" value={f.accommodationType} />
            <Row label="Meals" value={f.mealPlan} />
            <Row label="Transport" value={f.transportIncluded ? "Included" : "Not included"} />
            <Row label="Max altitude" value={f.maxAltitudeM ? `${f.maxAltitudeM} m` : null} />
            <Row label="Weather" value={f.weatherDependent ? "Can cancel a departure" : null} />
            <Row label="Season" value={f.season} />
            <Row label="Highlights" value={list(f.highlights)} />
            <Row label="Customers bring" value={list(f.docsRequired)} />
            <Row
              label="Departures"
              value={
                <ul className="space-y-1">
                  {f.slots.map((s) => (
                    <li key={s.time} className="tabular-nums">
                      {s.time}, {s.capacity} spots, {s.daysOfWeek.length === 7 ? "every day" : s.daysOfWeek.map((d) => DAYS[d]).join(" ")}
                      {s.validFrom || s.validTo ? ` (${s.validFrom ?? "…"} to ${s.validTo ?? "…"})` : ""}
                    </li>
                  ))}
                </ul>
              }
            />
            <Row
              label="Itinerary"
              value={
                <ol className="list-decimal space-y-1 pl-4">
                  {f.itinerary.map((d) => (
                    <li key={d.day}>
                      <span className="font-medium">Day {d.day}: {d.title}</span>
                      {d.description ? <span className="block text-navy/70">{d.description}</span> : null}
                    </li>
                  ))}
                </ol>
              }
            />
          </>
        )}

        {f.kind === "route_trip" && (
          <>
            <Row label="Vehicle" value={`${f.vehicleType}, ${f.seats} seats${f.ac ? ", AC" : ""}`} />
            <Row label="Route" value={f.originRegionSlug && f.destinationRegionSlug ? `${f.originRegionSlug} → ${f.destinationRegionSlug}` : "Standardized route"} />
            <Row label="Units" value={f.unitsTotal} />
            <Row label="Trip type" value={f.oneWay ? "One way" : "Round trip"} />
            <Row label="Pickup time" value={f.pickupTime} />
            <Row label="Luggage" value={f.luggageNote} />
            <Row label="Registration" value={f.registrationNumber} />
            <Row label="RC expiry" value={f.rcExpiry} />
          </>
        )}

        <Row label="Included" value={list(f.inclusions)} />
        <Row label="Not included" value={list(f.exclusions)} />
        <Row label="Cancellation" value={<span className="whitespace-pre-line">{f.cancellationPolicy}</span>} />
        <Row label="Safety notes" value={f.safetyNotes} />
      </dl>
    </div>
  );
}
