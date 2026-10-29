/** "08:30" or "08:30:00" → minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const HOLD_MINUTES = 30;
/** How far ahead a booking may be made. */
export const BOOKING_HORIZON_DAYS = 120;
