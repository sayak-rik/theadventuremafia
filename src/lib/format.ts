import { formatPretty } from "./dates";

export const DIFFICULTY_LABEL: Record<string, string> = { easy: "Easy", moderate: "Moderate", difficult: "Difficult", extreme: "Extreme" };
export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

/** "3 left on Sat, 18 Oct" style phrases. */
export const leftPhrase = (n: number, noun: "vehicle" | "seat") => `${n} ${noun}${n === 1 ? "" : "s"} left`;

export function shortDate(iso: string): string {
  return formatPretty(iso).replace(/,\s\d{4}$/, "");
}

/** "08:00" → "8:00 am" */
export function clock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}
