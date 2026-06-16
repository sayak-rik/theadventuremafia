import { FAQS } from "@/data/faq";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

// Accessible, no-JS FAQ accordion using <details>. Content is server-rendered
// (good for SEO) and paired with FAQPage JSON-LD on the page.
export function FaqSection() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <SectionHeading
        center
        eyebrow="Good to know"
        title="Frequently asked questions"
        subtitle="Permits, altitude, bikes and booking — answered."
      />
      <div className="mt-10 space-y-3">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={(i % 3) * 0.06}>
            <details className="group rounded-2xl border border-navy/10 bg-white p-5 shadow-sm [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between gap-4 font-serif text-lg font-bold text-navy marker:content-['']">
                {f.q}
                <span className="shrink-0 text-green-600 transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-navy/75">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
