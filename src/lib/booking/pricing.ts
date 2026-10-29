/** Advance in rupees for a given total, rounded up to the next ₹10 and clamped to [1, total]. */
export function advanceFor(total: number, type: "percent" | "flat", value: number): number {
  const raw = type === "percent" ? Math.ceil((total * value) / 100) : value;
  const rounded = Math.ceil(raw / 10) * 10;
  return Math.max(1, Math.min(total, rounded));
}
