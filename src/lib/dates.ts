// Departure-date rules: tours leave every Sunday, September through May.

const SEASON_MONTHS = new Set([9, 10, 11, 12, 1, 2, 3, 4, 5]); // 1-indexed

export function isSunday(d: Date): boolean {
  return d.getDay() === 0;
}

export function isInSeason(d: Date): boolean {
  return SEASON_MONTHS.has(d.getMonth() + 1);
}

/** A date is a valid departure if it's a Sunday in season and not in the past. */
export function isValidDeparture(d: Date, from: Date = new Date()): boolean {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  return isSunday(d) && isInSeason(d) && d >= today;
}

/** Treks run daily — valid on any date from today onward. */
export function isValidTrekDate(d: Date, from: Date = new Date()): boolean {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(d.getTime()) && d >= today;
}

/** Format as YYYY-MM-DD in local time (avoids UTC off-by-one from toISOString). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Generate the next N valid Sunday departures from a starting point. */
export function upcomingDepartures(count = 12, from: Date = new Date()): string[] {
  const out: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  // advance to the next Sunday
  cursor.setDate(cursor.getDate() + ((7 - cursor.getDay()) % 7));
  let guard = 0;
  while (out.length < count && guard < 400) {
    if (isInSeason(cursor)) out.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 7);
    guard++;
  }
  return out;
}

export function formatPretty(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// --- IST (Asia/Kolkata) helpers ---------------------------------------------
// The server (Docker) runs in UTC, so Date's local-time getters are 5h30m
// behind India. All marketplace "today" / "is this date in the past" logic
// goes through these, never through `new Date()` local getters.

const IST_OFFSET_MIN = 330;

/** Today's calendar date in India as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return ist.toISOString().slice(0, 10);
}

/** Current hour-of-day (0-23) and minute in India. */
export function nowISTParts(now: Date = new Date()): { date: string; minutes: number } {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return { date: ist.toISOString().slice(0, 10), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes() };
}

/** Add whole days to a YYYY-MM-DD string (calendar arithmetic, no timezone drift). */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** True for a well-formed, real calendar date string. */
export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function diffDaysISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
