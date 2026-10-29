import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminRoutesPanel } from "@/components/admin/AdminRoutesPanel";
import { adminConfigured, isAdminAuthed } from "@/lib/admin-auth";
import { listRouteCatalog } from "@/lib/listings/routes";
import { getRegions } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Admin · Routes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminRoutesPage() {
  if (!adminConfigured() || !(await isAdminAuthed())) redirect("/admin/login");
  const [routes, regions] = await Promise.all([listRouteCatalog(), getRegions()]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <AdminNav active="routes" />
      <h1 className="mt-3 font-serif text-3xl font-bold text-navy">Standardized routes</h1>
      <p className="mt-1 text-sm text-navy/60">Curated point-to-point routes (like Siliguri → Pelling) that drivers can pick instead of setting a custom route.</p>
      <div className="mt-6">
        <AdminRoutesPanel routes={routes} regions={regions} />
      </div>
    </section>
  );
}
