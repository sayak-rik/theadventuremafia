import Link from "next/link";
import Image from "next/image";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { RouteMap } from "@/components/RouteMap";
import { Marquee } from "@/components/Marquee";
import { TestimonialCard } from "@/components/TestimonialCard";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { touristTripLd, faqLd } from "@/lib/seo";
import { FAQS } from "@/data/faq";
import { ROUTE_STOPS } from "@/data/itinerary";
import { EXPERIENCES } from "@/data/experiences";
import { formatINR } from "@/lib/pricing";
import { getTestimonials } from "@/lib/data";

const FEATURES = [
  {
    title: "Untouched trails",
    body: "Secluded West Sikkim routes most tours skip — Rinchenpong, Dentam, Uttarey — plus the high North.",
    icon: "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z",
  },
  {
    title: "Luxury support",
    body: "Backup mechanic, support vehicle, permits, curated stays and an optional shared cab for non-riding days.",
    icon: "M3 13l2-5a3 3 0 012.8-2h8.4A3 3 0 0119 8l2 5v5a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1H7v1a1 1 0 01-1 1H4a1 1 0 01-1-1z",
  },
  {
    title: "Local culture",
    body: "Ancient monasteries, Temi tea gardens and Himalayan villages — guided by riders who call these hills home.",
    icon: "M12 3l9 6v12H3V9l9-6zm0 6a3 3 0 100 6 3 3 0 000-6z",
  },
];

export default async function HomePage() {
  const testimonials = await getTestimonials();

  return (
    <>
      <JsonLd
        data={[
          touristTripLd({ stops: ROUTE_STOPS }),
          faqLd(FAQS),
        ]}
      />
      <Hero />

      {/* Our Adventures */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading
          center
          eyebrow="Our Adventures"
          title="Pick your kind of Himalaya"
          subtitle="From a seven-day motorcycle expedition to easy forest day treks — every adventure is guided, with local crews who know these hills."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {EXPERIENCES.map((exp, i) => (
            <Reveal key={exp.href} delay={i * 0.1}>
              <Link
                href={exp.href}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm transition hover:shadow-luxe"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={exp.image}
                    alt={exp.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  {exp.badge && (
                    <span className="absolute left-3 top-3 rounded-full bg-navy/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cream">
                      {exp.badge}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-serif text-xl font-bold text-navy">{exp.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-navy/70">{exp.blurb}</p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-navy/50">
                    <span>{exp.duration}</span>
                    <span aria-hidden>·</span>
                    <span>{exp.difficulty}</span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between border-t border-navy/10 pt-4">
                    <span className="text-sm text-navy/60">
                      from{" "}
                      <span className="font-serif text-lg font-bold text-navy">{formatINR(exp.priceFrom)}</span>{" "}
                      {exp.priceUnit}
                      {exp.priceSuffix ? ` ${exp.priceSuffix}` : ""}
                    </span>
                    <span className="text-sm font-semibold text-green-600 transition group-hover:translate-x-0.5">
                      View →
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The flagship expedition */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <SectionHeading
          eyebrow="The Flagship Expedition"
          title="Seven days. One unforgettable line across the Himalayas."
          subtitle="From New Jalpaiguri we climb west into Sikkim's quiet monasteries and valleys, then north to the snowfields of Gurudongmar — a route built for riders who want the road less travelled, without giving up comfort."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.1}>
              <div className="h-full rounded-2xl border border-navy/10 bg-white p-7 shadow-sm transition hover:shadow-luxe">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green/10 text-green-600">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={f.icon} />
                  </svg>
                </span>
                <h3 className="mt-5 font-serif text-xl font-bold text-navy">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy/70">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Route map */}
      <section className="bg-navy py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            light
            center
            eyebrow="The Route"
            title="NJP → Pelling → Yuksom → Lachen → Lachung"
            subtitle="Eight headline stops, two-up or solo, all on a Royal Enfield."
          />
          <div className="mt-12">
            <RouteMap />
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/itinerary"
              className="inline-block rounded-full bg-green px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-green-600"
            >
              See the day-by-day plan
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonial teaser */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="From the saddle" title="Riders on the expedition" />
      </section>

      {/* Full-bleed horizontal marquee of rider stories */}
      <div className="relative -mt-6 pb-4">
        <Marquee direction="horizontal" speed={40} className="px-4">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} t={t} className="w-[320px] shrink-0" />
          ))}
        </Marquee>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="text-center">
          <Link href="/testimonials" className="text-sm font-semibold text-green-600 hover:underline">
            Read all rider stories →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* CTA band */}
      <section className="bg-gradient-to-r from-green-600 to-green">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-14 text-center sm:px-6 md:flex-row md:text-left">
          <div>
            <h2 className="font-serif text-3xl font-bold text-white">Only 20 motorbikes per departure.</h2>
            <p className="mt-2 text-white/85">Plus 10 shared-cab seats. Sundays fill fast across the Sep–May season — hold yours now.</p>
          </div>
          <Link
            href="/booking"
            className="rounded-full bg-navy px-8 py-4 text-sm font-semibold text-cream shadow-luxe transition hover:bg-navy-700"
          >
            Book the expedition
          </Link>
        </div>
      </section>
    </>
  );
}
