import Link from "next/link";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { RouteMap } from "@/components/RouteMap";
import { Marquee } from "@/components/Marquee";
import { TestimonialCard } from "@/components/TestimonialCard";
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
      <Hero />

      {/* Overview */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="The Expedition"
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
