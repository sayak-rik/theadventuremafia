import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRewardsUserId, hashPassword } from "@/lib/rewards-auth";

// Set/replace the password for the signed-in (OTP-verified) reward user.
export async function POST(req: Request) {
  const id = await getRewardsUserId();
  if (!id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { password } = await req.json().catch(() => ({}));
  if (!password || String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 422 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  await pool.query(`UPDATE referral_users SET password_hash = $2 WHERE id = $1`, [id, hashPassword(String(password))]);
  return NextResponse.json({ ok: true });
}
