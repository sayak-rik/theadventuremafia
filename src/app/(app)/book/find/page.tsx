import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FindBookingForm } from "@/components/marketplace/FindBookingForm";

export const metadata: Metadata = { title: "Find my booking", robots: { index: false, follow: false } };

export default function FindBookingPage() {
  return (
    <div className="min-h-screen bg-[#f4f5f1]">
      <header className="border-b border-white/10 bg-navy">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="The Adventure Mafia home"><Logo /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-3xl font-bold text-navy">Find my booking</h1>
        <p className="mt-2 leading-relaxed text-navy/75">Lost your booking link? Enter your booking code and the mobile number you booked with, and we'll email the link to the address on the booking.</p>
        <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm sm:p-6"><FindBookingForm /></div>
      </main>
    </div>
  );
}
