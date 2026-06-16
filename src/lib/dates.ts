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
