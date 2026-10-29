import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MapPin, MessageCircle, Phone, X } from "lucide-react";
import { Gallery } from "@/components/marketplace/Gallery";
import { BookingCard } from "@/components/marketplace/BookingCard";
import { BookingBar } from "@/components/marketplace/BookingBar";
import { VerifiedBadge } from "@/components/marketplace/VerifiedBadge";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { JsonLd } from "@/components/JsonLd";
import { Button } from "@/components/ui/button";
import { getListingDetail } from "@/lib/listings/public";
import { breadcrumbLd, listingLd } from "@/lib/seo";
import { DIFFICULTY_LABEL, ROMAN, clock12 } from "@/lib/format";
import { formatINR } from "@/lib/pricing";
import { todayIST } from "@/lib/dates";
import { whatsappLink } from "@/lib/phone";
import { SITE } from "@/data/site";

export const dynamic = "force-dynamic";
type Params = { company: string; listing: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { company, listing } = await params;
  const d = await getListingDetail(company, listing);
  if (!d) return { title: "Not found", robots: { index: false } };
  const url = `/companies/${d.companySlug}/${d.slug}`;
  const what = d.bookingModel === "rental_day" ? `${d.title} rental in ${d.regionName}` : `${d.title} in ${d.regionName}`;
  const description = `${what} from ${formatINR(d.unitPrice)} ${d.bookingModel === "rental_day" ? "a day" : "a person"} with ${d.companyName}. Check live availability and pay a small advance straight to the operator.`;
  return {
    title: what,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: `${what} · ${SITE.name}`, description, images: d.coverFull ? [{ url: d.coverFull, width: d.coverWidth ?? 1200, height: d.coverHeight ?? 800, alt: d.title }] : undefined },
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="grid gap-0.5 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-navy/60">{label}</dt>
      <dd className="text-[15px] text-navy">{children}</dd>
    </div>
  );
}

function Bullets({ items, tone }: { items: string[]; tone: "yes" | "no" }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5 text-[15px] text-navy/85">
          {tone === "yes" ? <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-green-600" aria-hidden /> : <X className="mt-0.5 h-[18px] w-[18px] shrink-0 text-navy/40" aria-hidden />}
          {t}
        </li>
      ))}
    </ul>
  );
}

export default async function ListingPage({ params }: { params: Promise<Params> }) {
  const { company, listing } = await params;
  const d = await getListingDetail(company, listing);
  if (!d) notFound();
  const isRental = d.bookingModel === "rental_day";
  const r = d.rental;
  const s = d.session;
  const icon = d.categorySlug === "bike-rental" ? "bike" : d.categorySlug === "scooty-rental" ? "scooter" : d.categorySlug === "rafting" ? "waves"
    : d.categorySlug === "paragliding" ? "wind" : d.categorySlug === "guided-tours" ? "map" : d.categorySlug === "car-hire" ? "car" : "map";
  const who = [s?.minWeightKg || s?.maxWeightKg ? `${s?.minWeightKg ?? 0}–${s?.maxWeightKg ?? "any"} kg` : null, d.minAge || s?.maxAge ? `ages ${d.minAge ?? 0}${s?.maxAge ? `–${s.maxAge}` : "+"}` : null,
    d.groupMax ? `up to ${d.groupMax} per booking` : null].filter(Boolean).join(", ");

  return (
    <>
      <JsonLd data={[listingLd(d), breadcrumbLd([
        { name: "Home", path: "/" }, { name: d.categoryName, path: `/adventures/${d.categorySlug}/${d.regionSlug}` }, { name: d.title, path: `/companies/${d.companySlug}/${d.slug}` }])]} />
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-16">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-navy/60">
          <Link href="/" className="hover:underline">Home</Link> <span aria-hidden>/</span>{" "}
          <Link href={`/adventures/${d.categorySlug}/${d.regionSlug}`} className="hover:underline">{d.categoryName} in {d.regionName}</Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:gap-x-10 lg:gap-y-8">
          <div className="min-w-0 lg:col-start-1">
            <Gallery images={d.images} title={d.title} icon={icon} />
            <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-navy sm:text-4xl">{d.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-navy/75">
              <span>by <Link href={`/companies/${d.company.slug}`} className="font-semibold text-navy underline-offset-2 hover:underline">{d.companyName}</Link></span>
              {d.companyVerified && <VerifiedBadge />}
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {d.regionName}</span>
            </p>
          </div>

          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:sticky lg:top-24">
            {d.bookingModel === "rental_day" || d.bookingModel === "session" ? (
              <BookingCard
                listingId={d.id} title={d.title} bookingModel={d.bookingModel} unitPrice={d.unitPrice} advanceType={d.advanceType} advanceValue={d.advanceValue}
                securityDeposit={d.securityDeposit ?? 0} groupMin={d.groupMin} groupMax={d.groupMax} minAge={d.minAge} maxAge={s?.maxAge ?? null}
                minWeightKg={s?.minWeightKg ?? null} maxWeightKg={s?.maxWeightKg ?? null} waiverRequired={s?.waiverRequired ?? false} today={todayIST()}
              />
            ) : (
              // Dedicated booking widgets for tours/cars are coming soon — contact the operator directly for now.
              <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                <p className="text-2xl font-bold text-navy">{formatINR(d.unitPrice)} <span className="text-sm font-normal text-navy/60">{d.bookingModel === "departure" ? "per person" : "per vehicle"}</span></p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="w-full"><a href={`tel:${d.company.phone}`}><Phone className="h-4 w-4" aria-hidden /> Call to book</a></Button>
                  <Button asChild variant="outline" className="w-full"><a href={whatsappLink(d.company.whatsapp ?? d.company.phone, `Hi, I'm interested in "${d.title}" on The Adventure Mafia`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</a></Button>
                </div>
              </div>
            )}
            <p className="mt-3 px-1 text-[13px] leading-relaxed text-navy/60">You pay the advance straight to {d.companyName} by UPI. The Adventure Mafia never holds your money.</p>
          </aside>

          <div className="min-w-0 space-y-10 lg:col-start-1">
            <section aria-labelledby="about">
              <h2 id="about" className="font-serif text-2xl font-bold text-navy">About this {isRental ? "rental" : "trip"}</h2>
              <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-navy/85">{d.description}</p>
            </section>

            {(d.inclusions.length > 0 || d.exclusions.length > 0) && (
              <section aria-labelledby="inc" className="grid gap-8 sm:grid-cols-2">
                {d.inclusions.length > 0 && <div><h2 id="inc" className="mb-3 font-serif text-xl font-bold text-navy">Included</h2><Bullets items={d.inclusions} tone="yes" /></div>}
                {d.exclusions.length > 0 && <div><h2 className="mb-3 font-serif text-xl font-bold text-navy">Not included</h2><Bullets items={d.exclusions} tone="no" /></div>}
              </section>
            )}

            <section aria-labelledby="know">
              <h2 id="know" className="font-serif text-2xl font-bold text-navy">Good to know</h2>
              <dl className="mt-2 divide-y divide-navy/10 border-y border-navy/10">
                {isRental && r && (
                  <>
                    <Row label="Pick-up and return">{r.pickupTime && r.returnByTime ? `Pick up from ${clock12(r.pickupTime)}, return by ${clock12(r.returnByTime)}` : null}</Row>
                    <Row label="Meeting point">{d.meetingPoint}</Row>
                    <Row label="Bring">{r.docsRequired.length ? r.docsRequired.join("; ") : null}</Row>
                    <Row label="Security deposit">{d.securityDeposit ? `${formatINR(d.securityDeposit)} per vehicle, paid to the shop in person and returned when you bring it back` : null}</Row>
                    <Row label="Distance">{r.kmLimitPerDay ? `${r.kmLimitPerDay} km a day` : "No daily limit"}</Row>
                    <Row label="Fuel">{r.fuelPolicy}</Row>
                    <Row label="Late return">{r.lateFeePerHour ? `${formatINR(r.lateFeePerHour)} for each extra hour` : null}</Row>
                    <Row label="Where you can ride">{r.areaRestrictions}</Row>
                  </>
                )}
                {!isRental && s && (
                  <>
                    <Row label="Meeting point">{d.meetingPoint}</Row>
                    <Row label="Length">{d.durationHours ? `${d.durationHours} ${d.durationHours === 1 ? "hour" : "hours"} including briefing and transfers` : null}</Row>
                    <Row label="Time slots">{d.slotTimes.length ? d.slotTimes.map(clock12).join(", ") : null}</Row>
                    <Row label="Who can join">{who}</Row>
                    <Row label="Difficulty">{d.difficulty ? DIFFICULTY_LABEL[d.difficulty] : null}</Row>
                    <Row label="Rapids">{d.rapidsGrade ? `Grade ${ROMAN[d.rapidsGrade]}${s.stretchName ? ` on ${s.stretchName}` : ""}${s.distanceKm ? `, ${s.distanceKm} km` : ""}` : s.stretchName}</Row>
                    <Row label="Flight">{d.flightMinutes ? `About ${d.flightMinutes} minutes${s.takeoffAltitudeM ? `, take-off at ${s.takeoffAltitudeM} m` : ""}` : null}</Row>
                    <Row label="Guides and pilots">{s.certification}</Row>
                    <Row label="Equipment">{s.equipmentNotes}</Row>
                    <Row label="Swimming">{s.swimRequired ? "You need to be able to swim" : null}</Row>
                    <Row label="Safety waiver">{s.waiverRequired ? "Everyone signs a waiver before joining" : null}</Row>
                    <Row label="Weather">{d.weatherDependent ? "A slot can be cancelled for weather or safety. You'd be offered a new date or a refund." : null}</Row>
                    <Row label="Best season">{d.season}</Row>
                  </>
                )}
                {d.tour && (
                  <>
                    <Row label="Length">{`${d.durationDays} days / ${d.durationNights} nights`}</Row>
                    <Row label="Trip type">{d.tour.tripType === "point_to_point" ? `Point to point${d.tour.endRegionName ? `, ends in ${d.tour.endRegionName}` : ""}` : "Circuit — returns to the start"}</Row>
                    <Row label="Who can join">{who}</Row>
                    <Row label="Difficulty">{d.difficulty ? DIFFICULTY_LABEL[d.difficulty] : null}</Row>
                    <Row label="Accommodation">{d.tour.accommodationType}</Row>
                    <Row label="Meals">{d.tour.mealPlan}</Row>
                    <Row label="Transport">{d.tour.transportIncluded ? "Included" : "Not included"}</Row>
                    <Row label="Max altitude">{d.tour.maxAltitudeM ? `${d.tour.maxAltitudeM} m` : null}</Row>
                    <Row label="Departures">{d.slotTimes.length ? d.slotTimes.map(clock12).join(", ") : null}</Row>
                    <Row label="Weather">{d.weatherDependent ? "A departure can be cancelled for weather or safety. You'd be offered a new date or a refund." : null}</Row>
                    <Row label="Best season">{d.season}</Row>
                  </>
                )}
                {d.vehicle && (
                  <>
                    <Row label="Route">{d.originRegionName && d.destinationRegionName ? `${d.originRegionName} → ${d.destinationRegionName}` : "Standardized route"}</Row>
                    <Row label="Vehicle">{`${d.vehicleType ?? "Car"}, ${d.seats ?? "—"} seats${d.vehicle.ac ? ", AC" : ""}`}</Row>
                    <Row label="Trip type">{d.vehicle.oneWay ? "One way" : "Round trip"}</Row>
                    <Row label="Pickup time">{d.vehicle.pickupTime}</Row>
                    <Row label="Luggage">{d.vehicle.luggageNote}</Row>
                  </>
                )}
              </dl>
              {d.safetyNotes && <p className="mt-4 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-navy/80"><strong className="text-navy">Safety: </strong>{d.safetyNotes}</p>}
            </section>

            {d.cancellationPolicy && (
              <section aria-labelledby="cancel">
                <h2 id="cancel" className="font-serif text-2xl font-bold text-navy">Cancellation and refunds</h2>
                <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-navy/85">{d.cancellationPolicy}</p>
                <p className="mt-2 text-sm text-navy/60">Refunds are made by {d.companyName} directly.</p>
              </section>
            )}

            <section aria-labelledby="op" className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
              <h2 id="op" className="font-serif text-xl font-bold text-navy">{d.company.name}</h2>
              {d.company.verified && <VerifiedBadge className="mt-1" />}
              {d.company.description && <p className="mt-3 max-w-prose leading-relaxed text-navy/80">{d.company.description}</p>}
              {d.company.address && <p className="mt-3 flex items-start gap-2 text-[15px] text-navy/80"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{d.company.address}{d.company.mapsUrl && <> · <a href={d.company.mapsUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">Map</a></>}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><a href={`tel:${d.company.phone}`}><Phone className="h-4 w-4" aria-hidden /> Call</a></Button>
                <Button asChild variant="outline" size="sm"><a href={whatsappLink(d.company.whatsapp ?? d.company.phone, `Hi, I'm looking at "${d.title}" on The Adventure Mafia`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</a></Button>
                <Button asChild variant="ghost" size="sm"><Link href={`/companies/${d.company.slug}`}>All from this operator</Link></Button>
              </div>
            </section>

            {d.moreFromCompany.length > 0 && (
              <section aria-labelledby="more">
                <h2 id="more" className="mb-4 font-serif text-2xl font-bold text-navy">More from {d.company.name}</h2>
                <div className="grid gap-5 sm:grid-cols-2">{d.moreFromCompany.map((l) => <ListingCard key={l.id} l={l} />)}</div>
              </section>
            )}
          </div>
        </div>
      </div>
      <BookingBar price={d.unitPrice} unit={isRental ? "a day" : d.bookingModel === "route_trip" ? "a vehicle" : "a person"} />
    </>
  );
}
