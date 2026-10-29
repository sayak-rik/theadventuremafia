import type { Metadata } from "next";
import { SignupForm } from "@/components/partner/SignupForm";
import { getLaunchCategories, getRegions } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "List your business",
  description: "Create an operator account to list your rentals, rafting or paragliding.",
  alternates: { canonical: "/partner/signup" },
};

export const dynamic = "force-dynamic";

export default async function PartnerSignupPage() {
  const [categories, regions] = await Promise.all([getLaunchCategories(), getRegions()]);
  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6 md:py-16">
      <h1 className="font-serif text-3xl font-bold sm:text-4xl">List your business</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-navy/75">
        Takes about three minutes. We verify every operator before listings go live, so expect a call from us.
      </p>
      <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm sm:p-8">
        <SignupForm categories={categories} regions={regions} />
      </div>
    </section>
  );
}
