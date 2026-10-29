import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import { getTodayBoard } from "@/lib/listings/public";
import { clock12, shortDate } from "@/lib/format";
import { formatINR } from "@/lib/pricing";
import { todayIST } from "@/lib/dates";

const PATH: Record<string, string> = {
  "bike-rental": "/adventures/bike-rental",
  "scooty-rental": "/adventures/scooty-rental",
  rafting: "/adventures/rafting",
  paragliding: "/adventures/paragliding",
  "guided-tours": "/adventures/guided-tours",
  "car-hire": "/adventures/car-hire",
};

/** Singular/plural noun for a count, by what this category's capacity actually is. */
function nounFor(bookingModel: string, icon: string | null, count: number): string {
  if (bookingModel === "route_trip") return count === 1 ? "vehicle" : "vehicles";
  if (bookingModel === "departure") return count === 1 ? "spot" : "spots";
  if (bookingModel === "rental_day") return icon === "scooter" ? (count === 1 ? "scooty" : "scooties") : count === 1 ? "bike" : "bikes";
  return count === 1 ? "seat" : "seats";
}

/**
 * What's actually free today, per activity — the one thing this site knows
 * that a listing page can't. Styled like a departure board.
 */
export async function TodayBoard() {
  let rows;
  try {
    rows = await getTodayBoard();
  } catch {
    return null; // never take the home page down because the board couldn't load
  }
  const today = todayIST();
  return (
    <section aria-labelledby="board-h" className="overflow-hidden rounded-2xl border border-white/10 bg-navy-800 shadow-luxe">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
        <h2 id="board-h" className="flex items-center gap-2.5 font-serif text-lg font-bold text-cream">
          <span aria-hidden className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60 motion-reduce:hidden" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green" /></span>
          Free today across Sikkim
        </h2>
        <p className="text-sm tabular-nums text-cream/60">{shortDate(today)}</p>
      </div>
      <ul className="divide-y divide-white/10">
        {rows.map((r) => {
          let status: React.ReactNode;
          if (r.listings === 0) status = <span className="text-cream/50">Opening soon</span>;
          else if (r.freeToday > 0) status = <><strong className="text-xl tabular-nums text-green-300">{r.freeToday}</strong> <span className="text-cream/80">{nounFor(r.bookingModel, r.icon, r.freeToday)} free</span></>;
          else if (r.next) status = <span className="text-cream/80">Next free: <strong className="font-semibold text-cream">{shortDate(r.next.date)}{r.next.slotTime ? `, ${clock12(r.next.slotTime)}` : ""}</strong> <span className="text-cream/60">· {r.next.free} {nounFor(r.bookingModel, r.icon, r.next.free)}</span></span>;
          else status = <span className="text-cream/50">Nothing free this week</span>;
          return (
            <li key={r.categorySlug}>
              <Link href={PATH[r.categorySlug] ?? `/adventures/${r.categorySlug}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition hover:bg-white/[0.04]">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.07] text-green-300"><CategoryIcon icon={r.icon} className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold text-cream">{r.categoryName}</span>
                  <span className="block text-sm">{status}</span>
                </span>
                <span className="flex items-center gap-3 text-right">
                  {r.fromPrice != null && r.listings > 0 && <span className="hidden text-sm text-cream/60 sm:block">from <span className="font-semibold tabular-nums text-cream">{formatINR(r.fromPrice)}</span></span>}
                  <ChevronRight className="h-5 w-5 text-cream/40" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
