import Link from "next/link";
import { Bike, Plus, Waves, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot, LISTING_STATUS } from "@/components/ui/status";
import { ListingRowActions } from "@/components/dashboard/ListingRowActions";
import { requireOperatorPage } from "@/lib/operator-auth";
import { forCompany } from "@/lib/listings/repo";
import { getLaunchCategories } from "@/lib/taxonomy";
import { formatINR } from "@/lib/pricing";

export const metadata = { title: "Listings" };

const ICONS: Record<string, typeof Bike> = { bike: Bike, scooter: Bike, waves: Waves, wind: Wind };

export default async function ListingsPage() {
  const session = await requireOperatorPage();
  const [listings, categories] = await Promise.all([forCompany(session.companyId).list(), getLaunchCategories()]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy">Listings</h1>
          <p className="mt-1 text-navy/70">What customers can book from you.</p>
        </div>
        {listings.length > 0 && (
          <Button asChild><Link href="/dashboard/listings/new"><Plus className="h-4 w-4" aria-hidden /> Add listing</Link></Button>
        )}
      </div>

      {listings.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-navy/20 bg-white p-6 sm:p-8">
          <h2 className="font-serif text-xl font-bold text-navy">Add the first thing you offer</h2>
          <p className="mt-1 max-w-lg text-navy/70">Start with what you rent or run most days. You can add the rest later.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {categories.map((c) => {
              const Icon = ICONS[c.icon ?? ""] ?? Bike;
              return (
                <Link key={c.slug} href={`/dashboard/listings/new?category=${c.slug}`}
                  className="flex h-16 items-center gap-3 rounded-xl border border-navy/15 bg-white px-4 font-semibold text-navy transition hover:border-green hover:bg-green/5">
                  <Icon className="h-6 w-6 text-green-600" aria-hidden /> {c.name}
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
          {listings.map((l) => {
            const st = LISTING_STATUS[l.status] ?? LISTING_STATUS.draft;
            const facts =
              l.bookingModel === "rental_day"
                ? `${l.unitsTotal ?? 0} ${l.unitsTotal === 1 ? "vehicle" : "vehicles"} · ${l.unitPrice ? formatINR(l.unitPrice) : "—"} a day`
                : `${l.slotCount} ${l.slotCount === 1 ? "time slot" : "time slots"} · ${l.unitPrice ? formatINR(l.unitPrice) : "—"} a person`;
            return (
              <li key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  {l.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.cover} alt="" width={96} height={72} className="h-[72px] w-24 shrink-0 rounded-lg bg-navy/5 object-cover" />
                  ) : (
                    <div aria-hidden className="flex h-[72px] w-24 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-xs text-navy/40">No photo</div>
                  )}
                  <div className="min-w-0">
                    <Link href={`/dashboard/listings/${l.id}`} className="block truncate font-semibold text-navy hover:underline">{l.title}</Link>
                    <p className="text-sm text-navy/65">{l.categoryName} in {l.regionName}</p>
                    <p className="text-sm tabular-nums text-navy/80">{facts}</p>
                    <StatusDot tone={st.tone} className="mt-1 text-[13px]">{st.label}</StatusDot>
                  </div>
                </div>
                <ListingRowActions id={l.id} status={l.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
