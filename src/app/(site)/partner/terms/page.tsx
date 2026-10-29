import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { PARTNER_TERMS_VERSION } from "@/lib/operators/constants";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Partner terms",
  description: "The terms for operators listing on The Adventure Mafia.",
  alternates: { canonical: "/partner/terms" },
};

// NOTE: plain-language working draft — have counsel review before real
// operators sign (marketplace obligations, DPDP, GST on the platform fee).
export default function PartnerTermsPage() {
  return (
    <LegalShell title="Partner terms" updated={`Version ${PARTNER_TERMS_VERSION}`}>
      <h2>1. What we do</h2>
      <p>
        {SITE.name} is an online platform that lists activities and rentals offered by independent operators and lets customers
        reserve them. We are a technology intermediary. The contract for any booking is between the customer and you.
      </p>

      <h2>2. Payments go directly to you</h2>
      <p>
        Customers pay the advance straight to the UPI ID, UPI number or QR code you provide. We never receive, hold or handle
        customer money, advances or security deposits. You are responsible for checking that a payment has reached your account
        before you confirm a booking, and for collecting any balance and deposit yourself.
      </p>

      <h2>3. Your responsibilities</h2>
      <ul>
        <li>Provide accurate details about your business, vehicles, trips, prices, capacity and availability.</li>
        <li>Hold every licence, permit, registration and insurance that the law requires for what you offer, and keep them valid.</li>
        <li>Keep vehicles and equipment roadworthy, safe and clean, and provide required safety gear.</li>
        <li>For rafting and paragliding: use certified and experienced guides and pilots, follow safety limits (weight, age, weather), and obtain customers' waivers.</li>
        <li>Check each customer's original driving licence and photo ID before handing over a vehicle.</li>
        <li>Honour confirmed bookings, or refund or reschedule fairly if you cannot, including when weather stops a trip.</li>
        <li>Refund customers according to the cancellation policy shown on your listing.</li>
      </ul>

      <h2>4. Approval and listings</h2>
      <p>
        We review each operator before it can go live and each listing before it is published. We may ask for changes, decline,
        pause or remove an operator or listing at any time, for example after safety or honesty concerns or complaints.
      </p>

      <h2>5. Customer information</h2>
      <p>
        You receive customers' names and contact details only to fulfil their booking. Do not use them for anything else and do
        not share them. We do not ask you to store driving licence numbers on the platform.
      </p>

      <h2>6. Fees</h2>
      <p>
        We do not charge commission on your bookings. Founding operators join free for an introductory period. After that a flat
        monthly fee applies, which we will tell you about in advance. The fee is invoiced separately and is not taken from customer payments.
      </p>

      <h2>7. Liability</h2>
      <p>
        You are solely responsible for the services you provide and for the safety of your customers. To the extent the law allows,
        {" "}{SITE.name} is not liable for injury, loss or damage arising from an activity or rental, or for payments made between
        customers and you.
      </p>

      <h2>8. Ending this agreement</h2>
      <p>You can stop at any time by pausing your listings and telling us. We can suspend or end your account if you break these terms.</p>

      <h2>9. Contact</h2>
      <p>Questions? Email {SITE.email} or call {SITE.phone}.</p>
    </LegalShell>
  );
}
