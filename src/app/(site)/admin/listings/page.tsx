import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusDot, LISTING_STATUS } from "@/components/ui/status";
import { adminConfigured, isAdminAuthed } from "@/lib/admin-auth";
import { listForReview, type ReviewRow } from "@/lib/listings/moderation";
import { formatINR } from "@/lib/pricing";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Admin · Listings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending_review", label: "In review" },
  { key: "changes_requested", label: "Changes requested" },
  { key: "published", label: "Live" },
  { key: "deactivated", label: "Paused" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!adminConfigured() || !(await isAdminAuthed())) redirect("/admin/login");
  const { status } = await searchParams;
  const current = TABS.find((t) => t.key === status)?.key ?? "pending_review";
  const rows = await listForReview(current);

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="listings" />
      <h1 className="mt-3 font-serif text-3xl font-bold text-navy">Listings</h1>
      <p className="mt-1 text-sm text-navy/60">Review each listing once before it goes live.</p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/listings?status=${t.key}`} aria-current={current === t.key ? "page" : undefined}
            className={cn("rounded-full border px-3.5 py-1.5 font-medium", current === t.key ? "border-navy bg-navy text-cream" : "border-navy/15 bg-white text-navy/70 hover:bg-cream")}>
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-navy/10 bg-white px-4 py-8 text-center text-navy/60">Nothing here.</p>
      ) : (
        <ul className="mt-6 divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
          {rows.map((r: ReviewRow) => {
            const st = LISTING_STATUS[r.status] ?? LISTING_STATUS.draft;
            return (
              <li key={r.id}>
                <Link href={`/admin/listings/${r.id}`} className="flex items-center gap-4 p-4 hover:bg-cream/50">
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" width={80} height={60} className="h-[60px] w-20 shrink-0 rounded-lg object-cover" />
                  ) : <div aria-hidden className="h-[60px] w-20 shrink-0 rounded-lg bg-navy/5" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy">{r.title}</p>
                    <p className="truncate text-sm text-navy/65">{r.companyName} · {r.categoryName} · {r.regionName}{r.unitPrice ? ` · ${formatINR(r.unitPrice)}` : ""}</p>
                    {r.companyStatus !== "approved" && <p className="text-sm font-medium text-amber-800">Operator not approved yet</p>}
                  </div>
                  <StatusDot tone={st.tone}>{st.label}</StatusDot>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
