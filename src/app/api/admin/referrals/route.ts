import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { creditAdvCash } from "@/lib/rewards-data";

// GET: list/search reward users.  POST: toggle active / set reward / adjust adv cash.
export async function GET(req: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const pool = getPool();
  if (!pool) return NextResponse.json({ users: [], dbConnected: false });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  const where = q ? `WHERE email ILIKE $1 OR phone ILIKE $1 OR referral_code ILIKE $1` : "";
  const params = q ? [`%${q}%`] : [];
  const res = await pool.query(
    `SELECT id, email, phone, name, referral_code, adv_cash, referral_earned,
            reward_per_conversion, is_active, email_verified, created_at
       FROM referral_users ${where}
      ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  return NextResponse.json({ users: res.rows, dbConnected: true });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id, action, value } = await req.json().catch(() => ({}));
  const userId = Number(id);
  if (!userId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not connected." }, { status: 503 });

  try {
    if (action === "toggle") {
      await pool.query(`UPDATE referral_users SET is_active = NOT is_active WHERE id = $1`, [userId]);
    } else if (action === "setReward") {
      const reward = Math.max(0, Math.round(Number(value) || 0));
      await pool.query(`UPDATE referral_users SET reward_per_conversion = $2 WHERE id = $1`, [userId, reward]);
    } else if (action === "adjust") {
      const amount = Math.round(Number(value) || 0);
      if (amount !== 0) await creditAdvCash(userId, amount, "admin", { note: "Admin adjustment" });
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/referrals] action failed:", err);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
