import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/partner/LoginForm";
import { Logo } from "@/components/Logo";
import { getOperatorSession } from "@/lib/operator-auth";

export const metadata: Metadata = { title: "Operator sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OperatorLoginPage() {
  if (await getOperatorSession()) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-[#f4f5f1]">
      <header className="border-b border-white/10 bg-navy">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="The Adventure Mafia home"><Logo /></Link>
          <Link href="/partner" className="text-sm font-medium text-cream/70 hover:text-cream">About listing with us</Link>
        </div>
      </header>
      <main className="flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-navy/10 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="font-serif text-2xl font-bold text-navy">Operator sign in</h1>
        <p className="mb-6 mt-1 text-sm text-navy/70">Manage your listings, payments and bookings.</p>
        <LoginForm />
      </div>
      </main>
    </div>
  );
}
