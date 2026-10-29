import Link from "next/link";
import { CategoryIcon } from "./CategoryIcon";
import { VerifiedBadge } from "./VerifiedBadge";
import { DIFFICULTY_LABEL, ROMAN, clock12, leftPhrase } from "@/lib/format";
import { formatINR } from "@/lib/pricing";
import { cn } from "@/lib/cn";
import type { ListingCardData } from "@/lib/listings/public-queries";

export type CardAvailability = { available: number; capacity: number; label: string } | null;

function chips(l: ListingCardData): string[] {
  if (l.bookingModel === "rental_day") {
    return [
      l.engineCc ? `${l.engineCc}cc` : null,
      l.transmission === "automatic" ? "Automatic" : l.transmission === "gear" ? "Gear" : null,
      l.fuelType === "electric" ? "Electric" : null,
      l.helmets ? `${l.helmets} ${l.helmets === 1 ? "helmet" : "helmets"}` : null,
    ].filter(Boolean) as string[];
  }
  if (l.bookingModel === "departure") {
    return [
      l.durationDays ? `${l.durationDays}D/${l.durationNights ?? 0}N` : null,
      l.difficulty ? DIFFICULTY_LABEL[l.difficulty] : null,
    ].filter(Boolean) as string[];
  }
  if (l.bookingModel === "route_trip") {
    return [
      l.vehicleType ? l.vehicleType[0].toUpperCase() + l.vehicleType.slice(1) : null,
      l.seats ? `${l.seats} seats` : null,
      l.originRegionName && l.destinationRegionName ? `${l.originRegionName} → ${l.destinationRegionName}` : null,
    ].filter(Boolean) as string[];
  }
  return [
    l.durationHours ? `${l.durationHours} hr${l.durationHours === 1 ? "" : "s"}` : null,
    l.rapidsGrade ? `Grade ${ROMAN[l.rapidsGrade]}` : null,
    l.flightMinutes ? `${l.flightMinutes} min flight` : null,
    l.difficulty ? DIFFICULTY_LABEL[l.difficulty] : null,
  ].filter(Boolean) as string[];
}

const CATEGORY_ICON: Record<string, string> = {
  "bike-rental": "bike", "scooty-rental": "scooter", rafting: "waves", paragliding: "wind", "guided-tours": "map", "car-hire": "car",
};

export function ListingCard({ l, availability, priority = false, href }: { l: ListingCardData; availability?: CardAvailability; priority?: boolean; href?: string }) {
  const unit = l.bookingModel === "rental_day" ? "a day" : l.bookingModel === "route_trip" ? "a vehicle" : "a person";
  const noun = l.bookingModel === "rental_day" || l.bookingModel === "route_trip" ? "vehicle" : "seat";
  const soldOut = availability && availability.available <= 0;
  return (
    <Link
      href={href ?? `/companies/${l.companySlug}/${l.slug}`}
      className={cn("group flex flex-col overflow-hidden rounded-xl border border-navy/10 bg-white transition hover:border-navy/25 hover:shadow-luxe", soldOut && "opacity-75")}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-navy/5">
        {l.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.cover}
            alt=""
            width={400}
            height={300}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-navy/25"><CategoryIcon icon={CATEGORY_ICON[l.categorySlug] ?? "waves"} className="h-12 w-12" /></div>
        )}
        {l.isFeatured && (
          <span className="absolute right-3 top-3 rounded-full bg-green-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">Featured</span>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm">
          <CategoryIcon icon={CATEGORY_ICON[l.categorySlug] ?? "waves"} className="h-3.5 w-3.5 text-green-600" />
          {l.categoryName}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-semibold leading-snug text-navy">{l.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-navy/70">
          <span>{l.companyName}</span>
          {l.companyVerified && <VerifiedBadge label={false} />}
        </p>
        {chips(l).length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {chips(l).map((c) => <li key={c} className="rounded-md bg-navy/[0.06] px-2 py-1 text-xs font-medium text-navy/80">{c}</li>)}
          </ul>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="whitespace-nowrap text-xl font-bold tabular-nums text-navy">{formatINR(l.unitPrice)}<span className="ml-1 text-sm font-medium text-navy/60">{unit}</span></p>
              <p className="text-[13px] text-navy/60">
                Pay {l.advanceType === "percent" ? `${l.advanceValue}%` : formatINR(l.advanceValue)} now, rest at the {l.bookingModel === "rental_day" ? "shop" : l.bookingModel === "route_trip" ? "pickup" : "start"}
              </p>
            </div>
            {availability && (
              <p className={cn("shrink-0 text-right text-sm font-semibold", soldOut ? "text-red-700" : availability.available <= 2 ? "text-amber-800" : "text-green-600")}>
                {soldOut ? "Fully booked" : leftPhrase(availability.available, noun)}
                <span className="block text-xs font-normal text-navy/55">{availability.label}</span>
              </p>
            )}
          </div>
          {!availability && l.slotTimes.length > 0 && <p className="mt-2 border-t border-navy/10 pt-2 text-[13px] tabular-nums text-navy/65">{l.slotTimes.slice(0, 4).map(clock12).join(" · ")}</p>}
        </div>
      </div>
    </Link>
  );
}
