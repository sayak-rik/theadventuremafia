"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { fareFor, formatMoney, type Residence } from "@/lib/pricing";
import { formatINR } from "@/lib/rewards";
import { toISODate, formatPretty } from "@/lib/dates";
import { CountryCodeSelect } from "./CountryCodeSelect";

const field =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-navy outline-none transition focus:border-green";

export function TrekBookingForm({
  trekId,
  trekName,
  pricePerPerson,
  taxiFareExtra,
  priceNote,
}: {
  trekId: number;
  trekName: string;
  pricePerPerson: number;
  taxiFareExtra: boolean;
  priceNote?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [people, setPeople] = useState(1);
  const [residence, setResidence] = useState<Residence>("IN");
  const [message, setMessage] = useState("");

  // Signed-in reward users can still spend their own adv-cash balance on a trek.
  // Referral codes, however, are not accepted on treks.
  const [rewardUser, setRewardUser] = useState<{ advCash: number } | null>(null);
  const [applyWallet, setApplyWallet] = useState(true);

  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const intl = residence === "INTL";
  const fare = fareFor(pricePerPerson, residence); // { amount, currency }
  const totalAmount = fare.amount * people;
  const walletAvail = rewardUser?.advCash ?? 0;
  const walletApplied = applyWallet && !intl ? Math.min(walletAvail, totalAmount) : 0;
  const payable = totalAmount - walletApplied;

  const today = toISODate(new Date());

  useEffect(() => {
    fetch("/api/rewards/me").then((r) => r.json()).then((d) => {
      if (d.user) setRewardUser({ advCash: d.user.advCash });
    }).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: `${countryCode} ${phone}`.trim(),
          tripDate: date,
          residence,
          productType: "trek",
          trekId,
          seats: people,
          message,
          applyAdvCash: applyWallet && walletApplied > 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-green/30 bg-white p-10 text-center shadow-luxe"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green text-2xl text-white">✓</div>
        <h3 className="mt-5 font-serif text-2xl font-bold text-navy">Thank you, {name.split(" ")[0]}!</h3>
        <p className="mx-auto mt-3 max-w-md text-navy/70">
          Your request for the {trekName}{date ? ` on ${formatPretty(date)}` : ""} for {people}{" "}
          {people > 1 ? "people" : "person"} is in. Our crew will reach out within 24 hours to confirm.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-2">
      {/* Left: contact + options */}
      <div className="space-y-4">
        <div>
          <label htmlFor="t-name" className="mb-1 block text-sm font-semibold text-navy">Full name</label>
          <input id="t-name" required value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Alice Sharma" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="t-email" className="mb-1 block text-sm font-semibold text-navy">Email</label>
            <input id="t-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="alice@example.com" />
          </div>
          <div>
            <label htmlFor="t-phone" className="mb-1 block text-sm font-semibold text-navy">Phone</label>
            <div className="flex gap-2">
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
              <input id="t-phone" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))} className={field} placeholder="98765 43210" />
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-semibold text-navy">Where do you live?</legend>
          <div className="grid grid-cols-2 gap-3">
            {([["IN", "India"], ["INTL", "Outside India"]] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setResidence(val)}
                aria-pressed={residence === val}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  residence === val ? "border-green bg-green/10 text-green-600" : "border-navy/15 text-navy/70 hover:border-green/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {intl && <p className="mt-2 text-xs text-navy/55">Quoted in USD. Adv-cash discounts apply to India (INR) bookings only.</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="t-date" className="mb-1 block text-sm font-semibold text-navy">Date</label>
            <input id="t-date" type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            <p className="mt-1 text-xs text-navy/50">Available every day.</p>
          </div>
          <div>
            <label htmlFor="t-people" className="mb-1 block text-sm font-semibold text-navy">Number of people</label>
            <input
              id="t-people"
              type="number"
              min={1}
              max={20}
              value={people}
              onChange={(e) => setPeople(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className={field}
            />
          </div>
        </div>

        {rewardUser && walletAvail > 0 && !intl && (
          <label className="flex items-start gap-3 rounded-xl border border-green/30 bg-green/5 p-4">
            <input type="checkbox" checked={applyWallet} onChange={(e) => setApplyWallet(e.target.checked)} className="mt-0.5 h-4 w-4 accent-green" />
            <span className="text-sm text-navy/80">
              <span className="font-semibold text-navy">Apply my adv cash</span> — you have {formatINR(walletAvail)} available.
              {applyWallet && walletApplied > 0 && <span className="block text-green-600">{formatINR(walletApplied)} will be applied.</span>}
            </span>
          </label>
        )}

        <div>
          <label htmlFor="t-message" className="mb-1 block text-sm font-semibold text-navy">Anything else? (optional)</label>
          <textarea id="t-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={field} placeholder="Group details, fitness levels, pickup point…" />
        </div>
      </div>

      {/* Right: summary */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-navy p-6 text-cream">
          <p className="text-xs uppercase tracking-wide text-cream/60">Your adventure</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-cream/70">Trek</dt><dd className="font-semibold">{trekName}</dd></div>
            <div className="flex justify-between"><dt className="text-cream/70">Date</dt><dd className="font-semibold">{date ? formatPretty(date) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-cream/70">People</dt><dd className="font-semibold">{people}</dd></div>
            <div className="flex justify-between"><dt className="text-cream/70">Per person</dt><dd className="font-semibold">{formatMoney(fare.amount, fare.currency)}</dd></div>
          </dl>
          {walletApplied > 0 && (
            <div className="mt-4 space-y-1 border-t border-cream/15 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-cream/70">Subtotal</dt><dd>{formatMoney(totalAmount, fare.currency)}</dd></div>
              <div className="flex justify-between text-green-300"><dt>Your adv cash</dt><dd>– {formatMoney(walletApplied, fare.currency)}</dd></div>
            </div>
          )}
          <div className={`mt-4 flex items-baseline justify-between ${walletApplied > 0 ? "" : "border-t border-cream/15 pt-4"}`}>
            <span className="text-cream/70">{walletApplied > 0 ? "You pay" : "Total"}</span>
            <span className="font-serif text-2xl font-bold text-green-300">{formatMoney(payable, fare.currency)}</span>
          </div>
          {taxiFareExtra && <p className="mt-2 text-xs text-cream/60">{priceNote ?? "Taxi fare is extra, shared and paid on the day."}</p>}
        </div>

        {status === "error" && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={status === "submitting" || !date}
          className="w-full rounded-full bg-green px-6 py-4 text-sm font-semibold text-white shadow-luxe transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "submitting" ? "Sending…" : !date ? "Pick a date to continue" : "Request my spot"}
        </button>
        <p className="text-center text-xs text-navy/50">No payment now — we confirm availability first.</p>
      </div>
    </form>
  );
}
