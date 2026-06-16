"use client";

import { useMemo, useState } from "react";
import { isValidDeparture, toISODate } from "@/lib/dates";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Month-grid calendar where only valid Sunday departures (Sep–May, not past)
// are selectable. Everything else is greyed out and non-interactive.
export function SundayCalendar({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = first.getDay(); // leading blanks
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: start }, () => null);
    for (let d = 1; d <= days; d++) out.push(new Date(view.getFullYear(), view.getMonth(), d));
    return out;
  }, [view]);

  const shift = (delta: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));

  return (
    <div className="rounded-2xl border border-navy/15 bg-white p-4">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg px-3 py-1.5 text-navy/70 transition hover:bg-cream"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="font-serif text-base font-bold text-navy" aria-live="polite">
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg px-3 py-1.5 text-navy/70 transition hover:bg-cream"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-1 text-[11px] font-semibold uppercase text-navy/40">
            {w}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`b${i}`} />;
          const iso = toISODate(date);
          const selectable = isValidDeparture(date, today);
          const selected = value === iso;
          return (
            <button
              key={iso}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onChange(iso)}
              aria-pressed={selected}
              aria-label={selectable ? `Departure ${iso}` : `${iso} unavailable`}
              className={[
                "aspect-square rounded-lg text-sm transition",
                selected
                  ? "bg-green font-bold text-white"
                  : selectable
                    ? "bg-green/10 font-semibold text-green-600 hover:bg-green/20"
                    : "cursor-not-allowed text-navy/25",
              ].join(" ")}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <p className="mt-3 px-1 text-xs text-navy/50">
        Highlighted dates are Sunday departures (Sep–May). All others are unavailable.
      </p>
    </div>
  );
}
