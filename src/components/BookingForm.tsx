"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { BikeModel } from "@/lib/data";
import {
  formatMoney,
  fareFor,
  priceFor,
  SHARED_CAB_PRICE,
  BIKES_PER_DEPARTURE,
  CAB_SEATS_PER_DEPARTURE,
  type Residence,
} from "@/lib/pricing";
import { REFERRAL_DISCOUNT, formatINR } from "@/lib/rewards";
import { formatPretty } from "@/lib/dates";
import { SundayCalendar } from "./SundayCalendar";

const field =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-navy outline-none transition focus:border-green";

type Option = "bike" | "cab";

export function BookingForm({
  bikes,
  initialBikeId,
  initialOption = "bike",
  initialResidence = "IN",
  initialRef = "",
}: {
  bikes: BikeModel[];
  initialBikeId?: number;
  initialOption?: Option;
  initialResidence?: Residence;
  initialRef?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tripDate, setTripDate] = useState<string | null>(null);

  const [residence, setResidence] = useState<Residence>(initialResidence);
  const [option, setOption] = useState<Option>(initialOption);
  const [bikeId, setBikeId] = useState<number>(initialBikeId ?? bikes[0]?.id ?? 1);
  const [rider, setRider] = useState<"single" | "double">("double");
  const [cabSeats, setCabSeats] = useState(1);
  const [message, setMessage] = useState("");

  const [referral, setReferral] = useState(initialRef);
  const [referralState, setReferralState] = useState<"none" | "checking" | "valid" | "invalid" | "self">("none");

  // Signed-in reward user (for spending their own adv cash + blocking self-referral).
  const [rewardUser, setRewardUser] = useState<{ advCash: number; referralCode: string } | null>(null);
  const [applyWallet, setApplyWallet] = useState(true);

  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const intl = residence === "INTL";
  const bike = bikes.find((b) => b.id === bikeId) ?? bikes[0];

  // Base INR fare, then resolved into the viewer's currency.
  const baseUnitINR = option === "cab" ? SHARED_CAB_PRICE : bike ? priceFor(bike, rider) : 0;
  const fare = fareFor(baseUnitINR, residence); // { amount, currency }
  const totalAmount = option === "cab" ? fare.amount * cabSeats : fare.amount;

  // Referral discount: adv cash is in INR, so it only reduces INR (India) bookings.
  const discount = referralState === "valid" && !intl ? Math.min(REFERRAL_DISCOUNT, totalAmount) : 0;
  // The signed-in user's own balance, applied (INR only) if the box is ticked.
  const walletAvail = rewardUser?.advCash ?? 0;
  const walletApplied = applyWallet && !intl ? Math.min(walletAvail, totalAmount - discount) : 0;
  const payable = totalAmount - discount - walletApplied;

  // Load the signed-in reward user's balance (if any).
  useEffect(() => {
    fetch("/api/rewards/me").then((r) => r.json()).then((d) => {
      if (d.user) setRewardUser({ advCash: d.user.advCash, referralCode: d.user.referralCode });
    }).catch(() => {});
  }, []);

  // Validate the referral code (debounced) whenever it changes.
  useEffect(() => {
    const code = referral.trim().toUpperCase();
    if (!code) { setReferralState("none"); return; }
    if (rewardUser && code === rewardUser.referralCode.toUpperCase()) { setReferralState("self"); return; }
    setReferralState("checking");
    const t = setTimeout(() => {
      fetch(`/api/rewards/validate?code=${encodeURIComponent(code)}`)
        .then((r) => r.json())
        .then((d) => setReferralState(d.valid ? "valid" : "invalid"))
        .catch(() => setReferralState("invalid"));
    }, 450);
    return () => clearTimeout(t);
  }, [referral, rewardUser]);

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
          phone,
          tripDate,
          residence,
          option,
          bikeModelId: option === "bike" ? bikeId : null,
          riderType: option === "bike" ? rider : null,
          seats: option === "bike" ? (rider === "double" ? 2 : 1) : cabSeats,
          message,
          referralCode: referralState === "self" ? undefined : referral.trim() || undefined,
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green text-2xl text-white">
          ✓
        </div>
        <h3 className="mt-5 font-serif text-2xl font-bold text-navy">Thank you, {name.split(" ")[0]}!</h3>
        <p className="mx-auto mt-3 max-w-md text-navy/70">
          Your request for the {tripDate ? formatPretty(tripDate) : ""} departure
          {option === "bike" ? ` on the ${bike?.name}` : ` (${cabSeats} shared-cab seat${cabSeats > 1 ? "s" : ""})`} is in.
          Our crew will reach out within 24 hours to confirm availability and permits.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-2">
      {/* Left: contact + options */}
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-semibold text-navy">Full name</label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Alice Sharma" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-navy">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="alice@example.com" />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-navy">Phone</label>
            <input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} className={field} placeholder="+91 98765 43210" />
          </div>
        </div>

        {/* Residence — international riders are quoted in USD (permit extra). */}
        <fieldset>
          <legend className="mb-1 block text-sm font-semibold text-navy">Where do you live?</legend>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["IN", "India"],
              ["INTL", "Outside India"],
            ] as const).map(([val, label]) => (
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
          {intl && (
            <p className="mt-2 text-xs text-navy/55">
              Quoted in USD. A passport and 4 passport-sized photos are needed for your permit, and inner-line permit costs are extra.
            </p>
          )}
        </fieldset>

        {/* Riding option: ride a bike OR take a shared cab seat */}
        <fieldset>
          <legend className="mb-1 block text-sm font-semibold text-navy">Riding option</legend>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOption("bike")}
              aria-pressed={option === "bike"}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                option === "bike" ? "border-green bg-green/10 text-green-600" : "border-navy/15 text-navy/70 hover:border-green/50"
              }`}
            >
              Ride a motorbike
              <span className="mt-0.5 block text-xs font-normal text-navy/50">{BIKES_PER_DEPARTURE} bikes / departure</span>
            </button>
            <button
              type="button"
              onClick={() => setOption("cab")}
              aria-pressed={option === "cab"}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                option === "cab" ? "border-green bg-green/10 text-green-600" : "border-navy/15 text-navy/70 hover:border-green/50"
              }`}
            >
              Shared cab seat
              <span className="mt-0.5 block text-xs font-normal text-navy/50">{formatMoney(fareFor(SHARED_CAB_PRICE, residence).amount, fare.currency)} / seat</span>
            </button>
          </div>
        </fieldset>

        {option === "bike" ? (
          <>
            <div>
              <label htmlFor="bike" className="mb-1 block text-sm font-semibold text-navy">Bike model</label>
              <select id="bike" value={bikeId} onChange={(e) => setBikeId(Number(e.target.value))} className={field}>
                {bikes.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} · {b.engine_cc}cc</option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className="mb-1 block text-sm font-semibold text-navy">Riders on the bike</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["double", "single"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRider(r)}
                    aria-pressed={rider === r}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                      rider === r ? "border-green bg-green/10 text-green-600" : "border-navy/15 text-navy/70 hover:border-green/50"
                    }`}
                  >
                    {r === "double" ? "Two-up (double)" : "Solo (single)"}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <div className="rounded-xl border border-navy/15 bg-white p-4">
            <label htmlFor="cabSeats" className="mb-1 block text-sm font-semibold text-navy">Shared-cab seats</label>
            <div className="flex items-center gap-3">
              <input
                id="cabSeats"
                type="number"
                min={1}
                max={CAB_SEATS_PER_DEPARTURE}
                value={cabSeats}
                onChange={(e) => setCabSeats(Math.max(1, Math.min(CAB_SEATS_PER_DEPARTURE, Number(e.target.value) || 1)))}
                className="w-24 rounded-xl border border-navy/15 bg-white px-4 py-3 text-navy outline-none focus:border-green"
              />
              <p className="text-sm text-navy/60">
                {formatMoney(fareFor(SHARED_CAB_PRICE, residence).amount, fare.currency)} per seat · up to {CAB_SEATS_PER_DEPARTURE} seats each Sunday.
              </p>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="referral" className="mb-1 block text-sm font-semibold text-navy">Referral code (optional)</label>
          <input
            id="referral"
            value={referral}
            onChange={(e) => setReferral(e.target.value.toUpperCase())}
            className={field}
            placeholder="TAM-XXXXXX"
            autoCapitalize="characters"
          />
          {referralState === "valid" && !intl && (
            <p className="mt-1 text-xs font-semibold text-green-600">✓ {formatINR(REFERRAL_DISCOUNT)} adv cash will be applied.</p>
          )}
          {referralState === "valid" && intl && (
            <p className="mt-1 text-xs text-navy/50">✓ Valid code. Adv cash discount applies to India (INR) bookings only.</p>
          )}
          {referralState === "invalid" && (
            <p className="mt-1 text-xs text-red-600">That code isn't valid or is inactive.</p>
          )}
          {referralState === "self" && (
            <p className="mt-1 text-xs text-red-600">You can't use your own referral code on your own booking.</p>
          )}
          {referralState === "checking" && <p className="mt-1 text-xs text-navy/40">Checking…</p>}
        </div>

        {/* Signed-in reward users: spend their own adv cash */}
        {rewardUser && walletAvail > 0 && !intl && (
          <label className="flex items-start gap-3 rounded-xl border border-green/30 bg-green/5 p-4">
            <input type="checkbox" checked={applyWallet} onChange={(e) => setApplyWallet(e.target.checked)} className="mt-0.5 h-4 w-4 accent-green" />
            <span className="text-sm text-navy/80">
              <span className="font-semibold text-navy">Apply my adv cash</span> — you have {formatINR(walletAvail)} available.
              {applyWallet && walletApplied > 0 && <span className="block text-green-600">{formatINR(walletApplied)} will be applied to this booking.</span>}
            </span>
          </label>
        )}

        <div>
          <label htmlFor="message" className="mb-1 block text-sm font-semibold text-navy">Anything else? (optional)</label>
          <textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={field} placeholder="Riding experience, dietary needs, group size…" />
        </div>
      </div>

      {/* Right: date + summary */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-navy">Choose your Sunday departure</p>
        <SundayCalendar value={tripDate} onChange={setTripDate} />

        <div className="rounded-2xl bg-navy p-6 text-cream">
          <p className="text-xs uppercase tracking-wide text-cream/60">Your expedition</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-cream/70">Departure</dt><dd className="font-semibold">{tripDate ? formatPretty(tripDate) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-cream/70">Option</dt><dd className="font-semibold">{option === "bike" ? "Ride a motorbike" : "Shared cab seat"}</dd></div>
            {option === "bike" ? (
              <>
                <div className="flex justify-between"><dt className="text-cream/70">Bike</dt><dd className="font-semibold">{bike?.name}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/70">Riders</dt><dd className="font-semibold capitalize">{rider}</dd></div>
              </>
            ) : (
              <div className="flex justify-between"><dt className="text-cream/70">Seats</dt><dd className="font-semibold">{cabSeats}</dd></div>
            )}
          </dl>
          {(discount > 0 || walletApplied > 0) && (
            <div className="mt-4 space-y-1 border-t border-cream/15 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-cream/70">Subtotal</dt><dd>{formatMoney(totalAmount, fare.currency)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-green-300"><dt>Referral adv cash</dt><dd>– {formatMoney(discount, fare.currency)}</dd></div>}
              {walletApplied > 0 && <div className="flex justify-between text-green-300"><dt>Your adv cash</dt><dd>– {formatMoney(walletApplied, fare.currency)}</dd></div>}
            </div>
          )}
          {(() => { const hasDisc = discount > 0 || walletApplied > 0; return (
          <div className={`mt-4 flex items-baseline justify-between ${hasDisc ? "" : "border-t border-cream/15 pt-4"}`}>
            <span className="text-cream/70">{hasDisc ? "You pay" : option === "cab" && cabSeats > 1 ? "Total" : "From"}</span>
            <span className="font-serif text-2xl font-bold text-green-300">
              {formatMoney(payable, fare.currency)}
              <span className="text-sm font-normal text-cream/60">{hasDisc ? "" : option === "bike" ? " /rider" : cabSeats > 1 ? "" : " /seat"}</span>
            </span>
          </div>
          ); })()}
          {intl && (
            <p className="mt-2 text-xs text-cream/50">Inner-line permit costs are extra.</p>
          )}
        </div>

        {status === "error" && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === "submitting" || !tripDate}
          className="w-full rounded-full bg-green px-6 py-4 text-sm font-semibold text-white shadow-luxe transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "submitting" ? "Sending…" : !tripDate ? "Select a date to continue" : "Request my seat"}
        </button>
        <p className="text-center text-xs text-navy/50">
          No payment now — we confirm availability and permits first.
        </p>
      </div>
    </form>
  );
}
