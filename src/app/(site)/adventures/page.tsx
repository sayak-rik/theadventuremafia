import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { JsonLd } from "@/components/JsonLd";
import { EXPERIENCES } from "@/data/experiences";
import { formatINR } from "@/lib/pricing";
import { SITE } from "@/data/site";

const DESC =
  "Every Adventure Mafia experience in West & North Sikkim — the 7-day guided motorcycle expedition to Gurudongmar Lake, the Rani Dhunga day trek and the Yuksom day hike.";

export const metadata: Metadata = {
  title: "Adventures",
  description: DESC,
  alternates: { canonical: "/adventures" },
  keywords: [
    "Sikkim adventures",
    "West Sikkim tours",
    "Sikkim treks and day hikes",
    "Sikkim motorcycle expedition",
    "Rani Dhunga day trek",
    "Yuksom day hike",
  ],
  openGraph: {
    type: "website",
    url: "/adventures",
    title: "Adventures · The Adventure Mafia",
    description: DESC,
  },
  twitter: { card: "summary_large_image", title: "Adventures · The Adventure Mafia", description: DESC },
};

export default function AdventuresPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: EXPERIENCES.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.title,
      url: `${SITE.url}${e.href}`,
    })),
  };

  return (
    <>
      <JsonLd data={[itemList]} />
      <section className="bg-navy py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            light
            eyebrow="Our Adventures"
            title="Choose your Himalayan adventure"
            subtitle="A flagship motorcycle expedition and a growing line-up of guided day treks across West & North Sikkim — all run with local crews."
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
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
                  <h2 className="font-serif text-xl font-bold text-navy">{exp.title}</h2>
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
    </>
  );
}
