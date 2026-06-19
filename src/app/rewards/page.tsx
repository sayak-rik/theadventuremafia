import type { Metadata } from "next";
import { RewardsPanel } from "@/components/RewardsPanel";
import { SectionHeading } from "@/components/SectionHeading";
import { formatINR, SIGNUP_BONUS, REFERRAL_DISCOUNT, DEFAULT_REWARD, REFERRAL_CAP } from "@/lib/rewards";

export const metadata: Metadata = {
  title: "Refer & Earn — Adv Cash Rewards",
  description:
    "Sign up for The Adventure Mafia rewards, get adv cash, and earn more for every friend who books the West Sikkim Expedition.",
  alternates: { canonical: "/rewards" },
};

export default function RewardsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <SectionHeading
        center
        eyebrow="Refer & Earn"
        title="Adv Cash Rewards"
        subtitle={`Sign up for ${formatINR(SIGNUP_BONUS)} free adv cash. Share your code — your friends save ${formatINR(REFERRAL_DISCOUNT)} on their booking, and you earn ${formatINR(DEFAULT_REWARD)} for every trip they confirm.`}
      />

      <div className="mt-10 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm sm:p-8">
        <RewardsPanel />
      </div>

      <div className="mt-8 grid gap-3 text-sm text-navy/70 sm:grid-cols-3">
        <div className="rounded-xl bg-cream p-4"><strong className="text-navy">1. Sign up</strong><br />Verify your email, get {formatINR(SIGNUP_BONUS)}.</div>
        <div className="rounded-xl bg-cream p-4"><strong className="text-navy">2. Share</strong><br />Send your code/link to riders.</div>
        <div className="rounded-xl bg-cream p-4"><strong className="text-navy">3. Earn</strong><br />{formatINR(DEFAULT_REWARD)} per confirmed booking.</div>
      </div>
      <p className="mt-4 text-center text-xs text-navy/40">
        Adv cash reduces your booking total. Maximum {formatINR(REFERRAL_CAP)} in referral earnings per account.
      </p>
    </section>
  );
}
