import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How The Adventure Mafia collects, uses and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="15 June 2026">
      <p>
        {SITE.name} (&quot;we&quot;) respects your privacy. This policy explains what we collect when you
        enquire or book, and how we use it, in line with the Indian Information Technology Act and the
        Digital Personal Data Protection Act.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>Contact details you submit: name, email, phone.</li>
        <li>Booking preferences: departure date, bike model, riding option, shared-cab choice, messages.</li>
        <li>Permit documents you share with us for North Sikkim travel.</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        We use your data solely to process enquiries and bookings, arrange permits, communicate trip
        details, and — only if you opt in — send occasional updates about future expeditions.
      </p>

      <h2>3. Where it is stored</h2>
      <p>
        Booking records are stored in our own PostgreSQL database hosted on infrastructure we control.
        Transactional emails (booking and enquiry notifications) are delivered through our email provider.
        We do not sell your data.
      </p>

      <h2>4. Retention</h2>
      <p>
        We keep booking records for as long as needed to deliver the service and meet legal obligations,
        after which they are deleted or anonymised.
      </p>

      <h2>5. Your rights</h2>
      <p>
        You can request access to, correction of, or deletion of your personal data at any time by emailing{" "}
        <a className="text-green-600 underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>

      <h2>6. Cookies</h2>
      <p>
        This site uses only essential cookies required for it to function. We do not run third-party
        advertising trackers.
      </p>
    </LegalShell>
  );
}
