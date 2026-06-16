import type { Metadata } from "next";
import { getBikeModels } from "@/lib/data";
import { BookingForm } from "@/components/BookingForm";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Book the Expedition",
  alternates: { canonical: "/booking" },
  description:
    "Reserve your seat on the Untouched West Sikkim Expedition. Choose a Sunday departure (Sep–May), your Royal Enfield and riding option.",
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ bike?: string; option?: string; residence?: string }>;
}) {
  const bikes = await getBikeModels();
  const { bike, option, residence } = await searchParams;
  const initialBikeId = bike ? Number(bike) : undefined;
  const initialOption = option === "cab" ? "cab" : "bike";
  const initialResidence = residence === "intl" ? "INTL" : "IN";

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading
        eyebrow="Booking"
        title="Reserve your seat"
        subtitle="Tours depart every Sunday from September through May, with just 20 motorbikes and 10 shared-cab seats per departure. Tell us your plans and we'll confirm within 24 hours."
      />
      <div className="mt-8 rounded-2xl border border-gold/30 bg-cream px-5 py-4 text-sm text-navy/75">
        <span className="font-semibold text-navy">Fully refundable group cancellation.</span>{" "}
        A departure needs a minimum of 6 bikes to run. If we ever cancel a trip for weather, bad roads,
        landslides or insufficient group size, you get a full refund.
      </div>
      <div className="mt-8">
        <BookingForm bikes={bikes} initialBikeId={initialBikeId} initialOption={initialOption} initialResidence={initialResidence} />
      </div>
    </section>
  );
}
