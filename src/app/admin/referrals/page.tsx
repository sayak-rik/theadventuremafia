import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthed, adminConfigured } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { AdminReferrals, type RefRow } from "@/components/AdminReferrals";

export const metadata: Metadata = { title: "Admin · Referrals", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!adminConfigured()) redirect("/admin");
  if (!(await isAdminAuthed())) redirect("/admin/login");

  const { q } = await searchParams;
  const search = q?.trim() ?? "";
  const where = search ? `WHERE email ILIKE $1 OR phone ILIKE $1 OR referral_code ILIKE $1` : "";
  const rows = await query<RefRow>(
    `SELECT id, email, phone, name, referral_code, adv_cash, referral_earned,
            reward_per_conversion, is_active, email_verified
       FROM referral_users ${where}
      ORDER BY created_at DESC LIMIT 200`,
    search ? [`%${search}%`] : [],
  );

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminReferrals users={rows ?? []} query={search} dbConnected={rows !== null} />
    </section>
  );
}
