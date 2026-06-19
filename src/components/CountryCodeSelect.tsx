"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES } from "@/data/countryCodes";

// Searchable country-code dropdown. `value` is the dial code (e.g. "+91").
export function CountryCodeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (dial: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 10);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const term = q.trim().toLowerCase();
  const list = term
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(term) || c.dial.includes(term) || c.iso.toLowerCase() === term)
    : COUNTRIES;
  const current = COUNTRIES.find((c) => c.dial === value) ?? COUNTRIES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-full items-center gap-1.5 rounded-xl border border-navy/15 bg-white px-3 py-3 text-navy outline-none transition hover:border-green/50 focus:border-green"
      >
        <span aria-hidden>{current.flag}</span>
        <span className="font-semibold">{current.dial}</span>
        <span className="text-navy/40" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-72 rounded-xl border border-navy/15 bg-white shadow-luxe">
          <div className="p-2">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search country or code…"
              className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-green"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto pb-1">
            {list.map((c) => (
              <li key={c.iso + c.dial}>
                <button
                  type="button"
                  onClick={() => { onChange(c.dial); setOpen(false); setQ(""); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-cream ${c.dial === value ? "bg-green/5 font-semibold text-green-600" : "text-navy"}`}
                >
                  <span aria-hidden>{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-navy/50">{c.dial}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-3 text-sm text-navy/40">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
