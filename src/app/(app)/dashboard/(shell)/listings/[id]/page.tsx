import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/dashboard/ListingForm";
import { VehicleListingForm } from "@/components/dashboard/VehicleListingForm";
import { ImageManager } from "@/components/dashboard/ImageManager";
import { SubmitPanel } from "@/components/dashboard/SubmitPanel";
import { BlackoutManager } from "@/components/dashboard/BlackoutManager";
import { listBlackouts } from "@/lib/booking/blackouts";
import { todayIST } from "@/lib/dates";
import { HttpError } from "@/lib/api";
import { requireOperatorPage } from "@/lib/operator-auth";
import { forCompany } from "@/lib/listings/repo";
import { getPaymentSettings } from "@/lib/operators/account";
import { getRegions, getRouteCatalog } from "@/lib/taxonomy";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const session = await requireOperatorPage();
  const { id } = await params;
  const { created } = await searchParams;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) notFound();

  let detail;
  try {
    detail = await forCompany(session.companyId).get(listingId);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
  const [regions, payment, blackouts] = await Promise.all([getRegions(), getPaymentSettings(session.companyId), listBlackouts(session.companyId, listingId)]);
  const hasPayment = Boolean(payment && (payment.upiVpa || payment.upiNumber || payment.qrImageUrl));
  const slotCount = detail.form.kind === "session" ? detail.form.slots.length : 1;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/listings" className="text-sm font-medium text-navy/60 hover:underline">Back to listings</Link>
        <h1 className="mt-1 font-serif text-3xl font-bold text-navy">{detail.form.title}</h1>
        {created && detail.status === "draft" && <p role="status" className="mt-2 rounded-lg bg-green/10 px-4 py-3 text-[15px] text-navy">Saved as a draft. Add photos below, then submit it for review.</p>}
      </div>

      <SubmitPanel
        listingId={detail.id}
        status={detail.status}
        moderationNote={detail.moderationNote}
        hasImages={detail.images.length > 0}
        hasPayment={hasPayment}
        hasSlots={slotCount > 0}
        isSession={detail.bookingModel === "session"}
        willPublishInstantly={session.companyStatus === "approved" && session.autoPublish}
        companyApproved={session.companyStatus === "approved"}
      />

      <section aria-labelledby="photos">
        <h2 id="photos" className="font-serif text-xl font-bold text-navy">Photos</h2>
        <p className="mb-3 mt-1 text-sm text-navy/70">The first photo is the cover. We shrink every photo so pages load fast on mobile networks.</p>
        <ImageManager listingId={detail.id} images={detail.images} allowVideo={detail.form.categorySlug === "car-hire"} />
      </section>

      <section aria-labelledby="closed">
        <h2 id="closed" className="font-serif text-xl font-bold text-navy">Closed dates</h2>
        <p className="mb-3 mt-1 text-sm text-navy/70">Block days for servicing, weather or off-season. Customers can't book them.</p>
        <BlackoutManager listingId={detail.id} isSession={detail.bookingModel === "session"} blackouts={blackouts} canEdit={session.companyStatus === "approved"} today={todayIST()}
          slotTimes={detail.form.kind === "session" ? detail.form.slots.map((x) => x.time) : []} />
      </section>

      <section aria-labelledby="details">
        <h2 id="details" className="mb-3 font-serif text-xl font-bold text-navy">Details</h2>
        {detail.form.kind === "rental_day" || detail.form.kind === "session" ? (
          <ListingForm mode="edit" listingId={detail.id} initial={detail.form} categorySlug={detail.form.categorySlug} kind={detail.form.kind} regions={regions} />
        ) : detail.form.kind === "route_trip" ? (
          <VehicleListingForm mode="edit" listingId={detail.id} initial={detail.form} regions={regions} routes={await getRouteCatalog()} />
        ) : (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-navy">Editing for this listing type is coming soon — contact us if you need changes in the meantime.</p>
        )}
      </section>
    </div>
  );
}
