import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { SectionHeading } from "@/components/SectionHeading";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about the West Sikkim Expedition? Reach The Adventure Mafia crew — we reply within a working day.",
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <SectionHeading
        eyebrow="Get in touch"
        title="Talk to the crew"
        subtitle="Group bookings, custom dates, gear questions — drop us a line and we'll get back within one working day."
      />
      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-navy/10 bg-cream p-6 sm:p-8">
          <ContactForm />
        </div>
        <aside className="space-y-6">
          <div className="rounded-2xl bg-navy p-6 text-cream">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">Direct</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><a href={`mailto:${SITE.email}`} className="hover:text-green-300">{SITE.email}</a></li>
              <li><a href={`tel:${SITE.phone.replace(/\s/g, "")}`} className="hover:text-green-300">{SITE.phone}</a></li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gold/30 bg-white p-6 text-sm text-navy/75">
            <p className="font-semibold text-navy">Departures</p>
            <p className="mt-2">Every Sunday, September through May. Just 20 motorbikes (plus 10 shared-cab seats) per departure — early enquiries get the best dates.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
