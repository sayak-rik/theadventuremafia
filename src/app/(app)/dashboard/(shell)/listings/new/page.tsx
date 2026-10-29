import Link from "next/link";
import { Bike, Car, Map, Waves, Wind } from "lucide-react";
import { ListingForm } from "@/components/dashboard/ListingForm";
import { VehicleListingForm } from "@/components/dashboard/VehicleListingForm";
import { requireOperatorPage } from "@/lib/operator-auth";
import { getLaunchCategories, getRegions, getRouteCatalog } from "@/lib/taxonomy";

export const metadata = { title: "Add a listing" };

const ICONS: Record<string, typeof Bike> = { bike: Bike, scooter: Bike, waves: Waves, wind: Wind, map: Map, car: Car };
// Multi-day itinerary editor for tours isn't built yet — everything else is.
const EDITOR_READY = new Set(["rental_day", "session", "route_trip"]);

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireOperatorPage();
  const { category } = await searchParams;
  const [categories, regions] = await Promise.all([getLaunchCategories(), getRegions()]);
  const chosen = categories.find((c) => c.slug === category);

  if (!chosen) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl font-bold text-navy">What are you adding?</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((c) => {
            const Icon = ICONS[c.icon ?? ""] ?? Bike;
            const ready = EDITOR_READY.has(c.bookingModel);
            return (
              <Link key={c.slug} href={ready ? `/dashboard/listings/new?category=${c.slug}` : "#"} aria-disabled={!ready}
                className={`flex h-20 items-center gap-4 rounded-xl border px-5 text-lg font-semibold transition ${
                  ready ? "border-navy/15 bg-white text-navy hover:border-green hover:bg-green/5" : "pointer-events-none border-navy/10 bg-navy/[0.03] text-navy/40"}`}>
                <Icon className={`h-7 w-7 ${ready ? "text-green-600" : "text-navy/30"}`} aria-hidden /> {c.name}
                {!ready && <span className="ml-auto text-sm font-normal">Coming soon</span>}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  if (!EDITOR_READY.has(chosen.bookingModel)) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/listings/new" className="text-sm font-medium text-navy/60 hover:underline">Back</Link>
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-navy">The {chosen.name.toLowerCase()} editor is coming soon — contact us if you'd like to list one in the meantime.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/listings" className="text-sm font-medium text-navy/60 hover:underline">Back to listings</Link>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">Add {chosen.name.toLowerCase()}</h1>
        <p className="mt-1 text-navy/70">Save it as a draft first, then add photos and submit it for review.</p>
      </div>
      {chosen.bookingModel === "route_trip" ? (
        <VehicleListingForm mode="create" regions={regions} routes={await getRouteCatalog()} />
      ) : (
        <ListingForm mode="create" categorySlug={chosen.slug} kind={chosen.bookingModel === "rental_day" ? "rental_day" : "session"} regions={regions} />
      )}
    </div>
  );
}
