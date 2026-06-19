import { getPool } from "./db";
import { REFERRAL_CAP } from "./rewards";

export type RewardUser = {
  id: number;
  email: string;
  phone: string;
  name: string | null;
  referral_code: string;
  adv_cash: number;
  referral_earned: number;
  reward_per_conversion: number;
  is_active: boolean;
  email_verified: boolean;
};

/** Look up an active reward user by referral code (case-insensitive). */
export async function findActiveByCode(code: string) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<RewardUser>(
    `SELECT * FROM referral_users WHERE upper(referral_code) = upper($1) AND is_active = TRUE AND email_verified = TRUE LIMIT 1`,
    [code],
  );
  return res.rows[0] ?? null;
}

export async function getUserById(id: number) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<RewardUser>(`SELECT * FROM referral_users WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

/** Adjust a user's adv-cash balance and write a ledger row, atomically. */
export async function creditAdvCash(
  userId: number,
  amount: number,
  reason: string,
  opts?: { bookingId?: number; note?: string; countAsReferral?: boolean },
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE referral_users
          SET adv_cash = GREATEST(0, adv_cash + $2)
              ${opts?.countAsReferral ? ", referral_earned = referral_earned + $2" : ""}
        WHERE id = $1`,
      [userId, amount],
    );
    await client.query(
      `INSERT INTO adv_cash_ledger (user_id, amount, reason, booking_id, note) VALUES ($1,$2,$3,$4,$5)`,
      [userId, amount, reason, opts?.bookingId ?? null, opts?.note ?? null],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Referral earnings remaining before hitting the lifetime cap. */
export function remainingCap(referralEarned: number): number {
  return Math.max(0, REFERRAL_CAP - referralEarned);
}
