import type { Metadata } from "next";
import Link from "next/link";
import { ITINERARY } from "@/data/itinerary";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { RouteMap } from "@/components/RouteMap";
import { ContactForm } from "@/components/ContactForm";
import { SITE } from "@/data/site";

const waLink = `https://wa.me/${SITE.whatsapp.replace(/[^\d]/g, "")}`;

export const metadata: Metadata = {
  title: "Itinerary",
  alternates: { canonical: "/itinerary" },
  description:
    "Day-by-day plan for the 7-day Untouched West Sikkim Expedition: NJP to Pelling, Dentam, Yuksom, Ravangla, Gangtok, Lachen, Gurudongmar Lake and Lachung — with distances and drive times.",
};

export default function ItineraryPage() {
  return (
    <>
      <section className="bg-navy py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            light
            eyebrow="7-Day Plan"
            title="The day-by-day expedition"
            subtitle="Distances and drive times are approximate — mountain roads, weather and permit checkpoints all shift the clock. Every day ends at a curated stay."
          />
          <div className="mt-12">
            <RouteMap />
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <ol className="relative border-l-2 border-green/30">
          {ITINERARY.map((d, i) => (
            <li key={d.day} className="relative ml-6 pb-12 last:pb-0">
              {/* node */}
              <span className="absolute -left-[2.1rem] flex h-9 w-9 items-center justify-center rounded-full bg-green font-serif text-sm font-bold text-white ring-4 ring-cream">
                {d.day}
              </span>
              <Reveal>
                <article className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-600">
                    Day {d.day}
                  </p>
                  <h3 className="mt-1 font-serif text-2xl font-bold text-navy">{d.title}</h3>
                  <p className="mt-1 text-sm text-navy/60">{d.route}</p>

                  <dl className="mt-5 grid grid-cols-3 gap-4 rounded-xl bg-cream px-4 py-3 text-center">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-navy/50">Distance</dt>
                      <dd className="mt-0.5 text-sm font-bold text-navy">{d.distanceKm} km</dd>
                    </div>
                    <div className="border-x border-navy/10">
                      <dt className="text-[10px] uppercase tracking-wide text-navy/50">Drive time</dt>
                      <dd className="mt-0.5 text-sm font-bold text-navy">{d.driveTime}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-navy/50">Overnight</dt>
                      <dd className="mt-0.5 text-sm font-bold text-navy">{d.stay}</dd>
                    </div>
                  </dl>

                  <ul className="mt-5 space-y-2">
                    {d.highlights.map((h) => (
                      <li key={h} className="flex gap-2 text-sm text-navy/80">
                        <span className="mt-1 text-green-600" aria-hidden="true">▸</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl bg-navy p-8 text-center">
          <h2 className="font-serif text-2xl font-bold text-cream">Ready to ride it?</h2>
          <p className="mt-2 text-cream/70">Pick a Sunday departure and your Royal Enfield.</p>
          <Link
            href="/booking"
            className="mt-5 inline-block rounded-full bg-green px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-green-600"
          >
            Book now
          </Link>
        </div>
      </section>

      {/* Made it to the end of the route — invite a no-obligation enquiry. */}
      <section className="border-t border-navy/10 bg-cream">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <Reveal className="text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-green-600">
              Free to enquire
            </p>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-navy sm:text-4xl">
              It costs nothing to ask. <span className="text-green-600">The memories last a lifetime.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-navy/70">
              You&rsquo;ve seen every turn of the route — now let&rsquo;s make it yours. Send us a note and our
              crew will help you plan. No payment, no obligation, just honest answers.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
            <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm sm:p-8">
              <ContactForm />
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl bg-navy p-6 text-cream">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">Prefer to talk?</p>
                <ul className="mt-4 space-y-3 text-sm">
                  <li>
                    <a href={`tel:${SITE.phone.replace(/\s/g, "")}`} className="hover:text-green-300">
                      📞 {SITE.phone}
                    </a>
                  </li>
                  <li>
                    <a href={waLink} target="_blank" rel="noopener noreferrer" className="hover:text-green-300">
                      💬 WhatsApp (same number)
                    </a>
                  </li>
                  <li>
                    <a href={`mailto:${SITE.email}`} className="hover:text-green-300">
                      ✉️ {SITE.email}
                    </a>
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl border border-gold/30 bg-white p-6 text-sm text-navy/75">
                <p className="font-semibold text-navy">Limited spots. Every Sunday.</p>
                <p className="mt-2">20 motorbikes and 10 shared-cab seats per departure, Sep–May. Early enquiries get the best dates.</p>
              </div>
            </aside>
          </Reveal>
        </div>
      </section>
    </>
  );
}
