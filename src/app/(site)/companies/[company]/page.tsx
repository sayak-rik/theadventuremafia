import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { VerifiedBadge } from "@/components/marketplace/VerifiedBadge";
import { ShareButton } from "@/components/marketplace/ShareButton";
import { JsonLd } from "@/components/JsonLd";
import { Button } from "@/components/ui/button";
import { getCompanyPage } from "@/lib/listings/public";
import { itemListLd } from "@/lib/seo";
import { whatsappLink } from "@/lib/phone";
import { SITE } from "@/data/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ company: string }> }): Promise<Metadata> {
  const { company } = await params;
  const page = await getCompanyPage(company);
  if (!page) return { title: "Not found", robots: { index: false } };
  const { company: c, listings } = page;
  const isDriver = c.companyType === "driver";
  const title = isDriver
    ? `${c.name} — driver in Sikkim`
    : `${c.name} — rentals and trips in Sikkim`;
  const description = c.description?.slice(0, 155) ?? `Book ${listings.map((l) => l.title).slice(0, 3).join(", ")} with ${c.name}.`;
  // A driver shares this link over WhatsApp to advertise themselves, so it needs
  // a real preview image — never the video, OG images must be static.
  const image = c.coverImageUrl ?? c.logoUrl ?? listings.find((l) => l.cover)?.coverFull ?? listings.find((l) => l.cover)?.cover ?? undefined;
  const url = `/companies/${c.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: `${title} · ${SITE.name}`, description, images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const page = await getCompanyPage(company);
  if (!page) notFound();
  const { company: c, listings } = page;
  const isDriver = c.companyType === "driver";
  const url = `${SITE.url}/companies/${c.slug}`;
  const heroListing = isDriver ? listings[0] : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "LocalBusiness", name: c.name, description: c.description ?? undefined, telephone: c.phone, url,
          ...(c.address ? { address: { "@type": "PostalAddress", streetAddress: c.address, addressRegion: "Sikkim", addressCountry: "IN" } } : {}) },
        itemListLd(listings.map((l) => ({ name: l.title, url: `/companies/${l.companySlug}/${l.slug}` }))),
      ]} />

      {isDriver && heroListing?.coverFull && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-navy/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroListing.coverFull} alt="" className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]" />
        </div>
      )}

      <header className="max-w-2xl">
        {isDriver && heroListing?.originRegionName && heroListing?.destinationRegionName && (
          <p className="mb-1.5 text-sm font-semibold text-green-700">{heroListing.originRegionName} → {heroListing.destinationRegionName}</p>
        )}
        <h1 className="font-serif text-4xl font-bold text-navy">{c.name}</h1>
        {c.verified && <VerifiedBadge className="mt-2" />}
        {c.description && <p className="mt-4 leading-relaxed text-navy/80">{c.description}</p>}
        {c.address && <p className="mt-3 flex items-start gap-2 text-[15px] text-navy/80"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{c.address}{c.mapsUrl && <> · <a href={c.mapsUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">Map</a></>}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href={`tel:${c.phone}`}><Phone className="h-4 w-4" aria-hidden /> Call</a></Button>
          <Button asChild variant="outline" size="sm"><a href={whatsappLink(c.whatsapp ?? c.phone, `Hi, I found you on The Adventure Mafia`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</a></Button>
          <ShareButton url={url} title={c.name} />
        </div>
      </header>

      <h2 className="mb-5 mt-10 font-serif text-2xl font-bold text-navy">{isDriver ? (listings.length > 1 ? "Routes" : "The route") : "What you can book"}</h2>
      {listings.length === 0 ? <p className="text-navy/70">Nothing is live right now.</p> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map((l, i) => <ListingCard key={l.id} l={l} priority={i < 3} />)}</div>
      )}
    </div>
  );
}
