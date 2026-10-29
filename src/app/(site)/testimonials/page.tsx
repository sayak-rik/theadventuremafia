import type { Metadata } from "next";
import Link from "next/link";
import { getTestimonials } from "@/lib/data";
import { SectionHeading } from "@/components/SectionHeading";
import { TestimonialColumns } from "@/components/TestimonialColumns";

export const metadata: Metadata = {
  title: "Testimonials",
  alternates: { canonical: "/testimonials" },
  description:
    "Stories from riders who took the Untouched West Sikkim Expedition — Kanchenjunga views, Gurudongmar Lake and seamless luxury support.",
};

export default async function TestimonialsPage() {
  const testimonials = await getTestimonials();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <SectionHeading
        center
        eyebrow="Rider Stories"
        title="What it feels like out there"
        subtitle="Unfiltered words from the saddle."
      />
      <div className="mt-12">
        <TestimonialColumns testimonials={testimonials} />
      </div>
      <p className="mt-6 text-center text-xs text-navy/40">Hover to pause · {testimonials.length} verified riders</p>

      <div className="mt-12 text-center">
        <Link
          href="/booking"
          className="inline-block rounded-full bg-green px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-green-600"
        >
          Write your own story — book now
        </Link>
      </div>
    </section>
  );
}
