import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthed, adminConfigured } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { AdminDashboard, type AdminBooking } from "@/components/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Always render fresh (reads cookies + live booking data).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <section className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <h1 className="font-serif text-2xl font-bold text-navy">Admin not configured</h1>
        <p className="mt-3 text-navy/70">
          Set <code className="rounded bg-cream px-1.5 py-0.5">ADMIN_PASSWORD</code> in your
          environment to enable the admin dashboard.
        </p>
      </section>
    );
  }

  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }

  const bookings = await query<AdminBooking>(
    `SELECT
        b.id, b.name, b.email, b.phone,
        to_char(b.trip_date, 'YYYY-MM-DD') AS trip_date,
        b.option, b.rider, b.seats, b.residence, b.status,
        to_char(b.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
        bm.name AS bike_name
     FROM bookings b
     LEFT JOIN bike_models bm ON bm.id = b.bike_model_id
     ORDER BY b.trip_date ASC, b.created_at ASC`,
  );

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminDashboard bookings={bookings} dbConnected={bookings !== null} />
    </section>
  );
}
