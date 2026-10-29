import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusDot, COMPANY_STATUS } from "@/components/ui/status";
import { adminConfigured, isAdminAuthed } from "@/lib/admin-auth";
import { listOperators } from "@/lib/operators/admin";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Admin · Operators", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Awaiting approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
  { key: "all", label: "All" },
];

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "operator", label: "Operators" },
  { key: "driver", label: "Drivers" },
] as const;

export default async function AdminOperatorsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  if (!adminConfigured() || !(await isAdminAuthed())) redirect("/admin/login");
  const { status, type } = await searchParams;
  const current = TABS.some((t) => t.key === status) ? status! : "pending";
  const currentType = TYPE_TABS.some((t) => t.key === type) ? (type as "all" | "operator" | "driver") : "all";
  const operators = await listOperators(current, currentType);

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="operators" />
      <h1 className="mt-3 font-serif text-3xl font-bold text-navy">Operators &amp; drivers</h1>
      <p className="mt-1 text-sm text-navy/60">Approve operators and drivers before anything they list can go live.</p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/operators?status=${t.key}&type=${currentType}`} aria-current={current === t.key ? "page" : undefined}
            className={cn("rounded-full border px-3.5 py-1.5 font-medium", current === t.key ? "border-navy bg-navy text-cream" : "border-navy/15 bg-white text-navy/70 hover:bg-cream")}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {TYPE_TABS.map((t) => (
          <Link key={t.key} href={`/admin/operators?status=${current}&type=${t.key}`} aria-current={currentType === t.key ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-[13px] font-medium", currentType === t.key ? "border-green bg-green/15 text-navy" : "border-navy/15 bg-white text-navy/60 hover:bg-cream")}>
            {t.label}
          </Link>
        ))}
      </div>

      {operators.length === 0 ? (
        <p className="mt-8 rounded-xl border border-navy/10 bg-white px-4 py-8 text-center text-navy/60">Nobody here.</p>
      ) : (
        <ul className="mt-6 divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
          {operators.map((o) => {
            const st = COMPANY_STATUS[o.status] ?? COMPANY_STATUS.pending;
            return (
              <li key={o.id}>
                <Link href={`/admin/operators/${o.id}`} className="flex flex-col gap-2 p-4 hover:bg-cream/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">
                      {o.name}
                      {o.companyType === "driver" && <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-navy/60">Driver</span>}
                      {o.isSeed && <span className="ml-2 text-xs font-normal text-navy/50">(your own business)</span>}
                    </p>
                    <p className="text-sm text-navy/65">{o.phone} · {o.email}</p>
                    <p className="text-sm text-navy/65">
                      {o.liveListings} live{o.pendingListings > 0 && <strong className="text-amber-800">, {o.pendingListings} in review</strong>}
                      {!o.hasPayment && o.status !== "pending" ? " · no payment details" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4"><StatusDot tone={st.tone}>{st.label}</StatusDot></div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
