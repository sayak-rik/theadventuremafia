import { PaymentSettingsForm } from "@/components/dashboard/PaymentSettingsForm";
import { requireOperatorPage } from "@/lib/operator-auth";
import { getPaymentSettings } from "@/lib/operators/account";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const session = await requireOperatorPage();
  const settings = await getPaymentSettings(session.companyId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy">Payments</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-navy/75">
          Customers pay your advance straight to you — The Adventure Mafia never receives or holds the money. After they pay, they send us the
          12-digit UPI reference, and you confirm once you see it in your UPI app. Balance and security deposit are collected in person.
        </p>
      </div>
      <PaymentSettingsForm initial={settings} companyName={session.companyName} />
    </div>
  );
}
