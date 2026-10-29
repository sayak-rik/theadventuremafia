import type { Metadata } from "next";
import Link from "next/link";
import { getBikeModels } from "@/lib/data";
import { BookingForm } from "@/components/BookingForm";
import { SectionHeading } from "@/components/SectionHeading";
import { Reveal } from "@/components/Reveal";
import { EXPERIENCES } from "@/data/experiences";
import { formatINR } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Book an Adventure",
  alternates: { canonical: "/booking" },
  description:
    "Book your Adventure Mafia experience — the 7-day West Sikkim motorcycle expedition, or a guided day trek around Pelling or Yuksom.",
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ bike?: string; option?: string; residence?: string; ref?: string }>;
}) {
  const bikes = await getBikeModels();
  const { bike, option, residence, ref } = await searchParams;
  const initialBikeId = bike ? Number(bike) : undefined;
  const initialOption = option === "cab" ? "cab" : "bike";
  const initialResidence = residence === "intl" ? "INTL" : "IN";
  const initialRef = ref?.trim() || "";

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading
        eyebrow="Booking"
        title="Choose your adventure"
        subtitle="Reserve the 7-day motorcycle expedition below, or pick a guided day trek to book your spot."
      />

      {/* Adventure chooser */}
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {EXPERIENCES.map((exp, i) => {
          const isExpedition = exp.kind === "expedition";
          const href = isExpedition ? "#expedition" : `${exp.href}#book`;
          return (
            <Reveal key={exp.href} delay={i * 0.08}>
              <Link
                href={href}
                className="group flex h-full flex-col justify-between rounded-2xl border border-navy/10 bg-white p-6 shadow-sm transition hover:border-green/40 hover:shadow-luxe"
              >
                <div>
                  {exp.badge && (
                    <span className="rounded-full bg-green/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-green-600">
                      {exp.badge}
                    </span>
                  )}
                  <h2 className="mt-4 font-serif text-xl font-bold text-navy">{exp.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-navy/70">{exp.blurb}</p>
                </div>
                <div className="mt-5 flex items-baseline justify-between border-t border-navy/10 pt-4">
                  <span className="text-sm text-navy/60">
                    from{" "}
                    <span className="font-serif text-lg font-bold text-navy">{formatINR(exp.priceFrom)}</span>{" "}
                    {exp.priceUnit}
                    {exp.priceSuffix ? ` ${exp.priceSuffix}` : ""}
                  </span>
                  <span className="text-sm font-semibold text-green-600 transition group-hover:translate-x-0.5">
                    {isExpedition ? "Book ↓" : "Book →"}
                  </span>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>

      {/* Expedition booking */}
      <div id="expedition" className="mt-16 scroll-mt-24">
        <SectionHeading
          eyebrow="Motorcycle Expedition"
          title="Reserve your seat"
          subtitle="Tours depart every Sunday from September through May, with just 20 motorbikes and 10 shared-cab seats per departure. Tell us your plans and we'll confirm within 24 hours."
        />
        <div className="mt-8 rounded-2xl border border-gold/30 bg-cream px-5 py-4 text-sm text-navy/75">
          <span className="font-semibold text-navy">Fully refundable group cancellation.</span>{" "}
          A departure needs a minimum of 6 bikes to run. If we ever cancel a trip for weather, bad roads,
          landslides or insufficient group size, you get a full refund.
        </div>
        <div className="mt-8">
          <BookingForm bikes={bikes} initialBikeId={initialBikeId} initialOption={initialOption} initialResidence={initialResidence} initialRef={initialRef} />
        </div>
      </div>
    </section>
  );
}
