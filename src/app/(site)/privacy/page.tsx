import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
  description: "What The Adventure Mafia collects when you book, who it is shared with (the operator you book), and how long we keep it.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="17 October 2026">
      <p>
        {SITE.name} (&quot;we&quot;) respects your privacy. This policy explains what we collect when you enquire or
        book, who sees it, and how long we keep it, in line with the Indian Information Technology Act and the
        Digital Personal Data Protection Act.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>When you book with an operator:</strong> your name, phone number and email, the date and slot you
          chose, how many vehicles or people, and the UPI reference number and payer name you enter after paying.
        </li>
        <li>
          <strong>For rafting and paragliding:</strong> the name, age and weight of each person joining, and that
          they accepted the safety waiver. We collect age and weight because operators set safety limits on them.
        </li>
        <li>
          <strong>When an operator signs up:</strong> the business name, owner name, phone, email, address, the
          activities and areas they cover, photos they upload, and the UPI ID, UPI number or QR image they use to take
          payments. Their UPI details are shown to customers who book with them.
        </li>
        <li>
          <strong>For our own expedition:</strong> the contact details and booking preferences you submit, and the
          permit documents you share for North Sikkim travel.
        </li>
        <li>
          <strong>For abuse prevention:</strong> a one-way scrambled version of your IP address (we cannot turn it
          back into your address) so one person can&apos;t hold dozens of bookings.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> collect card numbers, bank logins, UPI PINs or driving licence numbers. Payments go
        straight from you to the operator; we never see your payment credentials.
      </p>

      <h2>2. Who sees it</h2>
      <p>
        <strong>The operator you book with</strong> receives your name, phone, email, booking details and, for
        sessions, the participants&apos; names, ages and weights. They need these to run your trip, keep you safe and
        contact you. Operators agree to use this information only for your booking. We do not give your details to
        other operators and we do not sell your data.
      </p>
      <p>
        We also use an email provider to send booking emails, and the platform&apos;s administrators can see bookings
        to resolve problems. Anyone who has the private link to your booking page can see that booking, so don&apos;t
        share it.
      </p>

      <h2>3. How we use it</h2>
      <p>
        To process your booking, tell you its status, let the operator reach you, resolve disputes, keep the platform
        secure, and — only if you opt in — send occasional updates. We do not run advertising trackers.
      </p>

      <h2>4. Where it is stored</h2>
      <p>
        Booking records are stored in our own PostgreSQL database on infrastructure we control. Operator photos are
        stored on our server or in Cloudflare R2, with location data removed before saving.
      </p>

      <h2>5. How long we keep it</h2>
      <ul>
        <li>
          <strong>Age and weight</strong> of participants are removed automatically 90 days after a booking ends.
        </li>
        <li>
          Other booking records (name, contact, amounts, status) are kept as long as needed to resolve disputes and
          meet legal and accounting duties, then deleted or anonymised.
        </li>
        <li>Spent one-time codes and short-term security counters are deleted within a day.</li>
      </ul>

      <h2>6. Your rights</h2>
      <p>
        You can ask to see, correct or delete your personal data, or withdraw consent, at any time by emailing{" "}
        <a className="text-green-600 underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>. Because the operator
        you booked with also holds your booking details, we will pass the request on to them where it affects what
        they hold.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use only the essential cookies needed to keep operators and administrators signed in. Customers booking as
        guests don&apos;t need an account. We do not use third-party advertising or analytics cookies.
      </p>
    </LegalShell>
  );
}
