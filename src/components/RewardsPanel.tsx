"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { formatINR, SIGNUP_BONUS, REFERRAL_DISCOUNT, DEFAULT_REWARD } from "@/lib/rewards";

const field =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-navy outline-none transition focus:border-green";

type Me = { email: string; referralCode: string; advCash: number; referralEarned: number };

export function RewardsPanel() {
  const [stage, setStage] = useState<"loading" | "signup" | "otp" | "done">("loading");
  const [form, setForm] = useState({ email: "", phone: "", name: "" });
  const [otp, setOtp] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/rewards/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) { setMe(d.user); setStage("done"); } else setStage("signup");
      })
      .catch(() => setStage("signup"));
  }, []);

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await fetch("/api/rewards/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Something went wrong.");
      setStage("otp");
      if (d.emailed === false) setError("Heads up: we couldn't email the code right now — contact us if it doesn't arrive.");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(false); }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await fetch("/api/rewards/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email, otp }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Invalid code.");
      setMe({ email: form.email, referralCode: d.referralCode, advCash: d.advCash, referralEarned: d.referralEarned });
      setStage("done");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/rewards/me", { method: "DELETE" });
    setMe(null); setForm({ email: "", phone: "", name: "" }); setOtp(""); setStage("signup");
  }

  if (stage === "loading") return <div className="py-10 text-center text-navy/50">Loading…</div>;

  if (stage === "done" && me) {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/booking?ref=${me.referralCode}`;
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-navy p-6 text-cream">
            <p className="text-xs uppercase tracking-wide text-cream/60">Your adv cash</p>
            <p className="mt-1 font-serif text-4xl font-bold text-green-300">{formatINR(me.advCash)}</p>
            <p className="mt-1 text-xs text-cream/50">Earned from referrals: {formatINR(me.referralEarned)}</p>
          </div>
          <div className="rounded-2xl border border-gold/30 bg-cream p-6">
            <p className="text-xs uppercase tracking-wide text-navy/50">Your referral code</p>
            <p className="mt-1 font-serif text-3xl font-bold tracking-wider text-navy">{me.referralCode}</p>
            <p className="mt-2 text-sm text-navy/60">Friends get {formatINR(REFERRAL_DISCOUNT)} off; you earn {formatINR(DEFAULT_REWARD)} per confirmed booking.</p>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-navy">Your referral link</label>
          <div className="flex gap-2">
            <input readOnly value={link} className={`${field} text-sm`} />
            <button
              onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="shrink-0 rounded-xl bg-green px-5 text-sm font-semibold text-white transition hover:bg-green-600"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <button onClick={logout} className="text-sm font-semibold text-navy/50 hover:text-navy">Sign out</button>
      </motion.div>
    );
  }

  return (
    <div>
      {stage === "signup" && (
        <form onSubmit={submitSignup} className="space-y-4">
          <p className="rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green-700">
            Sign up and get {formatINR(SIGNUP_BONUS)} adv cash instantly. 🎉
          </p>
          <div>
            <label htmlFor="r-email" className="mb-1 block text-sm font-semibold text-navy">Email</label>
            <input id="r-email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={field} placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="r-phone" className="mb-1 block text-sm font-semibold text-navy">Phone</label>
            <input id="r-phone" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={field} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label htmlFor="r-name" className="mb-1 block text-sm font-semibold text-navy">Name (optional)</label>
            <input id="r-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={field} placeholder="Your name" />
          </div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-green px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50">
            {busy ? "Sending code…" : "Sign up & get adv cash"}
          </button>
        </form>
      )}

      {stage === "otp" && (
        <form onSubmit={submitOtp} className="space-y-4">
          <p className="text-sm text-navy/70">We emailed a 6-digit code to <strong>{form.email}</strong>. Enter it below.</p>
          <input
            inputMode="numeric" maxLength={6} required value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className={`${field} text-center text-2xl font-bold tracking-[0.5em]`} placeholder="••••••"
          />
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-green px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50">
            {busy ? "Verifying…" : "Verify & claim my adv cash"}
          </button>
          <button type="button" onClick={() => setStage("signup")} className="w-full text-sm text-navy/50 hover:text-navy">← Back</button>
        </form>
      )}
    </div>
  );
}
