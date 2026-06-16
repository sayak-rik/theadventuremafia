import type { Metadata } from "next";
import { getBikeModels } from "@/lib/data";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { PricingTable } from "@/components/PricingTable";
import { INCLUSIONS, EXCLUSIONS } from "@/data/inclusions";

export const metadata: Metadata = {
  title: "Pricing & Bikes",
  alternates: { canonical: "/pricing" },
  description:
    "Choose from five Royal Enfield models for the West Sikkim expedition. Transparent India and international (USD) pricing, plus full inclusions and exclusions.",
};

// Prices come from Postgres (bike_models). Falls back to seed data if the DB
// is unreachable so the page always renders.
export default async function PricingPage() {
  const bikes = await getBikeModels();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <SectionHeading
        center
        eyebrow="Pricing"
        title="Pick your machine"
        subtitle="Five Royal Enfields, all expedition-prepped. Prices are per rider for the full 7-day tour, inclusive of guide, support vehicle, permits and stays."
      />

      <div className="mt-12">
        <PricingTable bikes={bikes} />
      </div>

      {/* Inclusions / Exclusions */}
      <div className="mt-16">
        <SectionHeading
          center
          eyebrow="The fine print"
          title="What's included — and what's not"
          subtitle="Full transparency on exactly what your tour fare covers."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-green/30 bg-white p-7 shadow-sm">
              <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-navy">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green text-sm text-white" aria-hidden>✓</span>
                Included in the tour
              </h3>
              <ul className="mt-5 space-y-3">
                {INCLUSIONS.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-navy/80">
                    <span className="mt-0.5 shrink-0 text-green-600" aria-hidden>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-2xl border border-navy/15 bg-cream p-7 shadow-sm">
              <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-navy">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-sm text-cream" aria-hidden>×</span>
                Not included in the tour
              </h3>
              <ul className="mt-5 space-y-3">
                {EXCLUSIONS.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-navy/70">
                    <span className="mt-0.5 shrink-0 text-navy/40" aria-hidden>×</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
