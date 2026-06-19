"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/rewards";

export type RefRow = {
  id: number;
  email: string;
  phone: string;
  name: string | null;
  referral_code: string;
  adv_cash: number;
  referral_earned: number;
  reward_per_conversion: number;
  is_active: boolean;
  email_verified: boolean;
};

export function AdminReferrals({ users, query, dbConnected }: { users: RefRow[]; query: string; dbConnected: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  function search(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/referrals${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  }

  async function act(id: number, action: string, value?: number) {
    setBusy(id); setError("");
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, value }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(null); }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login"); router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex gap-2 text-sm">
            <a href="/admin" className="rounded-full px-3 py-1.5 font-semibold text-navy/50 hover:bg-cream">Bookings</a>
            <span className="rounded-full bg-navy px-3 py-1.5 font-semibold text-cream">Referrals</span>
          </div>
          <h1 className="mt-3 font-serif text-3xl font-bold text-navy">Referral accounts</h1>
          <p className="mt-1 text-sm text-navy/60">Enable/disable codes, edit per-conversion reward, and transfer adv cash.</p>
        </div>
        <button onClick={logout} className="rounded-full border border-navy/15 px-4 py-2 text-sm font-semibold text-navy/70 hover:bg-cream">Sign out</button>
      </div>

      <form onSubmit={search} className="mt-6 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email, phone or code…" className="w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-navy outline-none focus:border-green" />
        <button className="rounded-xl bg-green px-5 text-sm font-semibold text-white hover:bg-green-600">Search</button>
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!dbConnected && <p className="mt-6 rounded-xl border border-gold/30 bg-cream px-4 py-3 text-sm text-navy/70">Database not connected.</p>}

      {dbConnected && users.length === 0 && (
        <p className="mt-8 rounded-xl border border-navy/10 bg-white px-4 py-8 text-center text-navy/60">No referral accounts{query ? " match your search" : " yet"}.</p>
      )}

      <div className="mt-6 space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-xl border border-navy/10 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-navy">{u.referral_code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${u.is_active ? "bg-green/15 text-green-600" : "bg-navy/10 text-navy/50"}`}>{u.is_active ? "Active" : "Disabled"}</span>
                  {!u.email_verified && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-navy">Unverified</span>}
                </div>
                <p className="mt-1 truncate text-sm text-navy/60">{u.name ? `${u.name} · ` : ""}{u.email} · {u.phone}</p>
                <p className="mt-1 text-sm text-navy/80">Balance <strong>{formatINR(u.adv_cash)}</strong> · earned {formatINR(u.referral_earned)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => act(u.id, "toggle")} disabled={busy === u.id}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${u.is_active ? "border border-navy/15 text-navy/70 hover:bg-cream" : "bg-green text-white hover:bg-green-600"}`}>
                  {u.is_active ? "Disable" : "Enable"}
                </button>
                <button onClick={() => { const v = prompt("Reward per confirmed conversion (₹):", String(u.reward_per_conversion)); if (v !== null) act(u.id, "setReward", Number(v)); }} disabled={busy === u.id}
                  className="rounded-full border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy/70 hover:bg-cream disabled:opacity-50">
                  Reward: {formatINR(u.reward_per_conversion)}
                </button>
                <button onClick={() => { const v = prompt("Adjust adv cash by (₹, negative to deduct):", "0"); if (v) act(u.id, "adjust", Number(v)); }} disabled={busy === u.id}
                  className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-gold/20 disabled:opacity-50">
                  Transfer cash
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
