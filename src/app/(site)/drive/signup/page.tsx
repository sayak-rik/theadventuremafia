import type { Metadata } from "next";
import { SignupForm } from "@/components/partner/SignupForm";
import { getRegions } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Drive with us",
  description: "List your car for Sikkim routes — standardized runs like Siliguri to Pelling, or your own custom route.",
  alternates: { canonical: "/drive/signup" },
};

export const dynamic = "force-dynamic";

export default async function DriveSignupPage() {
  const regions = await getRegions();
  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6 md:py-16">
      <h1 className="font-serif text-3xl font-bold sm:text-4xl">Drive with us</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-navy/75">
        List your car for a standardized route (like Siliguri to Pelling) or your own custom route. Takes about three minutes. We verify every driver before listings go live.
      </p>
      <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm sm:p-8">
        <SignupForm categories={[]} regions={regions} companyType="driver" />
      </div>
    </section>
  );
}
