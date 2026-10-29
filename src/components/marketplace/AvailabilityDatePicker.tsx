"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type DaySlots = { slotTime: string | null; available: number; capacity: number }[];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Month calendar showing real availability. Presentational: the parent owns
 * the fetching so it can also read the chosen day's slots.
 */
export function AvailabilityDatePicker({
  year, month, today, days, loading, selected, noun, onSelect, onMonth, canPrev, canNext,
}: {
  year: number; month: number; today: string; days: Record<string, DaySlots>; loading: boolean; selected: string | null; noun: string;
  onSelect: (iso: string) => void; onMonth: (delta: -1 | 1) => void; canPrev: boolean; canNext: boolean;
}) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => onMonth(-1)} disabled={!canPrev} aria-label="Previous month"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-navy hover:bg-navy/5 disabled:opacity-30"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
        <p className="font-semibold text-navy" aria-live="polite">{MONTHS[month]} {year}</p>
        <button type="button" onClick={() => onMonth(1)} disabled={!canNext} aria-label="Next month"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-navy hover:bg-navy/5 disabled:opacity-30"><ChevronRight className="h-5 w-5" aria-hidden /></button>
      </div>

      <div role="grid" aria-label="Choose a date" className={cn("grid grid-cols-7 gap-1 transition-opacity", loading && "opacity-60")}>
        {WEEKDAYS.map((w) => <div key={w} role="columnheader" className="pb-1 text-center text-xs font-medium text-navy/50">{w.slice(0, 2)}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const date = iso(year, month, d);
          const slots = days[date];
          const left = slots ? slots.reduce((n, s) => n + s.available, 0) : 0;
          const past = date < today;
          const disabled = past || !slots || left <= 0;
          const on = date === selected;
          const label = past ? "past" : !slots ? (loading ? "loading" : "unavailable") : left <= 0 ? "fully booked" : `${left} ${noun}${left === 1 ? "" : "s"} left`;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={disabled}
              aria-pressed={on}
              aria-label={`${d} ${MONTHS[month]}, ${label}`}
              onClick={() => onSelect(date)}
              className={cn(
                "relative flex h-12 flex-col items-center justify-center rounded-lg text-[15px] font-medium transition",
                on ? "bg-navy text-cream" : disabled ? "text-navy/25" : "text-navy hover:bg-green/15",
                date === today && !on && "ring-1 ring-inset ring-navy/30",
              )}
            >
              <span className={cn(disabled && !past && slots && "line-through")}>{d}</span>
              {!disabled && <span aria-hidden className={cn("absolute bottom-1 h-1.5 w-1.5 rounded-full", on ? "bg-green" : left <= 2 ? "bg-amber-500" : "bg-green")} />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-4 text-xs text-navy/60">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-green" /> Available</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-amber-500" /> Almost full</span>
      </p>
    </div>
  );
}
