"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { BikeModel } from "@/lib/data";
import {
  formatINR,
  formatUSD,
  priceFor,
  toForeignUSD,
  SHARED_CAB_PRICE,
  BIKES_PER_DEPARTURE,
  CAB_SEATS_PER_DEPARTURE,
} from "@/lib/pricing";

type Residence = "IN" | "INTL";

export function PricingTable({ bikes }: { bikes: BikeModel[] }) {
  const [residence, setResidence] = useState<Residence>("IN");
  const intl = residence === "INTL";

  // Format a base-INR fare in the viewer's currency.
  const show = (inr: number) => (intl ? formatUSD(toForeignUSD(inr)) : formatINR(inr));

  return (
    <div>
      {/* Residence toggle */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-semibold text-navy">Where do you live?</p>
        <div role="tablist" aria-label="Residence" className="inline-flex rounded-full border border-navy/15 bg-white p-1">
          {([
            ["IN", "India"],
            ["INTL", "Outside India"],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              role="tab"
              aria-selected={residence === val}
              onClick={() => setResidence(val)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                residence === val ? "bg-green text-white shadow-sm" : "text-navy/60 hover:text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {intl && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-navy/55"
          >
            Prices shown in USD · inner-line permit costs are extra
          </motion.p>
        )}
      </div>

      {/* Desktop table */}
      <div className="mt-8 hidden overflow-hidden rounded-2xl border border-navy/10 shadow-luxe md:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-navy text-cream">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold">Model</th>
              <th className="px-6 py-4 text-sm font-semibold">Engine</th>
              <th className="px-6 py-4 text-right text-sm font-semibold">Double-share / rider</th>
              <th className="px-6 py-4 text-right text-sm font-semibold">Single rider</th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10 bg-white">
            {bikes.map((b, i) => (
              <tr key={b.id} className={i === 0 ? "bg-green/5" : "transition hover:bg-cream"}>
                <td className="px-6 py-4">
                  <span className="font-serif text-lg font-bold text-navy">{b.name}</span>
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy">
                      Flagship
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-navy/70">{b.engine_cc} cc</td>
                <td className="px-6 py-4 text-right font-semibold text-navy">{show(priceFor(b, "double"))}</td>
                <td className="px-6 py-4 text-right font-semibold text-navy">{show(priceFor(b, "single"))}</td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/booking?bike=${b.id}${intl ? "&residence=intl" : ""}`}
                    className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition hover:bg-green-600"
                  >
                    Book
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-8 space-y-4 md:hidden">
        {bikes.map((b) => (
          <div key={b.id} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl font-bold text-navy">{b.name}</h3>
              <span className="text-sm text-navy/60">{b.engine_cc} cc</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-cream py-2">
                <dt className="text-[10px] uppercase text-navy/50">Double / rider</dt>
                <dd className="font-bold text-navy">{show(priceFor(b, "double"))}</dd>
              </div>
              <div className="rounded-lg bg-cream py-2">
                <dt className="text-[10px] uppercase text-navy/50">Single</dt>
                <dd className="font-bold text-navy">{show(priceFor(b, "single"))}</dd>
              </div>
            </dl>
            <Link
              href={`/booking?bike=${b.id}`}
              className="mt-4 block rounded-full bg-green py-2.5 text-center text-sm font-semibold text-white"
            >
              Book this bike
            </Link>
          </div>
        ))}
      </div>

      {/* Shared-cab option */}
      <div className="mt-10">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-navy p-6 text-cream sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">Not riding?</p>
            <h3 className="mt-1 font-serif text-xl font-bold">Shared cab seat</h3>
            <p className="mt-1 max-w-md text-sm text-cream/70">
              Travel in the comfort of the support cab instead of a motorcycle — perfect for
              partners and non-riders. {CAB_SEATS_PER_DEPARTURE} seats per Sunday (alongside {BIKES_PER_DEPARTURE} motorbikes).
            </p>
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl font-bold text-green-300">{show(SHARED_CAB_PRICE)}</p>
            <p className="text-xs text-cream/60">per seat</p>
            <Link
              href={`/booking?option=cab${intl ? "&residence=intl" : ""}`}
              className="mt-3 inline-block rounded-full bg-green px-5 py-2 text-xs font-semibold text-white transition hover:bg-green-600"
            >
              Book a cab seat
            </Link>
          </div>
        </div>
      </div>

      {/* International requirements */}
      <div className="mt-6 rounded-2xl border border-gold/40 bg-cream p-6">
        <h3 className="font-serif text-lg font-bold text-navy">Travelling from outside India?</h3>
        <ul className="mt-3 space-y-2 text-sm text-navy/75">
          <li className="flex gap-2"><span className="mt-0.5 text-green-600" aria-hidden>▸</span><span>A valid <strong>passport</strong> and <strong>4 passport-sized photographs</strong> are required for your Inner-Line Permit.</span></li>
          <li className="flex gap-2"><span className="mt-0.5 text-green-600" aria-hidden>▸</span><span><strong>Inner-line permit costs are extra</strong> and billed separately.</span></li>
        </ul>
      </div>
    </div>
  );
}
