import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { TREKS, getTrekContent } from "@/data/treks";
import { getTreks } from "@/lib/data";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { TrekBookingForm } from "@/components/TrekBookingForm";
import { JsonLd } from "@/components/JsonLd";
import { trekTripLd, breadcrumbLd } from "@/lib/seo";
import { formatINR } from "@/lib/pricing";

export function generateStaticParams() {
  return TREKS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trek = getTrekContent(slug);
  if (!trek) return {};
  const desc = `${trek.tagline}. ${trek.overview}`.slice(0, 155);
  const url = `/adventures/${trek.slug}`;
  return {
    title: trek.name,
    description: desc,
    alternates: { canonical: url },
    keywords: [
      trek.name,
      `${trek.name} ${trek.location}`,
      `${trek.location} day trek`,
      "Sikkim day trek",
      "West Sikkim trekking",
      "Sikkim adventure tour",
    ],
    openGraph: {
      type: "article",
      url,
      title: `${trek.name} · The Adventure Mafia`,
      description: trek.tagline,
      images: [{ url: trek.heroImage, width: 1200, height: 800, alt: trek.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${trek.name} · The Adventure Mafia`,
      description: trek.tagline,
      images: [trek.heroImage],
    },
  };
}

export default async function TrekPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trek = getTrekContent(slug);
  if (!trek) notFound();

  // Resolve the bookable DB record (or seed fallback) to get its id for the form.
  const bookable = (await getTreks()).find((t) => t.slug === slug);
  const trekId = bookable?.id ?? 0;
  const price = bookable?.price_per_person ?? trek.pricePerPerson;

  return (
    <>
      <JsonLd
        data={[
          trekTripLd({
            slug: trek.slug,
            name: trek.name,
            overview: trek.overview,
            pricePerPerson: price,
            difficulty: trek.difficulty,
            location: trek.location,
            heroImage: trek.heroImage,
          }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Adventures", path: "/adventures" },
            { name: trek.name, path: `/adventures/${trek.slug}` },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="relative isolate flex min-h-[60vh] items-end overflow-hidden bg-navy">
        <Image src={trek.heroImage} alt={trek.name} fill priority sizes="100vw" className="object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/50 via-navy/40 to-navy" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <Link href="/adventures" className="text-sm font-semibold text-green-300 hover:underline">← All adventures</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-green-300">Day Trek · {trek.location}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-bold leading-tight text-cream sm:text-5xl">{trek.name}</h1>
          <p className="mt-4 max-w-xl text-lg text-cream/85">{trek.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-cream/15 pt-6 text-cream">
            {[
              ["Price", `${formatINR(price)}${trek.taxiFareExtra ? " + taxi" : ""}`],
              ["Per", "person"],
              ["Duration", trek.duration],
              ["Difficulty", trek.difficulty],
              ["When", trek.availability],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] uppercase tracking-wide text-cream/55">{label}</dt>
                <dd className="mt-0.5 font-serif text-lg font-bold">{value}</dd>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Overview + highlights */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <h2 className="font-serif text-2xl font-bold text-navy">Overview</h2>
            <p className="mt-4 leading-relaxed text-navy/75">{trek.overview}</p>
            <p className="mt-3 text-sm text-navy/55">{trek.elevationOrDistance}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
              <h3 className="font-serif text-lg font-bold text-navy">Highlights</h3>
              <ul className="mt-4 space-y-2.5">
                {trek.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-sm text-navy/80">
                    <span className="mt-1 text-green-600" aria-hidden>▸</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Day plan */}
      <section className="bg-cream/60 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <SectionHeading eyebrow="The Day" title="How the trek unfolds" />
          <ol className="relative mt-10 border-l-2 border-green/30">
            {trek.itinerary.map((step, i) => (
              <li key={step.label} className="relative ml-6 pb-8 last:pb-0">
                <span className="absolute -left-[2.1rem] flex h-9 w-9 items-center justify-center rounded-full bg-green font-serif text-sm font-bold text-white ring-4 ring-cream">
                  {i + 1}
                </span>
                <Reveal>
                  <h3 className="font-serif text-lg font-bold text-navy">{step.label}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-navy/70">{step.detail}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Inclusions + gallery */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-green/30 bg-white p-7 shadow-sm">
              <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-navy">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green text-sm text-white" aria-hidden>✓</span>
                What&rsquo;s included
              </h3>
              <ul className="mt-5 space-y-3">
                {trek.inclusions.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-navy/80">
                    <span className="mt-0.5 shrink-0 text-green-600" aria-hidden>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {trek.taxiFareExtra && (
                <p className="mt-5 rounded-xl bg-cream px-4 py-3 text-xs text-navy/60">
                  {trek.priceNote ?? "Taxi fare is extra — shared between the group and paid on the day."}
                </p>
              )}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 gap-3">
              {trek.gallery.map((src, i) => (
                <div key={src} className={`relative overflow-hidden rounded-xl ${i === 0 ? "col-span-2 aspect-[16/9]" : "aspect-square"}`}>
                  <Image src={src} alt={`${trek.name} — view ${i + 1}`} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Booking */}
      <section id="book" className="border-t border-navy/10 bg-cream">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="Book this trek"
            title={`Reserve your ${trek.name}`}
            subtitle="Pick any day that suits you and tell us your group size — we&rsquo;ll confirm within 24 hours. No payment now."
          />
          <div className="mt-8">
            <TrekBookingForm
              trekId={trekId}
              trekName={trek.name}
              pricePerPerson={price}
              taxiFareExtra={trek.taxiFareExtra}
              priceNote={trek.priceNote}
            />
          </div>
        </div>
      </section>
    </>
  );
}
