"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPretty } from "@/lib/dates";

export type AdminBooking = {
  id: number;
  name: string;
  email: string;
  phone: string;
  trip_date: string;
  option: "bike" | "cab";
  rider: "single" | "double" | null;
  seats: number;
  residence: string;
  status: string;
  created_at: string;
  bike_name: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-gold/20 text-navy",
  confirmed: "bg-green/15 text-green-600",
  cancelled: "bg-navy/10 text-navy/50 line-through",
};

export function AdminDashboard({
  bookings,
  dbConnected,
}: {
  bookings: AdminBooking[] | null;
  dbConnected: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function act(id: number, action: "confirm" | "cancel") {
    if (action === "cancel" && !confirm("Cancel this booking and release the seat?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  // Group bookings by departure date.
  const groups = new Map<string, AdminBooking[]>();
  (bookings ?? []).forEach((b) => {
    const arr = groups.get(b.trip_date) ?? [];
    arr.push(b);
    groups.set(b.trip_date, arr);
  });
  const dates = [...groups.keys()].sort();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy">Bookings</h1>
          <p className="mt-1 text-sm text-navy/60">Confirm or cancel bookings. Cancelling releases the seat.</p>
        </div>
        <button onClick={logout} className="rounded-full border border-navy/15 px-4 py-2 text-sm font-semibold text-navy/70 transition hover:bg-cream">
          Sign out
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!dbConnected && (
        <p className="mt-8 rounded-xl border border-gold/30 bg-cream px-4 py-3 text-sm text-navy/70">
          Database not connected — start the Postgres container to view bookings.
        </p>
      )}

      {dbConnected && dates.length === 0 && (
        <p className="mt-8 rounded-xl border border-navy/10 bg-white px-4 py-8 text-center text-navy/60">
          No bookings yet.
        </p>
      )}

      <div className="mt-8 space-y-10">
        {dates.map((date) => {
          const rows = groups.get(date)!;
          const bikes = rows.filter((r) => r.option === "bike" && r.status !== "cancelled").length;
          const cabSeats = rows
            .filter((r) => r.option === "cab" && r.status !== "cancelled")
            .reduce((n, r) => n + r.seats, 0);
          return (
            <div key={date}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-navy/10 pb-2">
                <h2 className="font-serif text-xl font-bold text-navy">{formatPretty(date)}</h2>
                <p className="text-xs text-navy/50">
                  {bikes}/20 bikes · {cabSeats}/10 cab seats booked
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {rows.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col gap-3 rounded-xl border border-navy/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-navy">{b.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[b.status] ?? ""}`}>
                          {b.status}
                        </span>
                        {b.residence === "INTL" && (
                          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold text-navy/60">Intl</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-navy/60">
                        {b.email} · {b.phone}
                      </p>
                      <p className="mt-0.5 text-sm text-navy/70">
                        {b.option === "bike"
                          ? `🏍️ ${b.bike_name ?? "Bike"} · ${b.rider === "double" ? "Two-up" : "Solo"}`
                          : `🚙 Shared cab · ${b.seats} seat${b.seats > 1 ? "s" : ""}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {b.status === "new" && (
                        <button
                          onClick={() => act(b.id, "confirm")}
                          disabled={busyId === b.id}
                          className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                      )}
                      {b.status !== "cancelled" && (
                        <button
                          onClick={() => act(b.id, "cancel")}
                          disabled={busyId === b.id}
                          className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
