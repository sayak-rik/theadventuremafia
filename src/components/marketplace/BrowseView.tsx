import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingCard, type CardAvailability } from "./ListingCard";
import { CategoryIcon } from "./CategoryIcon";
import { JsonLd } from "@/components/JsonLd";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { getCategories, getPublished, getRegionBySlug } from "@/lib/listings/public";
import { getRegions } from "@/lib/taxonomy";
import { getPublicAvailability } from "@/lib/booking/public";
import { itemListLd, breadcrumbLd } from "@/lib/seo";
import { REGION_CONTENT, DEFAULT_REGION_CONTENT } from "@/data/region-content";
import { isValidISODate, todayIST } from "@/lib/dates";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const INTRO: Record<string, string> = {
  "bike-rental": "Rent a bike by the day. Compare shops, see what's actually free on your date, and hold one with a small advance paid straight to the shop.",
  "scooty-rental": "Rent a scooty by the day — easy automatics for getting around town and out to the monasteries and viewpoints. See live availability and pay a small advance direct to the shop.",
  rafting: "River rafting with certified guides. Pick a slot, see the seats left and the safety limits, and pay a small advance direct to the operator.",
  paragliding: "Tandem paragliding with certified pilots. Check weight limits, pick a slot, and pay a small advance direct to the operator.",
  "guided-tours": "Multi-day guided tours with a fixed departure crew. See the itinerary, check the next departure date, and pay a small advance direct to the operator.",
  "car-hire": "Cars with a driver for a fixed route — standardized runs like Siliguri to Pelling, or a custom route. Pick a date and pay a small advance direct to the driver.",
};

export type BrowseParams = { date?: string; sort?: string; gears?: string; origin?: string; destination?: string };

export async function browseMetadata(categorySlug: string, regionSlug?: string) {
  const cats = await getCategories();
  const cat = cats.find((c) => c.slug === categorySlug);
  if (!cat) return null;
  const region = regionSlug ? await getRegionBySlug(regionSlug) : null;
  if (regionSlug && !region) return null;
  const where = region?.name ?? "Sikkim";
  const local = regionSlug ? (REGION_CONTENT[regionSlug] ?? DEFAULT_REGION_CONTENT) : null;
  return {
    title: `${cat.name} in ${where}${cat.fromPrice ? ` from ₹${cat.fromPrice}` : ""}${local ? ` — ${local.tagline}` : ""}`,
    description: `${local ? `${local.blurb} ` : ""}${INTRO[categorySlug] ?? `${cat.name} in ${where}.`} ${cat.listings ? `${cat.listings} ${cat.listings === 1 ? "option" : "options"} from verified local operators.` : ""}`.trim(),
    canonical: `/adventures/${categorySlug}${regionSlug ? `/${regionSlug}` : ""}`,
    hasListings: cat.listings > 0,
  };
}

export async function BrowseView({ categorySlug, regionSlug, search }: { categorySlug: string; regionSlug?: string; search: BrowseParams }) {
  const [cats, region] = await Promise.all([getCategories(), regionSlug ? getRegionBySlug(regionSlug) : Promise.resolve(null)]);
  const cat = cats.find((c) => c.slug === categorySlug);
  if (!cat || (regionSlug && !region)) notFound();

  const isCarHire = categorySlug === "car-hire";
  const regions = isCarHire ? await getRegions() : [];
  const today = todayIST();
  const date = search.date && isValidISODate(search.date) && search.date >= today ? search.date : null;
  const all = await getPublished({ categorySlug, regionSlug, originSlug: search.origin || undefined, destinationSlug: search.destination || undefined });
  const noun = cat.bookingModel === "rental_day" || cat.bookingModel === "route_trip" ? "vehicle" : "seat";

  let items = all.filter((l) => !search.gears || (l.transmission ?? "") === search.gears);
  const avail = new Map<number, CardAvailability>();
  if (date) {
    await Promise.all(items.map(async (l) => {
      try {
        const days = await getPublicAvailability(l.id, date, date);
        const slots = days[0]?.slots ?? [];
        avail.set(l.id, { available: slots.reduce((n, s) => n + s.available, 0), capacity: slots.reduce((n, s) => n + s.capacity, 0), label: shortDate(date) });
      } catch {
        avail.set(l.id, { available: 0, capacity: 0, label: shortDate(date) });
      }
    }));
  }
  const sort = search.sort ?? (date ? "available" : "recommended");
  items = [...items].sort((a, b) => {
    if (sort === "price_asc") return a.unitPrice - b.unitPrice;
    if (sort === "price_desc") return b.unitPrice - a.unitPrice;
    if (sort === "available" && date) return Number((avail.get(b.id)?.available ?? 0) > 0) - Number((avail.get(a.id)?.available ?? 0) > 0);
    return 0;
  });

  const where = region?.name ?? "Sikkim";
  const local = regionSlug ? (REGION_CONTENT[regionSlug] ?? DEFAULT_REGION_CONTENT) : null;
  const path = `/adventures/${categorySlug}${regionSlug ? `/${regionSlug}` : ""}`;
  const freeCount = date ? items.filter((l) => (avail.get(l.id)?.available ?? 0) > 0).length : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <JsonLd data={[
        itemListLd(items.map((l) => ({ name: l.title, url: `/companies/${l.companySlug}/${l.slug}` }))),
        breadcrumbLd([{ name: "Home", path: "/" }, { name: `${cat.name} in ${where}`, path }]),
      ]} />
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-navy/60"><Link href="/" className="hover:underline">Home</Link> <span aria-hidden>/</span> {cat.name}</nav>
      <div className="flex items-start gap-3">
        <span className="mt-1 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-green-300 sm:flex"><CategoryIcon icon={cat.icon} className="h-6 w-6" /></span>
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy sm:text-4xl">{cat.name} in {where}</h1>
          {local && <p className="mt-1 text-sm font-medium text-green-700">{local.tagline}</p>}
          <p className="mt-2 max-w-2xl leading-relaxed text-navy/75">
            {local && <>{local.blurb} </>}
            {INTRO[categorySlug]}
          </p>
        </div>
      </div>

      <form method="get" action={path} className={cn("mt-7 grid gap-3 rounded-2xl border border-navy/10 bg-white p-4 sm:items-end",
        isCarHire ? "sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]" : "sm:grid-cols-[1fr_1fr_1fr_auto]")}>
        {isCarHire && (
          <>
            <div>
              <label htmlFor="origin" className="mb-1.5 block text-sm font-semibold text-navy">From</label>
              <select id="origin" name="origin" defaultValue={search.origin ?? ""} className={cn(fieldClass, "h-11")}>
                <option value="">Anywhere</option>
                {regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="destination" className="mb-1.5 block text-sm font-semibold text-navy">To</label>
              <select id="destination" name="destination" defaultValue={search.destination ?? ""} className={cn(fieldClass, "h-11")}>
                <option value="">Anywhere</option>
                {regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <label htmlFor="date" className="mb-1.5 block text-sm font-semibold text-navy">Date</label>
          <input id="date" name="date" type="date" min={today} defaultValue={date ?? ""} className={cn(fieldClass, "h-11")} />
        </div>
        <div>
          <label htmlFor="sort" className="mb-1.5 block text-sm font-semibold text-navy">Sort by</label>
          <select id="sort" name="sort" defaultValue={sort} className={cn(fieldClass, "h-11")}>
            <option value="recommended">Recommended</option>
            {date && <option value="available">Available first</option>}
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        {cat.bookingModel === "rental_day" && (
          <div>
            <label htmlFor="gears" className="mb-1.5 block text-sm font-semibold text-navy">Gears</label>
            <select id="gears" name="gears" defaultValue={search.gears ?? ""} className={cn(fieldClass, "h-11")}>
              <option value="">Any</option><option value="automatic">Automatic</option><option value="gear">Gear</option>
            </select>
          </div>
        )}
        <Button type="submit" size="md" className="w-full sm:w-auto">Update</Button>
      </form>

      <p className="mt-5 text-sm text-navy/70" aria-live="polite">
        {items.length === 0 ? "" : date ? `${freeCount} of ${items.length} ${items.length === 1 ? "option has" : "options have"} ${noun}s free on ${shortDate(date)}.` : `${items.length} ${items.length === 1 ? "option" : "options"}. Pick a date to see what's free.`}
      </p>

      {items.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-dashed border-navy/20 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl font-bold text-navy">{all.length === 0 ? `No ${cat.name.toLowerCase()} listed yet` : "Nothing matches those filters"}</h2>
          <p className="mx-auto mt-2 max-w-md text-navy/70">
            {all.length === 0 ? "Local operators are joining now. Run one yourself? List your business and start taking bookings." : "Try a different gear option or date."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {all.length === 0 && <Button asChild><Link href="/partner">List your business</Link></Button>}
            <Button asChild variant="outline"><Link href="/">See everything</Link></Button>
          </div>
        </section>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l, i) => <ListingCard key={l.id} l={l} availability={date ? avail.get(l.id) : null} priority={i < 3} />)}
        </div>
      )}
    </div>
  );
}
