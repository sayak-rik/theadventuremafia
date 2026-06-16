import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  alternates: { canonical: "/terms" },
  description: "Booking, cancellation, permit and liability terms for The Adventure Mafia's West Sikkim Expedition.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="15 June 2026">
      <p>
        These terms govern your booking of the Untouched West Sikkim Expedition operated by {SITE.name}.
        By reserving a seat you agree to the conditions below.
      </p>

      <h2>1. Bookings & departures</h2>
      <p>
        Tours depart on selected Sundays between September and May. A booking request is a request for
        availability; your seat is confirmed only after our team acknowledges it in writing and any
        required deposit is received.
      </p>

      <h2>2. Permits (Inner Line Permit)</h2>
      <p>
        North Sikkim destinations including Lachen, Lachung and Gurudongmar Lake require valid Sikkim
        Inner Line Permits (ILP) and protected-area permits. You must provide accurate identity documents
        in advance. Permits are subject to government approval and may be withdrawn due to weather, security
        or administrative reasons beyond our control.
      </p>

      <h2>3. Cancellations & refunds</h2>
      <ul>
        <li>30+ days before departure: full refund less processing charges.</li>
        <li>15–29 days: 50% refund.</li>
        <li>Under 15 days: non-refundable, transferable to another departure subject to availability.</li>
      </ul>
      <p>
        If we cancel a departure, you may choose a full refund or a transfer to a future date.
      </p>

      <h2>4. Group cancellation by us</h2>
      <p>
        We may cancel an entire group departure when conditions make it unsafe or unviable — including
        adverse weather, bad or blocked roads, landslides, or if the minimum group size is not met
        (a departure requires a <strong>minimum of 6 bikes</strong>). If we cancel a trip for any of these
        reasons, you will receive a <strong>full refund</strong> (or, if you prefer, a transfer to a future
        departure).
      </p>

      <h2>5. Altitude & health</h2>
      <p>
        Gurudongmar Lake sits above 4,400 m. Altitude sickness is a genuine risk. You confirm you are
        medically fit to ride at high altitude and will follow crew instructions. We strongly recommend
        comprehensive travel and medical insurance.
      </p>

      <h2>6. Riding & liability</h2>
      <p>
        Riders must hold a valid motorcycle licence and wear provided/approved safety gear at all times.
        You ride at your own risk; {SITE.name} is not liable for injury, loss or damage arising from your
        own negligence, road conditions or events beyond our reasonable control.
      </p>

      <h2>7. Changes to the itinerary</h2>
      <p>
        Mountain travel is unpredictable. Routes, stays and timings may change for safety, weather or
        permit reasons without reducing the overall value of the experience.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions? Email <a className="text-green-600 underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    </LegalShell>
  );
}
