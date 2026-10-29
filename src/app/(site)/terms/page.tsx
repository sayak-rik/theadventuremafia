import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  alternates: { canonical: "/terms" },
  description:
    "How bookings work on The Adventure Mafia: you pay the operator directly, who runs your rental, rafting or paragliding trip, plus the terms of our own West Sikkim Expedition.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="17 October 2026">
      <p>
        These terms cover two things: <a className="text-green-600 underline" href="#marketplace">bookings you make with
        independent operators through this site</a> (bike and scooty rentals, river rafting, paragliding), and{" "}
        <a className="text-green-600 underline" href="#expedition">our own West Sikkim Expedition</a>. By booking you
        agree to the terms that apply to what you booked.
      </p>

      <h2 id="marketplace">Part A — Booking with an operator</h2>

      <h2>1. Who does what</h2>
      <p>
        {SITE.name} is a booking platform. The rental shops, rafting teams and paragliding pilots listed here are
        independent businesses. <strong>Your booking is a contract between you and the operator.</strong> The operator
        provides the vehicle or the activity, its guides, pilots and equipment, and is responsible for its
        permits, insurance and safety. We do not own, run, inspect or insure any operator&apos;s vehicles or equipment.
      </p>
      <p>
        A &quot;Mafia Verified&quot; badge means we have checked the operator&apos;s identity and contact details and
        spoken to them. It is not a safety certification, and it does not mean we have inspected their vehicles or
        equipment.
      </p>

      <h2>2. How payment works</h2>
      <ul>
        <li>
          When you book, we hold your date or slot for <strong>30 minutes</strong> while you pay the advance.
        </li>
        <li>
          You pay the advance <strong>directly to the operator</strong> by UPI, to the account shown on your booking
          page. {SITE.name} does not receive, hold or transfer your money, and does not charge you a booking fee on
          top of the operator&apos;s price.
        </li>
        <li>
          After you pay, enter the 12-digit UPI reference number. The operator checks it in their own UPI app and
          confirms. <strong>Your booking is confirmed only when the operator confirms it.</strong>
        </li>
        <li>
          Before paying, check that the name shown in your UPI app matches the payee name on your booking page. Pay
          only to the details shown there. We will never ask you to pay to a different number or account.
        </li>
        <li>The balance, and any refundable deposit, is paid to the operator in person.</li>
      </ul>

      <h2>3. If the hold runs out or the operator can&apos;t find your payment</h2>
      <p>
        If you paid after the 30 minutes ended, send the reference on your booking page anyway. The operator can still
        confirm if the date is free; if it is not, they will offer another day or return your money. If an operator
        cannot find your payment, you will be asked to check the reference and try again. Keep your UPI receipt until
        your booking is confirmed.
      </p>

      <h2>4. Cancellations, weather and refunds</h2>
      <ul>
        <li>
          Each listing shows the operator&apos;s cancellation policy, and your booking page repeats it. That policy
          applies to your booking.
        </li>
        <li>
          If the operator cancels, or cannot run the trip because of weather, river or wind conditions, or safety,
          they should refund your advance in full or move your booking to another day that suits you.
        </li>
        <li>
          Refunds are paid by the operator, to the account you paid from. We record the refund status on your booking
          and will help you reach the operator, but we are not able to pay refunds ourselves.
        </li>
        <li>
          If you want to cancel, use the cancel option on your booking page where it is offered, or contact the
          operator.
        </li>
      </ul>

      <h2>5. Bike and scooty rentals</h2>
      <ul>
        <li>Rentals are for a single day. Bring your original driving licence; the operator will check it at pickup.</li>
        <li>
          The operator may ask for a refundable security deposit at pickup. Fuel, kilometre limits, late fees and
          areas you may not ride in are set by the operator and shown on the listing.
        </li>
        <li>
          You are responsible for the vehicle while you have it, including traffic fines and damage, as set out by the
          operator. Wear a helmet and follow local traffic rules.
        </li>
      </ul>

      <h2>6. River rafting and paragliding</h2>
      <ul>
        <li>
          These are adventure sports with real risk of injury. Everyone joining must accept the safety waiver when
          booking and follow the guide&apos;s or pilot&apos;s instructions.
        </li>
        <li>
          Each listing sets minimum and maximum age and weight. Give the true age and weight of every person; the
          operator can refuse anyone who is outside the limits or unfit to take part, and may do so on the day.
        </li>
        <li>
          Do not take part if you are unwell, pregnant, or have a heart, spine or similar condition that makes it
          unsafe. We recommend travel and accident insurance.
        </li>
      </ul>

      <h2>7. Your details</h2>
      <p>
        Give an accurate name, phone number and email. The operator will call or message you about your booking.
        Anyone with the link to your booking page can see your booking, so keep it private.
      </p>

      <h2>8. Our responsibility</h2>
      <p>
        We take care to list only operators we have approved and to show accurate information, but we do not control
        how operators run their trips. To the extent the law allows, {SITE.name} is not liable for the operator&apos;s
        acts or omissions, or for loss, injury or damage during a rental or activity. Nothing in these terms limits
        any right you have under Indian consumer law that cannot be limited by contract.
      </p>

      <h2 id="expedition">Part B — The West Sikkim Expedition (run by us)</h2>
      <p>
        These terms apply to your booking of the Untouched West Sikkim Expedition operated by {SITE.name}. By
        reserving a seat you agree to the conditions below.
      </p>

      <h2>B1. Bookings & departures</h2>
      <p>
        Tours depart on selected Sundays between September and May. A booking request is a request for
        availability; your seat is confirmed only after our team acknowledges it in writing and any
        required deposit is received.
      </p>

      <h2>B2. Permits (Inner Line Permit)</h2>
      <p>
        North Sikkim destinations including Lachen, Lachung and Gurudongmar Lake require valid Sikkim
        Inner Line Permits (ILP) and protected-area permits. You must provide accurate identity documents
        in advance. Permits are subject to government approval and may be withdrawn due to weather, security
        or administrative reasons beyond our control.
      </p>

      <h2>B3. Cancellations & refunds</h2>
      <ul>
        <li>30+ days before departure: full refund less processing charges.</li>
        <li>15–29 days: 50% refund.</li>
        <li>Under 15 days: non-refundable, transferable to another departure subject to availability.</li>
      </ul>
      <p>
        If we cancel a departure, you may choose a full refund or a transfer to a future date.
      </p>

      <h2>B4. Group cancellation by us</h2>
      <p>
        We may cancel an entire group departure when conditions make it unsafe or unviable — including
        adverse weather, bad or blocked roads, landslides, or if the minimum group size is not met
        (a departure requires a <strong>minimum of 6 bikes</strong>). If we cancel a trip for any of these
        reasons, you will receive a <strong>full refund</strong> (or, if you prefer, a transfer to a future
        departure).
      </p>

      <h2>B5. Altitude & health</h2>
      <p>
        Gurudongmar Lake sits above 4,400 m. Altitude sickness is a genuine risk. You confirm you are
        medically fit to ride at high altitude and will follow crew instructions. We strongly recommend
        comprehensive travel and medical insurance.
      </p>

      <h2>B6. Riding & liability</h2>
      <p>
        Riders must hold a valid motorcycle licence and wear provided/approved safety gear at all times.
        You ride at your own risk; {SITE.name} is not liable for injury, loss or damage arising from your
        own negligence, road conditions or events beyond our reasonable control.
      </p>

      <h2>B7. Changes to the itinerary</h2>
      <p>
        Mountain travel is unpredictable. Routes, stays and timings may change for safety, weather or
        permit reasons without reducing the overall value of the experience.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or a problem with a booking? Email <a className="text-green-600 underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        For anything about your rental or trip on the day, contact the operator first — their phone and WhatsApp are on your booking page.
      </p>
    </LegalShell>
  );
}
