import { NextResponse } from "next/server";
import { getRewardsUserId, REWARDS_COOKIE } from "@/lib/rewards-auth";
import { getUserById } from "@/lib/rewards-data";

// Current reward user (from session cookie) — code + balance.
export async function GET() {
  const id = await getRewardsUserId();
  if (!id) return NextResponse.json({ user: null });
  const u = await getUserById(id);
  if (!u) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { email: u.email, referralCode: u.referral_code, advCash: u.adv_cash, referralEarned: u.referral_earned },
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(REWARDS_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
