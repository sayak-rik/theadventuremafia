import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminOperatorPanel } from "@/components/admin/AdminOperatorPanel";
import { StatusDot, COMPANY_STATUS, LISTING_STATUS } from "@/components/ui/status";
import { adminConfigured, isAdminAuthed } from "@/lib/admin-auth";
import { getOperatorDetail } from "@/lib/operators/admin";
import { forCompany } from "@/lib/listings/repo";
import { whatsappLink } from "@/lib/phone";

export const metadata: Metadata = { title: "Admin · Operator", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-navy/60">{label}</dt>
      <dd className="text-[15px] text-navy">{children || <span className="text-navy/40">—</span>}</dd>
    </div>
  );
}

export default async function AdminOperatorPage({ params }: { params: Promise<{ id: string }> }) {
  if (!adminConfigured() || !(await isAdminAuthed())) redirect("/admin/login");
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();
  const op = await getOperatorDetail(companyId);
  if (!op) notFound();
  const listings = await forCompany(companyId).list();
  const st = COMPANY_STATUS[op.status] ?? COMPANY_STATUS.pending;
  const hasPayment = Boolean(op.payment && (op.payment.upiVpa || op.payment.upiNumber || op.payment.qrImageUrl));

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="operators" />
      <Link href="/admin/operators" className="mt-4 inline-block text-sm font-medium text-navy/60 hover:underline">All operators</Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="font-serif text-3xl font-bold text-navy">{op.name}</h1>
        <StatusDot tone={st.tone}>{st.label}</StatusDot>
        {op.companyType === "driver" && <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-navy/60">Driver</span>}
      </div>
      {op.rejectionReason && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-navy">Last reason given: {op.rejectionReason}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          <dl className="divide-y divide-navy/10 rounded-2xl border border-navy/10 bg-white px-5">
            <Row label="Owner">{op.ownerName}</Row>
            <Row label="Phone"><a className="underline" href={`tel:${op.phone}`}>{op.phone}</a>{" · "}<a className="underline" href={whatsappLink(op.whatsapp ?? op.phone)} target="_blank" rel="noreferrer">WhatsApp</a></Row>
            <Row label="Email">{op.email}</Row>
            <Row label="Address">{op.address}</Row>
            <Row label="Maps">{op.mapsUrl && <a className="underline" href={op.mapsUrl} target="_blank" rel="noreferrer">Open map</a>}</Row>
            <Row label="Offers">{op.categories.join(", ")}</Row>
            <Row label="Operates in">{op.regions.join(", ")}</Row>
            <Row label="Applied">{new Date(op.createdAt).toLocaleString("en-IN")}</Row>
            <Row label="Last sign-in">{op.lastLoginAt && new Date(op.lastLoginAt).toLocaleString("en-IN")}</Row>
            <Row label="Partner terms">{op.termsVersion && `Accepted ${op.termsVersion}`}</Row>
          </dl>

          <section aria-labelledby="pay">
            <h2 id="pay" className="mb-2 font-serif text-lg font-bold text-navy">Where customers will pay</h2>
            {op.payment ? (
              <dl className="divide-y divide-navy/10 rounded-2xl border border-navy/10 bg-white px-5">
                <Row label="Payee name">{op.payment.payeeName}</Row>
                <Row label="UPI ID">{op.payment.upiVpa}</Row>
                <Row label="UPI number">{op.payment.upiNumber}</Row>
                <Row label="QR image">{op.payment.qrImageUrl && <a className="underline" href={op.payment.qrImageUrl} target="_blank" rel="noreferrer">View</a>}</Row>
                <Row label="Last changed">{new Date(op.payment.updatedAt).toLocaleString("en-IN")}</Row>
              </dl>
            ) : <p className="rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm text-navy/70">Not added yet.</p>}
            <p className="mt-2 text-sm text-navy/60">Check the payee name matches the business before approving.</p>
          </section>

          <section aria-labelledby="listings">
            <h2 id="listings" className="mb-2 font-serif text-lg font-bold text-navy">Listings</h2>
            {listings.length === 0 ? <p className="rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm text-navy/70">None yet.</p> : (
              <ul className="divide-y divide-navy/10 rounded-2xl border border-navy/10 bg-white">
                {listings.map((l) => {
                  const ls = LISTING_STATUS[l.status] ?? LISTING_STATUS.draft;
                  return (
                    <li key={l.id}>
                      <Link href={`/admin/listings/${l.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-cream/50">
                        <span className="min-w-0"><span className="block truncate font-semibold text-navy">{l.title}</span><span className="text-sm text-navy/65">{l.categoryName}</span></span>
                        <StatusDot tone={ls.tone}>{ls.label}</StatusDot>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {op.recentAudit.length > 0 && (
            <section aria-labelledby="audit">
              <h2 id="audit" className="mb-2 font-serif text-lg font-bold text-navy">Recent activity</h2>
              <ul className="space-y-1 text-sm text-navy/75">
                {op.recentAudit.map((a, i) => <li key={i}><span className="tabular-nums text-navy/50">{new Date(a.at).toLocaleString("en-IN")}</span> · {a.action}</li>)}
              </ul>
            </section>
          )}
        </div>

        <AdminOperatorPanel id={op.id} status={op.status} companyType={op.companyType} commissionPercent={op.commissionPercent}
          isVerified={op.isVerified} autoPublish={op.autoPublish} verification={op.verification}
          hasPayment={hasPayment} hasLiveOrQueued={listings.some((l) => l.status === "published" || l.status === "pending_review")} />
      </div>
    </section>
  );
}
