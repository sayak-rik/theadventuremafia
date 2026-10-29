import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { BookingStatusView } from "@/components/marketplace/BookingStatusView";
import { getBookingForCustomer } from "@/lib/booking/queries";
import { buildUpiUri, upiQrSvg } from "@/lib/upi";

// A private page: the URL is the credential, so keep it out of search engines and out of Referer headers.
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const booking = await getBookingForCustomer(token);
  if (!booking) notFound();

  let upiUri: string | null = null;
  let qrSvg: string | null = null;
  if (booking.status === "pending_payment" && booking.payTo?.upiVpa) {
    upiUri = buildUpiUri({ vpa: booking.payTo.upiVpa, payeeName: booking.payTo.payeeName, amount: booking.advance, note: booking.code });
    qrSvg = await upiQrSvg(upiUri);
  }

  return (
    <div className="min-h-screen bg-[#f4f5f1]">
      <header className="border-b border-white/10 bg-navy">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="The Adventure Mafia home"><Logo /></Link>
          <Link href="/" className="text-sm font-medium text-cream/70 hover:text-cream">Back to the site</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 pb-16 sm:py-10">
        <BookingStatusView key={booking.status} initial={booking} token={token} qrSvg={qrSvg} upiUri={upiUri} />
      </main>
    </div>
  );
}
