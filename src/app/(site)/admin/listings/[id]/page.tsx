import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminListingActions } from "@/components/admin/AdminListingActions";
import { ListingFacts } from "@/components/admin/ListingFacts";
import { StatusDot, LISTING_STATUS } from "@/components/ui/status";
import { adminConfigured, isAdminAuthed } from "@/lib/admin-auth";
import { getListingForAdmin } from "@/lib/listings/moderation";

export const metadata: Metadata = { title: "Admin · Review listing", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminListingPage({ params }: { params: Promise<{ id: string }> }) {
  if (!adminConfigured() || !(await isAdminAuthed())) redirect("/admin/login");
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) notFound();
  const view = await getListingForAdmin(listingId);
  if (!view) notFound();
  const { detail } = view;
  const st = LISTING_STATUS[detail.status] ?? LISTING_STATUS.draft;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="listings" />
      <Link href="/admin/listings" className="mt-4 inline-block text-sm font-medium text-navy/60 hover:underline">All listings</Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="font-serif text-3xl font-bold text-navy">{detail.form.title}</h1>
        <StatusDot tone={st.tone}>{st.label}</StatusDot>
      </div>
      <p className="mt-1 text-navy/70">by <Link className="underline" href={`/admin/operators/${view.companyId}`}>{view.companyName}</Link></p>
      {detail.moderationNote && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-navy">Last note: {detail.moderationNote}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <ListingFacts detail={detail} regionName={view.regionName} categoryName={view.categoryName} />
        <div className="lg:sticky lg:top-24 lg:self-start">
          <AdminListingActions id={detail.id} status={detail.status} companyApproved={view.companyStatus === "approved"} isFeatured={view.isFeatured} featuredUntil={view.featuredUntil} />
        </div>
      </div>
    </section>
  );
}
