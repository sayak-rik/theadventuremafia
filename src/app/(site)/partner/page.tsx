import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "List your rentals or trips",
  description:
    "Get your bikes, scooties, rafting and paragliding slots booked online in Pelling — and paid straight to your own UPI. No commission.",
  alternates: { canonical: "/partner" },
};

const STEPS = [
  { title: "Sign up and tell us about your business", body: "We'll call to verify you before you go live. It's quick." },
  { title: "Add what you offer", body: "Vehicles with how many you have, or sessions with time slots and seats. Add photos and your UPI ID." },
  { title: "Customers book and pay you the advance", body: "They pick a date, pay your advance by UPI, and send us the reference number." },
  { title: "Confirm in one tap", body: "Check your UPI app, tap confirm. The rest is paid at pickup or at the start of the trip." },
];

const CONTROLS = [
  ["Your prices", "Set the price per day or per person, and change it any time."],
  ["Your advance", "Ask for a percentage or a fixed amount up front. You decide."],
  ["Your dates", "Block days for servicing, bad weather or off-season in a few taps."],
  ["Your money", "Customers pay your UPI or QR directly. We never hold or touch it."],
];

const FAQ = [
  ["Do you take a commission?", "No. Founding operators in Pelling join free. After that it's one flat monthly fee — never a percentage of your bookings."],
  ["Who holds the advance and the deposit?", "You do. The advance goes straight to your UPI. Any balance and security deposit are collected by you in person."],
  ["How do I get approved?", "After you sign up we check your business details and usually call you. Each listing is reviewed once before it goes live."],
  ["What if the weather cancels a rafting or paragliding slot?", "Block the slot and the affected customers are flagged so you can move them to another day or refund them."],
  ["I don't have a UPI ID, only a QR.", "You can upload your own QR image instead. Customers will scan it and pay the amount shown."],
];

export default function PartnerPage() {
  return (
    <>
      <section className="bg-navy text-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div>
            <h1 className="font-serif text-4xl font-bold leading-[1.1] sm:text-5xl">
              Get your bikes and trips booked online, and paid straight to your UPI
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/80">
              List your rental fleet or your rafting and paragliding slots on {SITE.name}. Customers choose a date, pay a small
              advance to you directly, and you confirm in one tap.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link href="/partner/signup">List your business</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-cream/30 bg-transparent text-cream hover:border-cream/60 hover:bg-white/5">
                <Link href="/dashboard/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-cream/60">Pelling first. Bike and scooty rentals, river rafting, paragliding.</p>
          </div>

          {/* A faithful mock of what an operator sees on their phone. */}
          <div aria-hidden className="mx-auto w-full max-w-[320px] rounded-[2rem] border border-white/15 bg-navy-800 p-3 shadow-luxe">
            <div className="rounded-[1.5rem] bg-[#f4f5f1] p-4 text-navy">
              <p className="text-sm font-semibold">Needs your action</p>
              <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold">Pema Lhamo</p>
                  <p className="text-xs text-navy/60 tabular-nums">BK-7K3Q9X</p>
                </div>
                <p className="mt-1 text-sm text-navy/80">2 × Honda Activa 6G</p>
                <p className="text-sm text-navy/80">Sat 18 Oct, pickup 8:00</p>
                <dl className="mt-3 grid grid-cols-2 gap-y-1 border-t border-navy/10 pt-3 text-sm">
                  <dt className="text-navy/60">Advance sent</dt><dd className="text-right font-semibold tabular-nums">₹480</dd>
                  <dt className="text-navy/60">UPI ref</dt><dd className="text-right font-mono text-[13px] tabular-nums">328177460912</dd>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <span className="rounded-lg bg-green py-2.5 text-center text-sm font-semibold">Confirm</span>
                  <span className="rounded-lg border border-navy/20 py-2.5 text-center text-sm font-semibold">Not received</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-green" /> 3 scooties free tomorrow</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="font-serif text-3xl font-bold">How it works</h2>
        <ol className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy font-semibold text-cream tabular-nums">{i + 1}</span>
              <div>
                <h3 className="font-semibold text-navy">{s.title}</h3>
                <p className="mt-1 leading-relaxed text-navy/75">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-navy/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[0.8fr_1.2fr] md:py-20">
          <div>
            <h2 className="font-serif text-3xl font-bold">You stay in charge</h2>
            <p className="mt-4 max-w-sm leading-relaxed text-navy/75">
              Founding operators in Pelling join free. After that it's one flat monthly fee — never a cut of your bookings.
            </p>
          </div>
          <dl className="divide-y divide-navy/10">
            {CONTROLS.map(([t, d]) => (
              <div key={t} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-semibold">{t}</dt>
                <dd className="text-navy/75">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="font-serif text-3xl font-bold">Questions operators ask</h2>
        <div className="mt-8 divide-y divide-navy/10 border-y border-navy/10">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="flex items-start justify-between gap-4">{q}<span aria-hidden className="mt-0.5 text-navy/50 transition group-open:rotate-45">+</span></span>
              </summary>
              <p className="mt-3 leading-relaxed text-navy/75">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Button asChild size="lg"><Link href="/partner/signup">List your business</Link></Button>
          <p className="text-sm text-navy/70">Questions first? Call {SITE.phone}.</p>
        </div>
      </section>
    </>
  );
}
