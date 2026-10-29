import { requirePool } from "../db";
import { purgeRateLimits } from "../rate-limit";
import { expireLapsedHolds } from "./transitions";

/** Participants' age and weight are kept only this long after a booking has ended. */
export const PARTICIPANT_DATA_DAYS = 90;

export type SweepResult = { expiredHolds: number; clearedOtps: number; scrubbedParticipants: number };

/**
 * Housekeeping that is safe to run at any time and any number of times:
 * label lapsed holds as expired (cosmetic — availability already ignores them),
 * drop spent one-time codes, clear stale rate-limit counters, and strip
 * age/weight from finished bookings so we don't keep health-adjacent data.
 */
export async function runSweep(): Promise<SweepResult> {
  const pool = requirePool();
  const expiredHolds = await expireLapsedHolds(pool);

  let clearedOtps = 0;
  for (const table of ["company_users", "customer_users"]) {
    const r = await pool.query(`UPDATE ${table} SET otp_code = NULL WHERE otp_code IS NOT NULL AND otp_expires_at < now()`);
    clearedOtps += r.rowCount ?? 0;
  }

  await purgeRateLimits();

  const scrub = await pool.query(
    `UPDATE listing_bookings
        SET participants = (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', p->>'name')), '[]'::jsonb) FROM jsonb_array_elements(participants) p)
      WHERE participants IS NOT NULL
        AND status IN ('completed', 'no_show', 'cancelled', 'expired')
        AND updated_at < now() - make_interval(days => $1)
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(participants) q WHERE q ? 'weightKg' OR q ? 'age')`,
    [PARTICIPANT_DATA_DAYS],
  );

  return { expiredHolds, clearedOtps, scrubbedParticipants: scrub.rowCount ?? 0 };
}
