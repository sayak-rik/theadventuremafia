import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ActivitySearch } from "@/components/marketplace/ActivitySearch";
import { TodayBoard } from "@/components/marketplace/TodayBoard";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { Marquee } from "@/components/Marquee";
import { Faq } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";
import { Button } from "@/components/ui/button";
import { getPublished, getFeatured } from "@/lib/listings/public";
import { faqLd, itemListLd } from "@/lib/seo";
import { todayIST } from "@/lib/dates";
import { REGION_CONTENT } from "@/data/region-content";

export const metadata: Metadata = { alternates: { canonical: "/" } };
export const dynamic = "force-dynamic";

const FAQS = [
  { q: "Do I pay online?", a: "You pay a small advance — usually 30% — straight to the operator or driver's UPI after you reserve. The Adventure Mafia never receives or holds the money. You pay the rest at the shop, or at the start of the trip." },
  { q: "How do I know my booking is confirmed?", a: "After you pay, you send us the 12-digit UPI reference. The operator checks their UPI app and confirms. Your booking page updates and we email you." },
  { q: "What do I need to rent a bike or scooty?", a: "Bring your original driving licence and a photo ID. The shop checks them before handing over the vehicle, and may take a refundable security deposit in person." },
  { q: "What if the weather cancels rafting, paragliding or a tour departure?", a: "Operators can close a slot for weather or safety. If yours is cancelled, they'll offer a new date or refund your advance." },
  { q: "Can I cancel?", a: "Each operator or driver sets their own cancellation and refund policy, shown before you pay. You can cancel an unpaid reservation any time from your booking page." },
  { q: "How long is my booking held?", a: "For 30 minutes while you pay the advance. After that, the vehicle or seats go back to other customers." },
] as const;

const STEPS = [
  { t: "Pick a day", d: "Choose what you want to do and see what's really free on your date." },
  { t: "Reserve it", d: "Enter your details. We hold it for 30 minutes." },
  { t: "Pay the advance by UPI", d: "Straight to the operator or driver. Then send us the 12-digit reference number." },
  { t: "Show up", d: "They confirm. Pay the rest at the shop or the start, and bring your ID." },
];

const REGION_STRIP = [
  { slug: "gangtok", path: "/adventures/guided-tours/gangtok" },
  { slug: "pelling", path: "/adventures/bike-rental/pelling" },
  { slug: "yuksom", path: "/adventures/guided-tours/yuksom" },
  { slug: "lachung", path: "/adventures/car-hire/lachung" },
  { slug: "lachen", path: "/adventures/car-hire/lachen" },
  { slug: "namchi", path: "/adventures/guided-tours/namchi" },
  { slug: "ravangla", path: "/adventures/guided-tours/ravangla" },
  { slug: "dzongu", path: "/adventures/guided-tours/dzongu" },
] as const;

export default async function HomePage() {
  const today = todayIST();
  const [featured, standouts] = await Promise.all([
    getPublished({ limit: 6 }).catch(() => []),
    getFeatured(6).catch(() => []),
  ]);
  const toShow = standouts.length > 0 ? standouts : featured;

  return (
    <>
      <JsonLd data={[
        faqLd(FAQS.map((f) => ({ q: f.q, a: f.a }))),
        itemListLd(REGION_STRIP.map((r) => ({ name: REGION_CONTENT[r.slug]?.tagline ?? r.slug, url: r.path }))),
      ]} />

      <section className="relative isolate overflow-hidden bg-navy text-cream">
        <Image
          src="https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1800&q=70"
          alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-35"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy/60 via-navy/70 to-navy" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-12">
          <div>
            <h1 className="font-serif text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Ride, raft, fly or tour — anywhere in Sikkim. Book it for today.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-cream/80">
              Live availability from verified local operators and drivers, from Gangtok to Pelling and the valleys between. Pay a small advance straight to them by UPI — we never touch your money.
            </p>
            <div className="mt-8 max-w-xl"><ActivitySearch today={today} /></div>
          </div>
          <TodayBoard />
        </div>

        <div className="border-t border-white/10 bg-black/10 py-5">
          <Marquee direction="horizontal" speed={22} className="mx-auto max-w-6xl">
            {REGION_STRIP.map((r) => {
              const c = REGION_CONTENT[r.slug];
              return (
                <Link key={r.slug} href={r.path} className="group flex items-baseline gap-2.5 whitespace-nowrap px-1 text-cream/80 transition hover:text-cream">
                  <span className="font-serif text-lg font-bold capitalize">{r.slug.replace("-", " ")}</span>
                  <span className="text-sm text-cream/50 group-hover:text-cream/70">{c?.tagline}</span>
                </Link>
              );
            })}
          </Marquee>
        </div>
      </section>

      {toShow.length > 0 && (
        <section aria-labelledby="featured-h" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="featured-h" className="font-serif text-3xl font-bold text-navy">{standouts.length > 0 ? "Featured right now" : "Book now"}</h2>
            <Link href="/adventures/guided-tours" className="text-sm font-semibold text-green-600 hover:underline">See all tours</Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {toShow.map((l, i) => <ListingCard key={l.id} l={l} priority={i < 3} />)}
          </div>
        </section>
      )}

      <section aria-labelledby="why-h" className="border-y border-navy/10 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <h2 id="why-h" className="font-serif text-3xl font-bold leading-tight text-navy sm:text-4xl">
              You pay the operator. We never hold your money, and we never will.
            </h2>
            <dl className="grid gap-7 sm:grid-cols-2">
              <div><dt className="font-semibold text-navy">Checked before they list</dt><dd className="mt-1.5 leading-relaxed text-navy/70">Every operator and driver is approved by us, and every listing is reviewed. Look for the gold badge.</dd></div>
              <div><dt className="font-semibold text-navy">Nothing added to the price</dt><dd className="mt-1.5 leading-relaxed text-navy/70">Your advance goes straight to their UPI. No platform markup, no hidden fees.</dd></div>
              <div><dt className="font-semibold text-navy">Live, not promised</dt><dd className="mt-1.5 leading-relaxed text-navy/70">If it shows as free on your date, you can book it — and we hold it while you pay.</dd></div>
              <div><dt className="font-semibold text-navy">Sikkim-wide, not just one town</dt><dd className="mt-1.5 leading-relaxed text-navy/70">From Gangtok to the Yumthang valley — tours, bikes, cars, rafting and paragliding.</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-h" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="how-h" className="font-serif text-3xl font-bold text-navy">How it works</h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span aria-hidden className="font-serif text-4xl font-bold text-green-600 tabular-nums">{i + 1}</span>
              <h3 className="mt-1 text-lg font-semibold text-navy">{s.t}</h3>
              <p className="mt-1.5 leading-relaxed text-navy/75">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="grid gap-6 rounded-2xl border border-navy/10 bg-white p-6 sm:p-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <h2 className="font-serif text-3xl font-bold text-navy">Run a rental shop, guide tours, or drive a route in Sikkim?</h2>
            <p className="mt-3 max-w-xl leading-relaxed text-navy/75">List your fleet, your tours, or your car, take bookings online, and get paid straight to your own UPI. Founding operators and drivers join free, and we never take a cut of your bookings.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Button asChild size="lg"><Link href="/partner/signup">List your business</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/drive/signup">Drive with us</Link></Button>
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-navy text-cream">
        <Image src="https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1600&q=60" alt="" fill sizes="100vw" className="-z-10 object-cover opacity-25" />
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold sm:text-3xl">Riding further than a day?</h2>
            <p className="mt-2 max-w-xl text-cream/75">Our own 7-day guided motorcycle expedition through West and North Sikkim, up to Gurudongmar Lake.</p>
          </div>
          <Button asChild size="lg" variant="outline" className="border-cream/40 bg-transparent text-cream hover:border-cream/70 hover:bg-white/5">
            <Link href="/itinerary">See the expedition <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="faq-h" className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 id="faq-h" className="font-serif text-3xl font-bold text-navy">Before you book</h2>
        <div className="mt-6"><Faq items={FAQS} /></div>
      </section>
    </>
  );
}
